import type { ClientSession, Types } from "mongoose";
import { InsufficientStockError, NotFoundError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import {
  InventoryItem,
  Reservation,
  StockMovement,
  Variant,
  type MovementRefType,
  type MovementType,
} from "../models/index.js";

/**
 * Which counter each movement type moves. Kept here rather than stored on the
 * row, so a movement cannot be written with a type that disagrees with its own
 * effect.
 *
 * `fulfil` touches both: paying for a held unit takes it off the shelf and
 * releases the hold in one event, so it is one row counted on two axes.
 */
export const MOVEMENT_AXES: Record<MovementType, { onHand: boolean; reserved: boolean }> = {
  receive: { onHand: true, reserved: false },
  reserve: { onHand: false, reserved: true },
  release: { onHand: false, reserved: true },
  fulfil: { onHand: true, reserved: true },
  return: { onHand: true, reserved: false },
  adjust: { onHand: true, reserved: false },
};

export interface MovementInput {
  variantId: Types.ObjectId;
  type: MovementType;
  /** Signed, in units. */
  quantity: number;
  reason: string;
  refType: MovementRefType;
  refId?: Types.ObjectId | null;
  actorId?: Types.ObjectId | null;
}

/** Appends to the ledger. Never updates; there is no code path that can. */
async function recordMovement(
  input: MovementInput,
  session?: ClientSession,
): Promise<void> {
  await StockMovement.create(
    [
      {
        variantId: input.variantId,
        type: input.type,
        quantity: input.quantity,
        reason: input.reason,
        refType: input.refType,
        refId: input.refId ?? null,
        actorId: input.actorId ?? null,
      },
    ],
    session ? { session } : {},
  );
}

export interface Availability {
  variantId: string;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
}

function toAvailability(doc: {
  variantId: Types.ObjectId;
  onHand: number;
  reserved: number;
  lowStockThreshold: number;
}): Availability {
  return {
    variantId: doc.variantId.toString(),
    onHand: doc.onHand,
    reserved: doc.reserved,
    // Derived, always. Never read from a stored field.
    available: doc.onHand - doc.reserved,
    lowStockThreshold: doc.lowStockThreshold,
  };
}

export async function getAvailability(
  variantIds: Types.ObjectId[],
): Promise<Map<string, Availability>> {
  const items = await InventoryItem.find({ variantId: { $in: variantIds } }).lean();
  const map = new Map<string, Availability>();
  for (const item of items) {
    map.set(item.variantId.toString(), toAvailability(item));
  }
  return map;
}

export async function getAvailabilityFor(
  variantId: Types.ObjectId,
): Promise<Availability> {
  const item = await InventoryItem.findOne({ variantId }).lean();
  if (!item) throw new NotFoundError("Stock for that piece");
  return toAvailability(item);
}

/**
 * ------------------------------------------------------------------------
 * THE ATOMIC RESERVATION — the one mechanism the whole shop rests on.
 * ------------------------------------------------------------------------
 *
 * The wrong way, which reads perfectly naturally:
 *
 *     const item = await InventoryItem.findOne({ variantId });
 *     if (item.onHand - item.reserved >= quantity) {     // (A)
 *       item.reserved += quantity;                        // (B)
 *       await item.save();
 *     }
 *
 * Two requests for the last unit both run (A) against `available === 1`, both
 * decide yes, and both run (B). The shop has now sold one overshirt twice, and
 * nothing in the data says anything went wrong. The gap between the read and
 * the write is the entire bug, and no amount of `await` ordering closes it —
 * it is a race between two processes, not two lines.
 *
 * The right way is to never let that gap exist: express the condition and the
 * change as ONE update, and let the database arbitrate. `findOneAndUpdate`
 * with the availability test inside the *filter* means MongoDB matches the
 * document and increments it as a single atomic operation on that document.
 * Writes to one document are serialised, so of two concurrent callers exactly
 * one can match — the other finds the filter no longer true, changes nothing,
 * and gets `null` back. `null` is the answer "someone else got it".
 *
 * `$expr` is what lets the filter compare two fields of the same document.
 * A plain `{ onHand: { $gte: quantity } }` would ignore units already held by
 * other people's bags.
 *
 * Note there is no transaction here, deliberately. A transaction would add
 * write conflicts and retries for no benefit: a single-document conditional
 * update is already atomic, and it stays correct under any level of
 * concurrency without ever needing to be retried.
 */
export interface ReserveInput {
  cartId: Types.ObjectId;
  variantId: Types.ObjectId;
  /** Units to add to this cart's hold. Must be positive. */
  quantity: number;
  ttlMinutes: number;
  /** For the error message: "Only 2 of the Ecru Overshirt in M left." */
  label?: string;
}

export async function reserve(input: ReserveInput): Promise<Availability> {
  const { cartId, variantId, quantity, ttlMinutes, label } = input;
  if (quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error("reserve() takes a positive whole number of units");
  }

  const updated = await InventoryItem.findOneAndUpdate(
    {
      variantId,
      // available >= quantity, evaluated against this document, atomically
      // with the increment below.
      $expr: { $gte: [{ $subtract: ["$onHand", "$reserved"] }, quantity] },
    },
    { $inc: { reserved: quantity } },
    { new: true },
  ).lean();

  if (!updated) {
    // Nothing changed. Read the current numbers only to tell the shopper how
    // many are actually left — this read is for the message, never for the
    // decision.
    const current = await InventoryItem.findOne({ variantId }).lean();
    throw new InsufficientStockError({
      variantId: variantId.toString(),
      requested: quantity,
      available: current ? Math.max(0, current.onHand - current.reserved) : 0,
      label,
    });
  }

  /**
   * Ordering from here is chosen so a crash can only ever fail SAFE.
   *
   * `reserved` has already gone up. If the process dies before the reservation
   * row is written, we are left holding units that no cart claims: `reserved`
   * too high, `available` too low. The shop under-sells by a unit until the
   * reconciliation check notices, and nothing is oversold.
   *
   * Writing the reservation row first would invert that: a row claiming units
   * that `reserved` never counted, which the sweeper would later "release",
   * pushing `reserved` below the truth and making `available` too HIGH — an
   * oversell waiting to happen. Between leaking a unit and overselling one,
   * leak every time.
   */
  await recordMovement({
    variantId,
    type: "reserve",
    quantity,
    reason: `held for cart ${cartId.toString()}`,
    refType: "cart",
    refId: cartId,
  });

  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  await Reservation.findOneAndUpdate(
    { cartId, variantId },
    {
      $inc: { quantity },
      $set: { expiresAt, releasedAt: null },
      $setOnInsert: { cartId, variantId },
    },
    { upsert: true, new: true },
  );

  return toAvailability(updated);
}

/**
 * Gives units back to the sellable pool. Used when a shopper removes an item,
 * when the sweeper finds an expired hold, and when an unpaid order is
 * cancelled.
 *
 * The guard on `reserved` matters: without it, a release that ran twice would
 * drive `reserved` negative, which inflates `available` and lets the shop
 * oversell. The conditional filter makes a double release a no-op instead.
 */
export async function release(input: {
  cartId: Types.ObjectId;
  variantId: Types.ObjectId;
  quantity: number;
  reason: string;
}): Promise<void> {
  const { cartId, variantId, quantity, reason } = input;
  if (quantity <= 0) return;

  const updated = await InventoryItem.findOneAndUpdate(
    { variantId, reserved: { $gte: quantity } },
    { $inc: { reserved: -quantity } },
    { new: true },
  ).lean();

  if (!updated) {
    // Already released, or never held. Not an error — releasing is idempotent
    // by design, because the sweeper has to be safe to re-run.
    logger.warn(
      { variantId: variantId.toString(), quantity },
      "release skipped: reserved was already below the amount to release",
    );
    return;
  }

  await recordMovement({
    variantId,
    type: "release",
    quantity: -quantity,
    reason,
    refType: "cart",
    refId: cartId,
  });
}

/**
 * Payment succeeded: the hold becomes a permanent decrement. `onHand` drops
 * because the piece is leaving the building, and `reserved` drops because it is
 * no longer merely held.
 *
 * Guarded on both counters so a replayed webhook cannot decrement twice — the
 * second attempt finds the filter false and changes nothing.
 */
export async function fulfil(input: {
  orderId: Types.ObjectId;
  variantId: Types.ObjectId;
  quantity: number;
  reason?: string;
}): Promise<boolean> {
  const { orderId, variantId, quantity } = input;
  if (quantity <= 0) return false;

  const updated = await InventoryItem.findOneAndUpdate(
    { variantId, onHand: { $gte: quantity }, reserved: { $gte: quantity } },
    { $inc: { onHand: -quantity, reserved: -quantity } },
    { new: true },
  ).lean();

  if (!updated) {
    logger.warn(
      { variantId: variantId.toString(), quantity, orderId: orderId.toString() },
      "fulfil skipped: counters no longer permit it (already fulfilled?)",
    );
    return false;
  }

  await recordMovement({
    variantId,
    type: "fulfil",
    quantity: -quantity,
    reason: input.reason ?? `committed to order ${orderId.toString()}`,
    refType: "order",
    refId: orderId,
  });
  return true;
}

/** Goods arrived, or a return came back sellable. */
export async function receive(input: {
  variantId: Types.ObjectId;
  quantity: number;
  reason: string;
  refType: MovementRefType;
  refId?: Types.ObjectId | null;
  actorId?: Types.ObjectId | null;
  type?: Extract<MovementType, "receive" | "return">;
}): Promise<Availability> {
  const { variantId, quantity } = input;
  if (quantity <= 0) throw new Error("receive() takes a positive number of units");

  const updated = await InventoryItem.findOneAndUpdate(
    { variantId },
    { $inc: { onHand: quantity } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

  await recordMovement({
    variantId,
    type: input.type ?? "receive",
    quantity,
    reason: input.reason,
    refType: input.refType,
    refId: input.refId ?? null,
    actorId: input.actorId ?? null,
  });

  return toAvailability(updated);
}

/**
 * A human corrected the count — a stocktake, breakage, a miscount on delivery.
 * Signed, and it cannot take `onHand` below what is already reserved, because
 * those units are promised to live bags.
 */
export async function adjust(input: {
  variantId: Types.ObjectId;
  delta: number;
  reason: string;
  actorId?: Types.ObjectId | null;
}): Promise<Availability> {
  const { variantId, delta, reason, actorId } = input;
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error("adjust() takes a non-zero whole number");
  }

  const filter =
    delta < 0
      ? {
          variantId,
          // onHand + delta >= reserved
          $expr: { $gte: [{ $add: ["$onHand", delta] }, "$reserved"] },
        }
      : { variantId };

  const updated = await InventoryItem.findOneAndUpdate(
    filter,
    { $inc: { onHand: delta } },
    { new: true },
  ).lean();

  if (!updated) {
    const current = await InventoryItem.findOne({ variantId }).lean();
    if (!current) throw new NotFoundError("Stock for that piece");
    throw new InsufficientStockError({
      variantId: variantId.toString(),
      requested: Math.abs(delta),
      available: Math.max(0, current.onHand - current.reserved),
      label: "count to adjust down by",
    });
  }

  await recordMovement({
    variantId,
    type: "adjust",
    quantity: delta,
    reason,
    refType: "manual",
    actorId: actorId ?? null,
  });

  return toAvailability(updated);
}

/** Creates the inventory row for a new variant. Idempotent. */
export async function ensureInventoryItem(
  variantId: Types.ObjectId,
  lowStockThreshold = 3,
): Promise<void> {
  await InventoryItem.updateOne(
    { variantId },
    { $setOnInsert: { variantId, onHand: 0, reserved: 0, lowStockThreshold } },
    { upsert: true },
  );
}

/**
 * ------------------------------------------------------------------------
 * RECONCILIATION — replays the ledger and compares it to the counters.
 * ------------------------------------------------------------------------
 *
 * This is the pay-off for keeping a ledger at all. `onHand` and `reserved` are
 * caches of a history; if the history and the caches disagree, something wrote
 * a counter without recording why, or crashed between the two. Either way it is
 * a bug, and this is what makes it visible instead of surfacing months later as
 * an oversold order.
 *
 * The two sums are taken over different movement types — see MOVEMENT_AXES.
 * Summing every row against `onHand` would be wrong: a `reserve` never touched
 * `onHand`.
 */
export interface ReconciliationRow {
  variantId: string;
  sku?: string;
  storedOnHand: number;
  ledgerOnHand: number;
  storedReserved: number;
  ledgerReserved: number;
  onHandDrift: number;
  reservedDrift: number;
  ok: boolean;
}

export async function reconcile(variantId?: Types.ObjectId): Promise<ReconciliationRow[]> {
  const onHandTypes = (Object.keys(MOVEMENT_AXES) as MovementType[]).filter(
    (type) => MOVEMENT_AXES[type].onHand,
  );
  const reservedTypes = (Object.keys(MOVEMENT_AXES) as MovementType[]).filter(
    (type) => MOVEMENT_AXES[type].reserved,
  );

  const match = variantId ? { variantId } : {};

  const ledger = await StockMovement.aggregate<{
    _id: Types.ObjectId;
    ledgerOnHand: number;
    ledgerReserved: number;
  }>([
    { $match: match },
    {
      $group: {
        _id: "$variantId",
        ledgerOnHand: {
          $sum: {
            $cond: [{ $in: ["$type", onHandTypes] }, "$quantity", 0],
          },
        },
        ledgerReserved: {
          $sum: {
            $cond: [{ $in: ["$type", reservedTypes] }, "$quantity", 0],
          },
        },
      },
    },
  ]);

  const ledgerByVariant = new Map(ledger.map((row) => [row._id.toString(), row]));

  const items = await InventoryItem.find(variantId ? { variantId } : {}).lean();
  const variants = await Variant.find({
    _id: { $in: items.map((item) => item.variantId) },
  })
    .select("sku")
    .lean();
  const skuById = new Map(variants.map((v) => [v._id.toString(), v.sku]));

  const rows: ReconciliationRow[] = items.map((item) => {
    const key = item.variantId.toString();
    const sums = ledgerByVariant.get(key);
    const ledgerOnHand = sums?.ledgerOnHand ?? 0;
    const ledgerReserved = sums?.ledgerReserved ?? 0;
    const onHandDrift = item.onHand - ledgerOnHand;
    const reservedDrift = item.reserved - ledgerReserved;
    return {
      variantId: key,
      sku: skuById.get(key),
      storedOnHand: item.onHand,
      ledgerOnHand,
      storedReserved: item.reserved,
      ledgerReserved,
      onHandDrift,
      reservedDrift,
      ok: onHandDrift === 0 && reservedDrift === 0,
    };
  });

  return rows;
}
