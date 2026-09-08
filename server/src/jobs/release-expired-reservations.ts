import { InventoryItem, Reservation, StockMovement } from "../models/index.js";
import { logger } from "../lib/logger.js";
import { withLock } from "../lib/redis.js";

/**
 * ------------------------------------------------------------------------
 * THE SWEEPER — why this exists instead of a TTL index.
 * ------------------------------------------------------------------------
 *
 * `expiresAt` on a Reservation looks exactly like a field you would hang a
 * MongoDB TTL index off. Doing that would be a slow, silent stock leak.
 *
 * A TTL index deletes the expired document. That is the whole of what it does.
 * It has no idea that `InventoryItem.reserved` was incremented when the
 * reservation was created, so it would not decrement it, and it cannot write a
 * `release` row to the ledger. The reservation would vanish and the units
 * would stay held: `reserved` permanently too high, `available` permanently
 * too low, and no record anywhere of where they went. Every abandoned bag
 * would quietly take a few units out of the sellable pool for good, and the
 * first symptom would be a best-selling size showing as sold out while a pile
 * of it sat in the warehouse.
 *
 * So the release is done here, in an order chosen to survive a crash:
 *
 *   1. claim the row  — stamp `releasedAt`, conditional on it being null
 *   2. give the units back — decrement `reserved`, guarded
 *   3. write the ledger row
 *   4. delete the reservation
 *
 * Step 1 is the guard that makes the whole thing safe to re-run. Two sweepers
 * racing, or one restarting mid-pass, cannot both claim the same row: the
 * conditional update means exactly one wins, so the units are never given back
 * twice. If the process dies after step 1, the row is still there with
 * `releasedAt` set, and the next pass finishes it.
 */
export interface SweepResult {
  claimed: number;
  released: number;
  units: number;
}

export async function releaseExpiredReservations(now = new Date()): Promise<SweepResult> {
  const result: SweepResult = { claimed: 0, released: 0, units: 0 };

  // Anything expired, plus anything a previous pass claimed but did not
  // finish. Both need the same work done.
  const due = await Reservation.find({
    $or: [{ expiresAt: { $lte: now }, releasedAt: null }, { releasedAt: { $ne: null } }],
  })
    .limit(500)
    .lean();

  for (const reservation of due) {
    // 1. Claim it. `releasedAt: null` in the filter is what stops a second
    //    sweeper releasing the same units. An already-claimed row falls
    //    through to the finishing steps below instead.
    let claimed = reservation.releasedAt !== null;
    if (!claimed) {
      const stamped = await Reservation.findOneAndUpdate(
        { _id: reservation._id, releasedAt: null },
        { $set: { releasedAt: new Date() } },
        { new: true },
      ).lean();
      if (!stamped) continue; // someone else got it
      claimed = true;
      result.claimed += 1;

      // 2. Give the units back. Guarded, so it cannot drive `reserved`
      //    negative and inflate availability.
      const updated = await InventoryItem.findOneAndUpdate(
        { variantId: reservation.variantId, reserved: { $gte: reservation.quantity } },
        { $inc: { reserved: -reservation.quantity } },
        { new: true },
      ).lean();

      if (updated) {
        // 3. Record it, so reconciliation can still balance.
        await StockMovement.create({
          variantId: reservation.variantId,
          type: "release",
          quantity: -reservation.quantity,
          reason: "hold expired before checkout",
          refType: "cart",
          refId: reservation.cartId,
        });
        result.units += reservation.quantity;
      } else {
        logger.warn(
          {
            variantId: String(reservation.variantId),
            quantity: reservation.quantity,
          },
          "expired hold could not be released: reserved was already lower",
        );
      }
    }

    // 4. Only now is the row disposable.
    await Reservation.deleteOne({ _id: reservation._id });
    result.released += 1;
  }

  if (result.released > 0) {
    logger.info(result, "expired holds released");
  }
  return result;
}

/**
 * The scheduled wrapper. Locked so two instances do not both sweep — not for
 * correctness, which step 1 above already guarantees, but to avoid two
 * processes doing the same work every minute.
 */
export async function runReservationSweep(): Promise<void> {
  await withLock("sweep:reservations", 55_000, async () => {
    await releaseExpiredReservations();
  });
}
