import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { Order, ORDER_STATUSES, type OrderStatus } from "../src/models/index.js";
import {
  canTransition,
  ORDER_TRANSITIONS,
  isTerminal,
} from "../src/services/order-status.js";
import { transitionOrder } from "../src/services/order.service.js";
import { makeUser } from "./factories.js";

async function orderAt(status: OrderStatus) {
  const user = await makeUser();
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
  return Order.create({
    orderNumber: `FSH-ST${Math.floor(Math.random() * 90000) + 10000}`,
    userId: user._id,
    email: user.email,
    items: [
      {
        variantId: new Types.ObjectId(),
        productId: new Types.ObjectId(),
        sku: "TEST-ST",
        nameSnapshot: "Ecru Overshirt",
        colourSnapshot: "Ecru",
        sizeSnapshot: "M",
        imageSnapshot: "/images/product-ecru-overshirt-01.jpg",
        unitPrice: 480000,
        quantity: 1,
      },
    ],
    pricing: { subtotal: 480000, discount: 0, shipping: 0, tax: 0, total: 480000 },
    shippingAddress: address,
    billingAddress: address,
    status,
    statusHistory: [{ status, at: new Date() }],
    idempotencyKey: `st-${Date.now()}-${Math.random()}`,
  });
}

describe("order status is a state machine", () => {
  it("rejects every transition not in the map", async () => {
    // Exhaustive rather than a handful of examples: for every pair of
    // statuses, the service must agree with the declared map.
    const illegal: string[] = [];

    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        if (from === to) continue;
        if (canTransition(from, to)) continue;

        const order = await orderAt(from);
        const result = await transitionOrder({ orderId: order._id, to }).then(
          () => "allowed",
          (error: { code?: string; status?: number }) =>
            error.code === "INVALID_STATUS_TRANSITION" && error.status === 409
              ? "rejected"
              : `wrong-error:${error.code}`,
        );
        if (result !== "rejected") illegal.push(`${from} -> ${to} was ${result}`);
      }
    }

    expect(illegal).toEqual([]);
  });

  it("allows every transition that is in the map, and records it", async () => {
    for (const [from, allowed] of Object.entries(ORDER_TRANSITIONS)) {
      for (const to of allowed) {
        const order = await orderAt(from as OrderStatus);
        const moved = await transitionOrder({
          orderId: order._id,
          to,
          note: "test move",
        });
        expect(moved.status).toBe(to);
        // Appended, never overwritten: the history keeps both entries.
        expect(moved.statusHistory).toHaveLength(2);
        expect(moved.statusHistory.at(-1)).toMatchObject({ status: to, note: "test move" });
      }
    }
  });

  it("treats re-asserting the current status as a no-op", async () => {
    // A replayed webhook does exactly this, and it must not be an error.
    const order = await orderAt("paid");
    const again = await transitionOrder({ orderId: order._id, to: "paid" });
    expect(again.status).toBe("paid");
    expect(again.statusHistory).toHaveLength(1);
  });

  it("leaves terminal statuses with nowhere to go", async () => {
    for (const status of ["cancelled", "refunded", "returned", "rejected", "payment_failed"] as const) {
      expect(isTerminal(status)).toBe(true);
      const order = await orderAt(status);
      await expect(
        transitionOrder({ orderId: order._id, to: "paid" }),
      ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    }
  });

  it("lets only one of two simultaneous admins apply a move", async () => {
    // Both read `processing`; the conditional update means only one write can
    // land, and the loser is told to reload rather than silently overwriting.
    const order = await orderAt("processing");

    const outcomes = await Promise.allSettled([
      transitionOrder({ orderId: order._id, to: "shipped" }),
      transitionOrder({ orderId: order._id, to: "cancelled" }),
    ]);

    const won = outcomes.filter((o) => o.status === "fulfilled");
    expect(won).toHaveLength(1);

    const fresh = await Order.findById(order._id);
    expect(["shipped", "cancelled"]).toContain(fresh?.status);
    expect(fresh?.statusHistory).toHaveLength(2);
  });
});
