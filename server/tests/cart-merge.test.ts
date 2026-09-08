import { describe, expect, it } from "vitest";
import { Cart, Reservation } from "../src/models/index.js";
import {
  addItem,
  getCartView,
  getOrCreateCart,
  mergeGuestCart,
} from "../src/services/cart.service.js";
import { getAvailabilityFor, reconcile } from "../src/services/inventory.service.js";
import { makeUser, makeVariant } from "./factories.js";

/**
 * Merging is where bags get silently lost in most shops: quantities are summed
 * without re-checking stock, or the guest bag is simply discarded. Both are
 * ways to lose a sale that the shopper had already decided to make, and the
 * second one they will not even notice until the order arrives short.
 */
describe("guest bag merges into the signed-in bag", () => {
  it("sums quantities for the same size and holds the total", async () => {
    const { variant } = await makeVariant({ onHand: 10 });
    const user = await makeUser();

    const guest = await getOrCreateCart({ guestToken: "guest-merge-1" });
    await addItem({ cart: guest, variantId: variant._id, quantity: 2 });

    const mine = await getOrCreateCart({ userId: user._id });
    await addItem({ cart: mine, variantId: variant._id, quantity: 1 });

    const report = await mergeGuestCart({ guestToken: "guest-merge-1", userId: user._id });

    const view = await getCartView(report.cart);
    expect(view.lines).toHaveLength(1);
    expect(view.lines[0]?.quantity).toBe(3);
    expect(report.dropped).toEqual([]);

    // The merged bag holds exactly three, not five: the guest's own hold was
    // released as its lines moved across, so nothing is double-counted.
    const stock = await getAvailabilityFor(variant._id);
    expect(stock.reserved).toBe(3);
    expect(stock.available).toBe(7);

    // The guest bag is gone, and so are its holds.
    expect(await Cart.countDocuments({ guestToken: "guest-merge-1" })).toBe(0);
    expect(await Reservation.countDocuments({ cartId: guest._id })).toBe(0);

    const [row] = await reconcile(variant._id);
    expect(row?.ok).toBe(true);
  });

  it("keeps different sizes as separate lines", async () => {
    const first = await makeVariant({ onHand: 5, size: "M" });
    const second = await makeVariant({
      productId: first.productId,
      onHand: 5,
      size: "L",
    });
    const user = await makeUser();

    const guest = await getOrCreateCart({ guestToken: "guest-merge-2" });
    await addItem({ cart: guest, variantId: second.variant._id, quantity: 1 });

    const mine = await getOrCreateCart({ userId: user._id });
    await addItem({ cart: mine, variantId: first.variant._id, quantity: 1 });

    const report = await mergeGuestCart({ guestToken: "guest-merge-2", userId: user._id });
    const view = await getCartView(report.cart);

    expect(view.lines).toHaveLength(2);
    expect(view.itemCount).toBe(2);
  });

  it("reduces a line to what is left and says so", async () => {
    /**
     * Two live bags can never want more than exists — each one had to reserve
     * successfully to hold anything. The realistic way a merge comes up short
     * is that the guest's hold lapsed while they were away and someone else
     * took the units, which is what this sets up.
     */
    const { variant } = await makeVariant({ onHand: 4 });
    const user = await makeUser();

    const guest = await getOrCreateCart({ guestToken: "guest-merge-3" });
    await addItem({ cart: guest, variantId: variant._id, quantity: 3 });

    // The guest wanders off and the hold expires.
    const { releaseExpiredReservations } = await import(
      "../src/jobs/release-expired-reservations.js"
    );
    await Reservation.updateMany(
      { cartId: guest._id },
      { $set: { expiresAt: new Date(Date.now() - 60_000) } },
    );
    await releaseExpiredReservations();

    // Someone else takes two of the four.
    const rival = await getOrCreateCart({ guestToken: "rival-3" });
    await addItem({ cart: rival, variantId: variant._id, quantity: 2 });

    const report = await mergeGuestCart({ guestToken: "guest-merge-3", userId: user._id });
    const view = await getCartView(report.cart);

    // Two of the three wanted units survive, and the shortfall is reported
    // rather than silently swallowed.
    expect(view.lines[0]?.quantity).toBe(2);
    expect(report.dropped).toHaveLength(1);
    expect(report.dropped[0]).toMatchObject({ wanted: 3, kept: 2 });
    expect(report.dropped[0]?.reason).toContain("only 2 were left");

    const stock = await getAvailabilityFor(variant._id);
    expect(stock.reserved).toBe(4);
    expect(stock.available).toBe(0);

    const [row] = await reconcile(variant._id);
    expect(row?.ok).toBe(true);
  });

  it("reports a line that sold out entirely while the guest was away", async () => {
    const { variant } = await makeVariant({ onHand: 2 });
    const user = await makeUser();

    const guest = await getOrCreateCart({ guestToken: "guest-merge-4" });
    await addItem({ cart: guest, variantId: variant._id, quantity: 2 });

    // Someone else takes the lot while the guest is signing in.
    const rival = await getOrCreateCart({ guestToken: "rival" });
    // Free the guest's hold first so the rival can actually take them, which
    // is what happens when the guest's hold expires.
    await Reservation.deleteMany({ cartId: guest._id });
    const { InventoryItem } = await import("../src/models/index.js");
    await InventoryItem.updateOne({ variantId: variant._id }, { $set: { reserved: 0 } });
    await addItem({ cart: rival, variantId: variant._id, quantity: 2 });

    const report = await mergeGuestCart({ guestToken: "guest-merge-4", userId: user._id });
    const view = await getCartView(report.cart);

    expect(view.lines).toHaveLength(0);
    expect(report.dropped).toHaveLength(1);
    expect(report.dropped[0]?.kept).toBe(0);
    expect(report.dropped[0]?.reason).toContain("sold out");
  });

  it("does nothing harmful when the guest bag is empty or absent", async () => {
    const user = await makeUser();
    const mine = await getOrCreateCart({ userId: user._id });
    const { variant } = await makeVariant({ onHand: 3 });
    await addItem({ cart: mine, variantId: variant._id, quantity: 1 });

    const report = await mergeGuestCart({ guestToken: "never-existed", userId: user._id });
    const view = await getCartView(report.cart);

    expect(view.lines).toHaveLength(1);
    expect(report.dropped).toEqual([]);
  });

  it("carries the guest's coupon over only when the user has none", async () => {
    const { variant } = await makeVariant({ onHand: 5, priceRupees: 4800 });
    const user = await makeUser();

    const guest = await getOrCreateCart({ guestToken: "guest-merge-5" });
    await addItem({ cart: guest, variantId: variant._id, quantity: 1 });
    await Cart.updateOne({ _id: guest._id }, { $set: { couponCode: "WELCOME10" } });

    const report = await mergeGuestCart({ guestToken: "guest-merge-5", userId: user._id });
    expect(report.cart.couponCode).toBe("WELCOME10");
  });
});
