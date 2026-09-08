import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import {
  Order,
  Payment,
  Reservation,
  StockMovement,
  WebhookEvent,
  type OrderDoc,
} from "../src/models/index.js";
import {
  getAvailabilityFor,
  reconcile,
  reserve,
} from "../src/services/inventory.service.js";
import { handleWebhook } from "../src/services/payment.service.js";
import { makeCart, makeUser, makeVariant } from "./factories.js";

/** An order in pending_payment with a gateway payment attached, holds included. */
async function pendingOrder(units: number, onHand = 10) {
  const { variant } = await makeVariant({ onHand });
  const cart = await makeCart();
  const user = await makeUser();

  await reserve({ cartId: cart._id, variantId: variant._id, quantity: units, ttlMinutes: 20 });

  const address = {
    fullName: "Ananya Rao",
    phone: "9876543210",
    line1: "12 Palm Grove",
    line2: null,
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    country: "IN",
  };

  const total = 480000 * units;
  const order = (await Order.create({
    orderNumber: `FSH-WH${Math.floor(Math.random() * 9000) + 1000}`,
    userId: user._id,
    email: user.email,
    items: [
      {
        variantId: variant._id,
        productId: new Types.ObjectId(),
        sku: "TEST-WH",
        nameSnapshot: "Ecru Overshirt",
        colourSnapshot: "Ecru",
        sizeSnapshot: "M",
        imageSnapshot: "/images/product-ecru-overshirt-01.jpg",
        unitPrice: 480000,
        quantity: units,
      },
    ],
    pricing: { subtotal: total, discount: 0, shipping: 0, tax: 0, total },
    shippingAddress: address,
    billingAddress: address,
    status: "pending_payment",
    statusHistory: [{ status: "pending_payment", at: new Date() }],
    idempotencyKey: `wh-${Date.now()}-${Math.random()}`,
    cartId: cart._id,
  })) as OrderDoc;

  const payment = await Payment.create({
    orderId: order._id,
    gateway: "razorpay",
    gatewayOrderId: `order_test_${order.orderNumber}`,
    amount: total,
    currency: "INR",
    status: "created",
  });

  return { order, payment, variant, cart };
}

function capturedEvent(args: {
  paymentId: string;
  gatewayOrderId: string;
  amount: number;
}) {
  return {
    eventId: `evt_${args.paymentId}`,
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: args.paymentId,
          order_id: args.gatewayOrderId,
          amount: args.amount,
          method: "upi",
        },
      },
    },
  };
}

/**
 * Razorpay retries on any non-2xx and sometimes delivers twice regardless, so
 * the same event WILL arrive more than once. These tests assert that the second
 * and third deliveries change nothing: one stock decrement, one paid order.
 */
describe("payment webhooks are idempotent", () => {
  it("processes the same event id three times but applies it once", async () => {
    const { order, payment, variant } = await pendingOrder(2, 10);
    const event = capturedEvent({
      paymentId: "pay_test_replay_1",
      gatewayOrderId: payment.gatewayOrderId,
      amount: payment.amount,
    });

    const first = await handleWebhook(event);
    const second = await handleWebhook(event);
    const third = await handleWebhook(event);

    expect(first.status).toBe("processed");
    // The unique index on (gateway, eventId) is what makes these duplicates —
    // not an `if` in the handler.
    expect(second.status).toBe("duplicate");
    expect(third.status).toBe("duplicate");

    const settled = await Order.findById(order._id);
    expect(settled?.status).toBe("paid");
    // One transition recorded, not three.
    expect(settled?.statusHistory.filter((e) => e.status === "paid")).toHaveLength(1);

    // Stock left the shelf exactly once.
    const stock = await getAvailabilityFor(variant._id);
    expect(stock.onHand).toBe(8);
    expect(stock.reserved).toBe(0);
    expect(stock.available).toBe(8);

    const fulfils = await StockMovement.find({
      variantId: variant._id,
      type: "fulfil",
    }).lean();
    expect(fulfils).toHaveLength(1);
    expect(fulfils[0]?.quantity).toBe(-2);

    expect(await WebhookEvent.countDocuments({})).toBe(1);
    const [row] = await reconcile(variant._id);
    expect(row?.ok).toBe(true);
  });

  it("applies it once even when three deliveries land simultaneously", async () => {
    const { order, payment, variant } = await pendingOrder(3, 12);
    const event = capturedEvent({
      paymentId: "pay_test_race_1",
      gatewayOrderId: payment.gatewayOrderId,
      amount: payment.amount,
    });

    const outcomes = await Promise.allSettled([
      handleWebhook(event),
      handleWebhook(event),
      handleWebhook(event),
    ]);

    const statuses = outcomes
      .filter((o) => o.status === "fulfilled")
      .map((o) => (o as PromiseFulfilledResult<{ status: string }>).value.status);
    expect(statuses.filter((s) => s === "processed")).toHaveLength(1);

    const stock = await getAvailabilityFor(variant._id);
    expect(stock.onHand).toBe(9);
    expect(stock.reserved).toBe(0);
    expect(await Order.findById(order._id).then((o) => o?.status)).toBe("paid");
    expect(await WebhookEvent.countDocuments({})).toBe(1);
  });

  it("clears the bag's holds and converts the cart on payment", async () => {
    const { payment, cart } = await pendingOrder(1, 4);
    await handleWebhook(
      capturedEvent({
        paymentId: "pay_test_cart_1",
        gatewayOrderId: payment.gatewayOrderId,
        amount: payment.amount,
      }),
    );

    expect(await Reservation.countDocuments({ cartId: cart._id })).toBe(0);
  });

  it("refuses an event whose amount does not match the order", async () => {
    // Either a bug or someone paying a different amount. Settling it anyway
    // would mean shipping goods for the wrong money.
    const { order, payment, variant } = await pendingOrder(2, 10);

    await expect(
      handleWebhook(
        capturedEvent({
          paymentId: "pay_test_wrong_amount",
          gatewayOrderId: payment.gatewayOrderId,
          amount: 100,
        }),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(await Order.findById(order._id).then((o) => o?.status)).toBe("pending_payment");
    const stock = await getAvailabilityFor(variant._id);
    expect(stock.onHand).toBe(10);

    // Recorded but explicitly unfinished, so it is visible rather than
    // mistaken for a duplicate on the retry.
    const record = await WebhookEvent.findOne({ eventId: "evt_pay_test_wrong_amount" });
    expect(record?.processedAt).toBeNull();
    expect(record?.error).toBeTruthy();
  });

  it("marks a failed payment without releasing the holds", async () => {
    // The shopper is probably about to try another card. Dropping their stock
    // the instant a card is declined would lose the sale.
    const { order, variant, payment } = await pendingOrder(2, 6);

    const outcome = await handleWebhook({
      eventId: "evt_failed_1",
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            id: "pay_failed_1",
            order_id: payment.gatewayOrderId,
            error_description: "card declined",
          },
        },
      },
    });

    expect(outcome.status).toBe("processed");
    expect(await Order.findById(order._id).then((o) => o?.status)).toBe("payment_failed");

    const stock = await getAvailabilityFor(variant._id);
    expect(stock.reserved).toBe(2);
    expect(stock.onHand).toBe(6);
  });

  it("records and ignores events it has no opinion about", async () => {
    const outcome = await handleWebhook({
      eventId: "evt_unrelated_1",
      event: "subscription.charged",
      payload: {},
    });
    // Ignored, not errored: throwing would make the gateway retry forever.
    expect(outcome.status).toBe("ignored");
    const record = await WebhookEvent.findOne({ eventId: "evt_unrelated_1" });
    expect(record?.processedAt).not.toBeNull();
  });
});
