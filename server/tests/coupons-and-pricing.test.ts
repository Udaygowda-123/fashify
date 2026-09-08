import type { Express } from "express";
import { describe, expect, it, beforeAll } from "vitest";
import { Coupon, Order } from "../src/models/index.js";
import { rupeesToPaise } from "../src/models/types.js";
import { addItem, getCartView, getOrCreateCart } from "../src/services/cart.service.js";
import {
  claimCouponUse,
  computePricing,
  FREE_SHIPPING_THRESHOLD,
  resolveCoupon,
  SHIPPING_FLAT_RATE,
} from "../src/services/pricing.service.js";
import { bearer, createTestApp, request } from "./harness.js";
import { makeUser, makeVariant } from "./factories.js";

let app: Express;
beforeAll(() => {
  app = createTestApp();
});

const active = (overrides: Record<string, unknown> = {}) =>
  Coupon.create({
    code: "TEST10",
    description: "10% off",
    type: "percent",
    value: 1000, // basis points
    minSubtotal: 0,
    isActive: true,
    ...overrides,
  });

describe("coupon rules", () => {
  it("takes a percentage off, in basis points", async () => {
    await active();
    const { discount } = await resolveCoupon({ code: "TEST10", subtotal: rupeesToPaise(4800) });
    // 10% of ₹4,800 = ₹480
    expect(discount).toBe(rupeesToPaise(480));
  });

  it("takes a fixed amount off, never more than the bag", async () => {
    await active({ code: "FLAT500", type: "fixed", value: rupeesToPaise(500) });
    const small = await resolveCoupon({ code: "FLAT500", subtotal: rupeesToPaise(300) });
    // Capped at the subtotal, so a bag can never go negative.
    expect(small.discount).toBe(rupeesToPaise(300));
  });

  it("rejects a code that has expired, and says when", async () => {
    await active({
      code: "GONE",
      validUntil: new Date(Date.now() - 24 * 3600 * 1000),
    });
    await expect(resolveCoupon({ code: "GONE", subtotal: 100_000 })).rejects.toMatchObject({
      code: "COUPON_INVALID",
    });
    await expect(resolveCoupon({ code: "GONE", subtotal: 100_000 })).rejects.toThrow(/expired on/);
  });

  it("rejects a code that is not active yet", async () => {
    await active({ code: "SOON", validFrom: new Date(Date.now() + 24 * 3600 * 1000) });
    await expect(resolveCoupon({ code: "SOON", subtotal: 100_000 })).rejects.toThrow(
      /not active yet/,
    );
  });

  it("says how much more is needed to reach the minimum", async () => {
    await active({ code: "BIG", minSubtotal: rupeesToPaise(5000) });
    await expect(
      resolveCoupon({ code: "BIG", subtotal: rupeesToPaise(3000) }),
    ).rejects.toThrow(/Add ₹2,000 more/);
  });

  it("rejects a code that has been fully claimed", async () => {
    await active({ code: "ONEUSE", usageLimit: 1, usedCount: 1 });
    await expect(resolveCoupon({ code: "ONEUSE", subtotal: 100_000 })).rejects.toThrow(
      /fully claimed/,
    );
  });

  it("lets exactly one of two simultaneous checkouts claim the last use", async () => {
    // The limit is checked inside the update's filter, so this cannot be
    // claimed twice however the two requests interleave.
    await active({ code: "LASTONE", usageLimit: 1, usedCount: 0 });

    const results = await Promise.all([
      claimCouponUse("LASTONE"),
      claimCouponUse("LASTONE"),
      claimCouponUse("LASTONE"),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    const coupon = await Coupon.findOne({ code: "LASTONE" });
    expect(coupon?.usedCount).toBe(1);
  });

  it("enforces a per-user limit by counting that user's orders", async () => {
    await active({ code: "ONEPER", perUserLimit: 1 });
    const user = await makeUser();

    // Not yet used.
    await expect(
      resolveCoupon({ code: "ONEPER", subtotal: 100_000, userId: user._id }),
    ).resolves.toBeTruthy();

    const address = {
      fullName: "A", phone: "9876543210", line1: "1 St", line2: null,
      city: "Bengaluru", state: "Karnataka", pincode: "560001", country: "IN",
    };
    await Order.create({
      orderNumber: "FSH-PERUSR",
      userId: user._id,
      email: user.email,
      items: [{
        variantId: user._id, productId: user._id, sku: "S", nameSnapshot: "n",
        colourSnapshot: "c", sizeSnapshot: "M", imageSnapshot: "/i.jpg",
        unitPrice: 100_000, quantity: 1,
      }],
      pricing: { subtotal: 100_000, discount: 0, shipping: 0, tax: 0, total: 100_000 },
      shippingAddress: address, billingAddress: address,
      status: "paid", couponCode: "ONEPER", idempotencyKey: "peruser-1",
    });

    await expect(
      resolveCoupon({ code: "ONEPER", subtotal: 100_000, userId: user._id }),
    ).rejects.toThrow(/one use per person/);

    // Someone else is unaffected.
    const other = await makeUser();
    await expect(
      resolveCoupon({ code: "ONEPER", subtotal: 100_000, userId: other._id }),
    ).resolves.toBeTruthy();
  });

  it("does not count cancelled or failed orders against a per-user limit", async () => {
    await active({ code: "FAIRLIMIT", perUserLimit: 1 });
    const user = await makeUser();
    const address = {
      fullName: "A", phone: "9876543210", line1: "1 St", line2: null,
      city: "Bengaluru", state: "Karnataka", pincode: "560001", country: "IN",
    };
    await Order.create({
      orderNumber: "FSH-FAILED1",
      userId: user._id,
      email: user.email,
      items: [{
        variantId: user._id, productId: user._id, sku: "S", nameSnapshot: "n",
        colourSnapshot: "c", sizeSnapshot: "M", imageSnapshot: "/i.jpg",
        unitPrice: 100_000, quantity: 1,
      }],
      pricing: { subtotal: 100_000, discount: 0, shipping: 0, tax: 0, total: 100_000 },
      shippingAddress: address, billingAddress: address,
      // A card that was declined should not burn the shopper's one use.
      status: "payment_failed", couponCode: "FAIRLIMIT", idempotencyKey: "failed-1",
    });

    await expect(
      resolveCoupon({ code: "FAIRLIMIT", subtotal: 100_000, userId: user._id }),
    ).resolves.toBeTruthy();
  });
});

describe("shipping, tax and totals", () => {
  it("charges delivery below the threshold and not above it", async () => {
    const under = await computePricing({
      lines: [{ variantId: (await makeUser())._id, quantity: 1, unitPrice: 200_000 }],
    });
    expect(under.shipping).toBe(SHIPPING_FLAT_RATE);
    expect(under.freeShippingShortfall).toBe(FREE_SHIPPING_THRESHOLD - 200_000);

    const over = await computePricing({
      lines: [{ variantId: (await makeUser())._id, quantity: 1, unitPrice: 480_000 }],
    });
    expect(over.shipping).toBe(0);
    expect(over.total).toBe(480_000);
  });

  it("reports GST as the component already inside the price, not on top", async () => {
    // ₹4,800 at 12% inclusive: the tax inside is 4800 × 0.12/1.12 = ₹514.29
    const pricing = await computePricing({
      lines: [{ variantId: (await makeUser())._id, quantity: 1, unitPrice: 480_000 }],
    });
    expect(pricing.tax).toBe(51_429);
    // Crucially, the total is not subtotal + tax.
    expect(pricing.total).toBe(480_000);
  });

  it("uses the lower GST rate on cheaper pieces", async () => {
    // Under ₹1,000 a piece is 5%: 900 × 0.05/1.05 = ₹42.86
    const pricing = await computePricing({
      lines: [{ variantId: (await makeUser())._id, quantity: 1, unitPrice: 90_000 }],
    });
    expect(pricing.tax).toBe(4286);
  });
});

describe("price integrity", () => {
  it("ignores prices and totals sent by the client", async () => {
    const { variant } = await makeVariant({ onHand: 5, priceRupees: 4800 });

    const response = await request(app)
      .post("/api/v1/cart/items")
      .set("Authorization", bearer("tamperer"))
      .send({
        variantId: String(variant._id),
        quantity: 1,
        // Everything below is hostile and must be discarded by zod before it
        // reaches any code that could act on it.
        unitPrice: 1,
        price: 1,
        priceSnapshot: 1,
        lineTotal: 1,
        pricing: { subtotal: 1, total: 1, discount: 999_999 },
      })
      .expect(201);

    expect(response.body.lines[0].unitPrice).toBe(rupeesToPaise(4800));
    expect(response.body.pricing.subtotal).toBe(rupeesToPaise(4800));
    expect(response.body.pricing.discount).toBe(0);
    expect(response.body.pricing.total).toBe(rupeesToPaise(4800));
  });

  it("charges the current price, not the one the bag remembers", async () => {
    // A shopper cannot add an item, wait for a rise, and pay the old price —
    // nor is a drop withheld from them.
    const { variant } = await makeVariant({ onHand: 5, priceRupees: 4800 });
    const user = await makeUser();
    const cart = await getOrCreateCart({ userId: user._id });
    await addItem({ cart, variantId: variant._id, quantity: 1 });

    const { Variant } = await import("../src/models/index.js");
    await Variant.updateOne({ _id: variant._id }, { $set: { price: rupeesToPaise(5200) } });

    const fresh = await getOrCreateCart({ userId: user._id });
    const view = await getCartView(fresh);

    expect(view.lines[0]?.unitPrice).toBe(rupeesToPaise(5200));
    expect(view.pricing.subtotal).toBe(rupeesToPaise(5200));
    // And the change is surfaced rather than silently applied.
    expect(view.lines[0]?.priceChanged).toEqual({
      from: rupeesToPaise(4800),
      to: rupeesToPaise(5200),
    });
    expect(view.notices.join(" ")).toMatch(/gone up/);
  });
});
