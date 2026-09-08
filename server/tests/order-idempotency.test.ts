import type { Express } from "express";
import { describe, expect, it, beforeAll } from "vitest";
import { Order } from "../src/models/index.js";
import { getAvailabilityFor } from "../src/services/inventory.service.js";
import { bearer, createTestApp, request } from "./harness.js";
import { makeVariant } from "./factories.js";

let app: Express;
beforeAll(() => {
  app = createTestApp();
});

const ADDRESS = {
  fullName: "Ananya Rao",
  phone: "9876543210",
  line1: "12 Palm Grove",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560001",
};

async function bagWithOneItem(uid: string, variantId: string) {
  await request(app)
    .post("/api/v1/cart/items")
    .set("Authorization", bearer(uid))
    .send({ variantId, quantity: 2 })
    .expect(201);
}

describe("order creation is idempotent", () => {
  it("creates one order when the same key arrives twice", async () => {
    const { variant } = await makeVariant({ onHand: 10 });
    await bagWithOneItem("shopper-1", String(variant._id));

    const body = { email: "ananya.rao@example.in", shippingAddress: ADDRESS };
    const key = "idem-key-double-tap-0001";

    const first = await request(app)
      .post("/api/v1/checkout/orders")
      .set("Authorization", bearer("shopper-1"))
      .set("Idempotency-Key", key)
      .send(body);

    const second = await request(app)
      .post("/api/v1/checkout/orders")
      .set("Authorization", bearer("shopper-1"))
      .set("Idempotency-Key", key)
      .send(body);

    expect(first.status).toBe(201);
    expect(first.body.replayed).toBe(false);

    // A replay is a 200 carrying the original order, not a second 201.
    expect(second.status).toBe(200);
    expect(second.body.replayed).toBe(true);
    expect(second.body.order.orderNumber).toBe(first.body.order.orderNumber);

    expect(await Order.countDocuments({})).toBe(1);
  });

  it("creates one order when both requests arrive at once", async () => {
    // The real double-tap: neither request has finished before the other
    // starts, so a look-before-you-insert check would let both through.
    const { variant } = await makeVariant({ onHand: 10 });
    await bagWithOneItem("shopper-2", String(variant._id));

    const key = "idem-key-concurrent-0002";
    const send = () =>
      request(app)
        .post("/api/v1/checkout/orders")
        .set("Authorization", bearer("shopper-2"))
        .set("Idempotency-Key", key)
        .send({ email: "k@example.in", shippingAddress: ADDRESS });

    const [a, b] = await Promise.all([send(), send()]);

    expect(await Order.countDocuments({})).toBe(1);
    // Both callers get a usable answer, and it is the same order.
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body.order.orderNumber).toBe(b.body.order.orderNumber);
  });

  it("creates separate orders for different keys", async () => {
    const { variant } = await makeVariant({ onHand: 20 });

    for (const key of ["key-alpha-00001", "key-bravo-00002"]) {
      await bagWithOneItem("shopper-3", String(variant._id));
      await request(app)
        .post("/api/v1/checkout/orders")
        .set("Authorization", bearer("shopper-3"))
        .set("Idempotency-Key", key)
        .send({ email: "s@example.in", shippingAddress: ADDRESS })
        .expect(201);
    }

    expect(await Order.countDocuments({})).toBe(2);
  });

  it("refuses a request with no idempotency key", async () => {
    const { variant } = await makeVariant({ onHand: 5 });
    await bagWithOneItem("shopper-4", String(variant._id));

    const response = await request(app)
      .post("/api/v1/checkout/orders")
      .set("Authorization", bearer("shopper-4"))
      .send({ email: "s@example.in", shippingAddress: ADDRESS })
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(await Order.countDocuments({})).toBe(0);
  });

  it("does not decrement stock at order creation — only holds it", async () => {
    // Placing an order must not take units off the shelf. Payment does that.
    const { variant } = await makeVariant({ onHand: 10 });
    await bagWithOneItem("shopper-5", String(variant._id));

    await request(app)
      .post("/api/v1/checkout/orders")
      .set("Authorization", bearer("shopper-5"))
      .set("Idempotency-Key", "key-stock-check-01")
      .send({ email: "s@example.in", shippingAddress: ADDRESS })
      .expect(201);

    const stock = await getAvailabilityFor(variant._id);
    expect(stock.onHand).toBe(10);
    expect(stock.reserved).toBe(2);
    expect(stock.available).toBe(8);
  });

  it("rejects an order for an empty bag", async () => {
    const response = await request(app)
      .post("/api/v1/checkout/orders")
      .set("Authorization", bearer("shopper-6"))
      .set("Idempotency-Key", "key-empty-bag-001")
      .send({ email: "s@example.in", shippingAddress: ADDRESS })
      .expect(409);

    expect(response.body.error.message).toContain("nothing in your bag");
  });

  it("rejects a malformed address with per-field messages", async () => {
    const { variant } = await makeVariant({ onHand: 5 });
    await bagWithOneItem("shopper-7", String(variant._id));

    const response = await request(app)
      .post("/api/v1/checkout/orders")
      .set("Authorization", bearer("shopper-7"))
      .set("Idempotency-Key", "key-bad-address-1")
      .send({
        email: "not-an-email",
        shippingAddress: { ...ADDRESS, pincode: "5600", phone: "12345" },
      })
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    const fields = response.body.error.details.fields as Record<string, string>;
    expect(Object.keys(fields)).toEqual(
      expect.arrayContaining(["email", "shippingAddress.pincode", "shippingAddress.phone"]),
    );
    expect(fields["shippingAddress.pincode"]).toContain("six digits");
  });
});
