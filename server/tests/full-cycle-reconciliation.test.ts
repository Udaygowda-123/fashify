import { describe, expect, it } from "vitest";
import { Order, Return } from "../src/models/index.js";
import { getAvailabilityFor, reconcile } from "../src/services/inventory.service.js";
import { advanceReturn, requestReturn } from "../src/services/return.service.js";
import { cancelOrder, createOrder } from "../src/services/order.service.js";
import { commitOrderStock } from "../src/services/order.service.js";
import { addItem, getOrCreateCart } from "../src/services/cart.service.js";
import { makeUser, makeVariant } from "./factories.js";

const ADDRESS = {
  fullName: "Ananya Rao",
  phone: "9876543210",
  line1: "12 Palm Grove",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560001",
};

/**
 * THE FULL LIFECYCLE, LEDGER-CHECKED AT EVERY STEP.
 *
 * This is the test that proves the ledger design actually works end to end,
 * not just for one mechanism in isolation: buy two, pay for them, return one,
 * approve it back onto the shelf, refund it — and after every single step the
 * ledger must still explain exactly what `onHand` and `reserved` are.
 *
 * If any step here silently drifts, reconciliation will not lie about it.
 */
describe("a full buy, pay, return and refund cycle reconciles at every step", () => {
  it("keeps the ledger honest through the whole lifecycle", async () => {
    const { variant } = await makeVariant({ onHand: 10 });
    const user = await makeUser();

    // 1. Add to bag — holds two units.
    let cart = await getOrCreateCart({ userId: user._id });
    cart = await addItem({ cart, variantId: variant._id, quantity: 2 });

    let check = await reconcile(variant._id);
    expect(check[0]?.ok).toBe(true);
    expect((await getAvailabilityFor(variant._id)).reserved).toBe(2);

    // 2. Place the order — still just a hold, nothing decremented yet.
    const { order } = await createOrder({
      cart,
      userId: user._id,
      email: user.email,
      shippingAddress: ADDRESS,
      idempotencyKey: `cycle-${Date.now()}`,
    });
    expect(order.status).toBe("pending_payment");

    check = await reconcile(variant._id);
    expect(check[0]?.ok).toBe(true);
    expect((await getAvailabilityFor(variant._id)).onHand).toBe(10);

    // 3. Payment lands — the hold becomes a permanent decrement.
    await commitOrderStock(order);
    const paid = await Order.findByIdAndUpdate(
      order._id,
      {
        $set: { status: "paid" },
        $push: { statusHistory: { status: "paid", at: new Date() } },
      },
      { new: true },
    );

    check = await reconcile(variant._id);
    expect(check[0]?.ok).toBe(true);
    let stock = await getAvailabilityFor(variant._id);
    expect(stock.onHand).toBe(8);
    expect(stock.reserved).toBe(0);
    expect(stock.available).toBe(8);

    // Move it through to delivered, so a return is possible.
    for (const to of ["processing", "shipped", "delivered"] as const) {
      await Order.findByIdAndUpdate(paid!._id, {
        $set: { status: to },
        $push: { statusHistory: { status: to, at: new Date() } },
      });
    }

    // 4. Shopper returns one of the two units.
    const record = await requestReturn({
      orderNumber: order.orderNumber,
      userId: user._id,
      reason: "wrong size",
      items: [{ sku: variant.sku, quantity: 1 }],
    });
    expect(record.status).toBe("requested");
    expect(await Order.findById(order._id).then((o) => o?.status)).toBe("return_requested");

    // Stock has not moved yet — a request is not yet an approval.
    check = await reconcile(variant._id);
    expect(check[0]?.ok).toBe(true);
    stock = await getAvailabilityFor(variant._id);
    expect(stock.onHand).toBe(8);

    // 5. Approve, then mark received — this is where stock goes back.
    await advanceReturn({ returnId: record._id, to: "approved" });
    const received = await advanceReturn({ returnId: record._id, to: "received" });
    expect(received.restockedAt).not.toBeNull();

    check = await reconcile(variant._id);
    expect(check[0]?.ok).toBe(true);
    stock = await getAvailabilityFor(variant._id);
    expect(stock.onHand).toBe(9); // one unit back on the shelf
    expect(stock.reserved).toBe(0);
    expect(stock.available).toBe(9);

    // Restocking twice must be impossible.
    await expect(
      advanceReturn({ returnId: record._id, to: "received" }),
    ).resolves.toMatchObject({ status: "received" }); // no-op, same status
    stock = await getAvailabilityFor(variant._id);
    expect(stock.onHand).toBe(9); // unchanged

    // 6. Refund — order becomes returned. (Refund itself is a no-op here
    // since no payment gateway is configured; the failure is recorded rather
    // than thrown, and the state still advances.)
    const refunded = await advanceReturn({ returnId: record._id, to: "refunded" });
    expect(refunded.status).toBe("refunded");
    expect(await Order.findById(order._id).then((o) => o?.status)).toBe("returned");

    // Final check: the ledger explains every counter, end to end.
    check = await reconcile(variant._id);
    expect(check[0]?.ok).toBe(true);
    expect(check[0]?.ledgerOnHand).toBe(check[0]?.storedOnHand);
    expect(check[0]?.ledgerReserved).toBe(check[0]?.storedReserved);
  });

  it("reconciles after an order is cancelled before payment", async () => {
    const { variant } = await makeVariant({ onHand: 5 });
    const user = await makeUser();
    let cart = await getOrCreateCart({ userId: user._id });
    cart = await addItem({ cart, variantId: variant._id, quantity: 3 });

    const { order } = await createOrder({
      cart,
      userId: user._id,
      email: user.email,
      shippingAddress: ADDRESS,
      idempotencyKey: `cancel-unpaid-${Date.now()}`,
    });

    await cancelOrder({ orderId: order._id, reason: "changed my mind" });

    const stock = await getAvailabilityFor(variant._id);
    expect(stock.onHand).toBe(5);
    expect(stock.reserved).toBe(0);
    expect(stock.available).toBe(5);

    const [row] = await reconcile(variant._id);
    expect(row?.ok).toBe(true);
  });

  it("reconciles when a committed order is cancelled (stock returns via receive, not release)", async () => {
    /**
     * The declared state machine has no `paid -> cancelled` transition — once
     * money has moved, stopping an order means refunding it, not cancelling
     * it (see CUSTOMER_CANCELLABLE in order-status.ts). `processing -> cancelled`
     * IS legal, so this moves the order there first: that keeps the scenario
     * this test actually cares about — stock was already committed via
     * fulfil(), so undoing the order must use receive(), not release().
     */
    const { variant } = await makeVariant({ onHand: 6 });
    const user = await makeUser();
    let cart = await getOrCreateCart({ userId: user._id });
    cart = await addItem({ cart, variantId: variant._id, quantity: 2 });

    const { order } = await createOrder({
      cart,
      userId: user._id,
      email: user.email,
      shippingAddress: ADDRESS,
      idempotencyKey: `cancel-committed-${Date.now()}`,
    });
    await commitOrderStock(order);
    await Order.updateOne({ _id: order._id }, { $set: { status: "processing" } });

    let stock = await getAvailabilityFor(variant._id);
    expect(stock.onHand).toBe(4);

    await cancelOrder({ orderId: order._id, reason: "out of stock elsewhere, cancelling" });

    stock = await getAvailabilityFor(variant._id);
    // Units are back on the shelf — via `receive`, since `reserved` no longer
    // counted them after commitOrderStock ran.
    expect(stock.onHand).toBe(6);
    expect(stock.reserved).toBe(0);

    expect(await Order.findById(order._id).then((o) => o?.status)).toBe("cancelled");

    const [row] = await reconcile(variant._id);
    expect(row?.ok).toBe(true);
  });

  it("refuses to cancel a paid order directly — refund is the only way to stop it", async () => {
    const { variant } = await makeVariant({ onHand: 4 });
    const user = await makeUser();
    let cart = await getOrCreateCart({ userId: user._id });
    cart = await addItem({ cart, variantId: variant._id, quantity: 1 });

    const { order } = await createOrder({
      cart,
      userId: user._id,
      email: user.email,
      shippingAddress: ADDRESS,
      idempotencyKey: `no-direct-cancel-${Date.now()}`,
    });
    await commitOrderStock(order);
    await Order.updateOne({ _id: order._id }, { $set: { status: "paid" } });

    await expect(
      cancelOrder({ orderId: order._id, reason: "trying anyway" }),
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });

    // Nothing moved: stock stays committed, order stays paid.
    const stock = await getAvailabilityFor(variant._id);
    expect(stock.onHand).toBe(3);
    expect(await Order.findById(order._id).then((o) => o?.status)).toBe("paid");
  });

  it("does not restock a piece marked as not sellable", async () => {
    const { variant } = await makeVariant({ onHand: 5 });
    const user = await makeUser();
    let cart = await getOrCreateCart({ userId: user._id });
    cart = await addItem({ cart, variantId: variant._id, quantity: 1 });
    const { order } = await createOrder({
      cart,
      userId: user._id,
      email: user.email,
      shippingAddress: ADDRESS,
      idempotencyKey: `damaged-${Date.now()}`,
    });
    await commitOrderStock(order);
    for (const to of ["paid", "processing", "shipped", "delivered"] as const) {
      await Order.updateOne({ _id: order._id }, { $set: { status: to } });
    }

    const record = await requestReturn({
      orderNumber: order.orderNumber,
      userId: user._id,
      reason: "arrived damaged",
      items: [{ sku: variant.sku, quantity: 1 }],
    });
    await advanceReturn({ returnId: record._id, to: "approved" });
    // The person unpacking it decides it cannot be resold.
    await advanceReturn({
      returnId: record._id,
      to: "received",
      restock: { [variant.sku]: false },
    });

    const stock = await getAvailabilityFor(variant._id);
    // Onhand stayed at 4 (5 - 1 sold), the returned unit did NOT come back.
    expect(stock.onHand).toBe(4);

    const [row] = await reconcile(variant._id);
    expect(row?.ok).toBe(true);
  });
});
