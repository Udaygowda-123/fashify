import { describe, expect, it } from "vitest";
import { AppError } from "../src/lib/errors.js";
import { InventoryItem, Reservation, StockMovement } from "../src/models/index.js";
import {
  getAvailabilityFor,
  reconcile,
  release,
  reserve,
} from "../src/services/inventory.service.js";
import { makeCart, makeVariant } from "./factories.js";

const TTL = 20;

/**
 * THE TEST THAT MATTERS MOST.
 *
 * Five units exist. Twenty shoppers reach for one each at the same moment.
 * Exactly five may succeed, fifteen must be told no, and the numbers left
 * behind must be exactly right — because the failure this guards against is
 * not a crash. It is a shop that quietly sells six of five and only finds out
 * when someone has to be emailed an apology.
 *
 * If this passes, the reservation design holds. If it does not, nothing built
 * on top of it can be trusted.
 */
describe("atomic stock reservation under concurrency", () => {
  it("sells exactly five of five when twenty shoppers race for one each", async () => {
    const { variant } = await makeVariant({ onHand: 5 });
    const carts = await Promise.all(Array.from({ length: 20 }, () => makeCart()));

    // Promise.all, not a loop: a loop would await each reservation before
    // starting the next and would pass even with the naive read-then-write.
    const outcomes = await Promise.allSettled(
      carts.map((cart) =>
        reserve({
          cartId: cart._id,
          variantId: variant._id,
          quantity: 1,
          ttlMinutes: TTL,
          label: "Test Piece in M",
        }),
      ),
    );

    const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
    const rejected = outcomes.filter((o) => o.status === "rejected");

    expect(fulfilled).toHaveLength(5);
    expect(rejected).toHaveLength(15);

    // Every failure is the specific, actionable error — not a 500, and not a
    // duplicate-key error leaking out of the reservation upsert.
    for (const outcome of rejected) {
      const reason = (outcome as PromiseRejectedResult).reason as AppError;
      expect(reason).toBeInstanceOf(AppError);
      expect(reason.code).toBe("INSUFFICIENT_STOCK");
      expect(reason.status).toBe(409);
      expect(reason.details).toMatchObject({ requested: 1, available: 0 });
    }

    const availability = await getAvailabilityFor(variant._id);
    expect(availability.onHand).toBe(5);
    expect(availability.reserved).toBe(5);
    expect(availability.available).toBe(0);

    // Five holds, one per winning cart.
    const reservations = await Reservation.find({ variantId: variant._id }).lean();
    expect(reservations).toHaveLength(5);
    expect(reservations.every((r) => r.quantity === 1)).toBe(true);

    // The ledger recorded exactly the five holds that happened, and no row
    // for any of the fifteen that failed. (The opening-stock `receive` row is
    // there too, which is why this counts reserves rather than everything.)
    const reserves = await StockMovement.find({
      variantId: variant._id,
      type: "reserve",
    }).lean();
    expect(reserves).toHaveLength(5);
    expect(reserves.every((m) => m.quantity === 1)).toBe(true);

    // And the ledger agrees with the counters.
    const [row] = await reconcile(variant._id);
    expect(row?.ok).toBe(true);
    expect(row?.ledgerReserved).toBe(5);
  });

  it("never oversells when shoppers ask for more than one at a time", async () => {
    // 10 units, twelve shoppers asking for 3 each. Only three can be satisfied
    // (9 units); the tenth unit is unsellable in a batch of 3 and must stay.
    const { variant } = await makeVariant({ onHand: 10 });
    const carts = await Promise.all(Array.from({ length: 12 }, () => makeCart()));

    const outcomes = await Promise.allSettled(
      carts.map((cart) =>
        reserve({
          cartId: cart._id,
          variantId: variant._id,
          quantity: 3,
          ttlMinutes: TTL,
        }),
      ),
    );

    const won = outcomes.filter((o) => o.status === "fulfilled").length;
    expect(won).toBe(3);

    const availability = await getAvailabilityFor(variant._id);
    expect(availability.reserved).toBe(9);
    expect(availability.available).toBe(1);
    // The invariant that matters: never more held than exist.
    expect(availability.reserved).toBeLessThanOrEqual(availability.onHand);
  });

  it("keeps one cart's own repeated adds correct", async () => {
    // Same cart, five concurrent "add one more" on a variant with 3 units.
    // The unique index on (cartId, variantId) means these all target one
    // reservation row; the total held must still be 3, not 5.
    const { variant } = await makeVariant({ onHand: 3 });
    const cart = await makeCart();

    const outcomes = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        reserve({
          cartId: cart._id,
          variantId: variant._id,
          quantity: 1,
          ttlMinutes: TTL,
        }),
      ),
    );

    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(3);

    const availability = await getAvailabilityFor(variant._id);
    expect(availability.reserved).toBe(3);
    expect(availability.available).toBe(0);

    const reservations = await Reservation.find({ cartId: cart._id }).lean();
    expect(reservations).toHaveLength(1);
    expect(reservations[0]?.quantity).toBe(3);
  });

  it("returns units to the pool so a later shopper can have them", async () => {
    const { variant } = await makeVariant({ onHand: 2 });
    const first = await makeCart();
    const second = await makeCart();

    await reserve({ cartId: first._id, variantId: variant._id, quantity: 2, ttlMinutes: TTL });
    await expect(
      reserve({ cartId: second._id, variantId: variant._id, quantity: 1, ttlMinutes: TTL }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });

    await release({
      cartId: first._id,
      variantId: variant._id,
      quantity: 2,
      reason: "shopper removed it",
    });

    const after = await getAvailabilityFor(variant._id);
    expect(after.reserved).toBe(0);
    expect(after.available).toBe(2);

    // Now the second shopper can have one.
    await expect(
      reserve({ cartId: second._id, variantId: variant._id, quantity: 1, ttlMinutes: TTL }),
    ).resolves.toMatchObject({ reserved: 1 });

    const [row] = await reconcile(variant._id);
    expect(row?.ok).toBe(true);
  });

  it("treats a double release as a no-op rather than driving reserved negative", async () => {
    // A negative `reserved` would inflate `available` and let the shop
    // oversell, so releasing twice must not be allowed to do it.
    const { variant } = await makeVariant({ onHand: 4 });
    const cart = await makeCart();
    await reserve({ cartId: cart._id, variantId: variant._id, quantity: 2, ttlMinutes: TTL });

    const twice = { cartId: cart._id, variantId: variant._id, quantity: 2, reason: "double" };
    await release(twice);
    await release(twice);

    const after = await getAvailabilityFor(variant._id);
    expect(after.reserved).toBe(0);
    expect(after.available).toBe(4);
    expect(after.reserved).toBeGreaterThanOrEqual(0);

    // Only one release reached the ledger, so the ledger still reconciles.
    const releases = await StockMovement.countDocuments({
      variantId: variant._id,
      type: "release",
    });
    expect(releases).toBe(1);
    const [row] = await reconcile(variant._id);
    expect(row?.ok).toBe(true);
  });

  it("refuses to reserve anything from a sold-out variant", async () => {
    const { variant } = await makeVariant({ onHand: 0 });
    const cart = await makeCart();

    await expect(
      reserve({
        cartId: cart._id,
        variantId: variant._id,
        quantity: 1,
        ttlMinutes: TTL,
        label: "Test Piece in M",
      }),
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
      details: { available: 0 },
    });

    // Nothing was written on the way to failing.
    expect(await StockMovement.countDocuments({ variantId: variant._id })).toBe(0);
    expect(await Reservation.countDocuments({ variantId: variant._id })).toBe(0);
    const item = await InventoryItem.findOne({ variantId: variant._id }).lean();
    expect(item?.reserved).toBe(0);
  });
});
