import { describe, expect, it } from "vitest";
import { releaseExpiredReservations } from "../src/jobs/release-expired-reservations.js";
import { InventoryItem, Reservation, StockMovement } from "../src/models/index.js";
import {
  getAvailabilityFor,
  reconcile,
  reserve,
} from "../src/services/inventory.service.js";
import { makeCart, makeVariant } from "./factories.js";

/**
 * Proves the sweeper does what a TTL index cannot.
 *
 * A TTL index would delete the reservation and leave `reserved` untouched —
 * stock held forever with no record. These tests assert the units actually come
 * back, that the ledger records it, and that running the sweep twice does not
 * give the same units back twice.
 */
describe("expired reservations are released, not just deleted", () => {
  it("returns held units to the sellable pool once the hold lapses", async () => {
    const { variant } = await makeVariant({ onHand: 6 });
    const cart = await makeCart();

    await reserve({ cartId: cart._id, variantId: variant._id, quantity: 4, ttlMinutes: 20 });
    expect((await getAvailabilityFor(variant._id)).available).toBe(2);

    // Fast-forward by expiring the hold rather than by waiting 20 minutes.
    await Reservation.updateOne(
      { cartId: cart._id, variantId: variant._id },
      { $set: { expiresAt: new Date(Date.now() - 60_000) } },
    );

    const result = await releaseExpiredReservations();
    expect(result.released).toBe(1);
    expect(result.units).toBe(4);

    const after = await getAvailabilityFor(variant._id);
    expect(after.reserved).toBe(0);
    expect(after.available).toBe(6);

    // The reservation is gone AND the release is in the ledger. A TTL index
    // would have achieved the first half only.
    expect(await Reservation.countDocuments({ cartId: cart._id })).toBe(0);
    const releases = await StockMovement.find({
      variantId: variant._id,
      type: "release",
    }).lean();
    expect(releases).toHaveLength(1);
    expect(releases[0]?.quantity).toBe(-4);

    const [row] = await reconcile(variant._id);
    expect(row?.ok).toBe(true);
  });

  it("leaves live holds alone", async () => {
    const { variant } = await makeVariant({ onHand: 5 });
    const cart = await makeCart();
    await reserve({ cartId: cart._id, variantId: variant._id, quantity: 2, ttlMinutes: 20 });

    const result = await releaseExpiredReservations();
    expect(result.released).toBe(0);
    expect((await getAvailabilityFor(variant._id)).available).toBe(3);
  });

  it("is safe to run twice, and twice at once", async () => {
    const { variant } = await makeVariant({ onHand: 10 });
    const cart = await makeCart();
    await reserve({ cartId: cart._id, variantId: variant._id, quantity: 5, ttlMinutes: 20 });
    await Reservation.updateOne(
      { cartId: cart._id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    // Two sweepers racing. Exactly one may return the units: the claim step
    // (`releasedAt: null` in the filter) is what decides it.
    const [a, b] = await Promise.all([
      releaseExpiredReservations(),
      releaseExpiredReservations(),
    ]);

    expect(a.units + b.units).toBe(5);

    const after = await getAvailabilityFor(variant._id);
    expect(after.reserved).toBe(0);
    expect(after.available).toBe(10);

    // One release row, not two — so the ledger still balances.
    expect(
      await StockMovement.countDocuments({ variantId: variant._id, type: "release" }),
    ).toBe(1);
    const [row] = await reconcile(variant._id);
    expect(row?.ok).toBe(true);
  });

  it("finishes a sweep that was interrupted after claiming a row", async () => {
    // Simulates a crash between "claim" and "delete": the row is left with
    // releasedAt set. The next pass must delete it and must NOT decrement
    // again.
    const { variant } = await makeVariant({ onHand: 8 });
    const cart = await makeCart();
    await reserve({ cartId: cart._id, variantId: variant._id, quantity: 3, ttlMinutes: 20 });

    // Hand the units back and stamp the row, as a half-finished sweep would.
    await InventoryItem.updateOne({ variantId: variant._id }, { $inc: { reserved: -3 } });
    await StockMovement.create({
      variantId: variant._id,
      type: "release",
      quantity: -3,
      reason: "hold expired before checkout",
      refType: "cart",
      refId: cart._id,
    });
    await Reservation.updateOne(
      { cartId: cart._id },
      { $set: { releasedAt: new Date(), expiresAt: new Date(Date.now() - 1000) } },
    );

    const result = await releaseExpiredReservations();
    expect(result.released).toBe(1);
    // No second decrement: the units were already back.
    expect(result.units).toBe(0);

    const after = await getAvailabilityFor(variant._id);
    expect(after.reserved).toBe(0);
    expect(after.available).toBe(8);
    expect(await Reservation.countDocuments({})).toBe(0);
    const [row] = await reconcile(variant._id);
    expect(row?.ok).toBe(true);
  });

  it("lets a waiting shopper buy what an abandoned bag was holding", async () => {
    const { variant } = await makeVariant({ onHand: 1 });
    const abandoned = await makeCart();
    const waiting = await makeCart();

    await reserve({ cartId: abandoned._id, variantId: variant._id, quantity: 1, ttlMinutes: 20 });
    await expect(
      reserve({ cartId: waiting._id, variantId: variant._id, quantity: 1, ttlMinutes: 20 }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });

    await Reservation.updateOne(
      { cartId: abandoned._id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    await releaseExpiredReservations();

    await expect(
      reserve({ cartId: waiting._id, variantId: variant._id, quantity: 1, ttlMinutes: 20 }),
    ).resolves.toMatchObject({ reserved: 1 });
  });
});
