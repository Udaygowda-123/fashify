import { Schema, model, type InferSchemaType, type Model, type Types } from "mongoose";

/**
 * A cart's claim on some units of a variant, with an expiry.
 *
 * WHY THERE IS NO TTL INDEX ON `expiresAt`, even though that is exactly what a
 * TTL index looks like it is for:
 *
 * MongoDB's TTL monitor deletes the expired *document*. That is all it does.
 * It would not decrement `reserved` on the matching InventoryItem, and it
 * would not write a `release` row to the ledger. So the reservation would
 * vanish while the units stayed held — `reserved` permanently too high,
 * `available` permanently too low, and no record of where the units went.
 * Stock would leak out of the sellable pool a few units at a time, silently,
 * for as long as the shop ran, and the ledger would not even show it.
 *
 * The sweeper in `jobs/release-expired-reservations.ts` does it in the order
 * that survives a crash: decrement `reserved` first, write the `release`
 * movement, then delete the reservation. If the process dies between any two
 * steps the reservation is still there, so the next run picks it up again —
 * and the decrement is guarded so it cannot run twice for the same row.
 *
 * The index below is therefore a plain one, for the sweeper's query. It is
 * deliberately not `expireAfterSeconds`.
 */
const reservationSchema = new Schema(
  {
    cartId: {
      type: Schema.Types.ObjectId,
      ref: "Cart",
      required: true,
    },

    variantId: {
      type: Schema.Types.ObjectId,
      ref: "Variant",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: [1, "a reservation of zero units is not a reservation"],
    },

    /** When the hold lapses. Extended while the shopper is in checkout. */
    expiresAt: {
      type: Date,
      required: true,
    },

    /**
     * Set by the sweeper the moment it has decremented `reserved`, before it
     * deletes the row. If the process dies in between, the retry sees this and
     * skips the decrement instead of releasing the same units twice.
     */
    releasedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, collection: "reservations" },
);

/**
 * The sweeper's query: expired and not yet released. NOT a TTL index — see the
 * comment above; `expireAfterSeconds` here would leak stock.
 */
reservationSchema.index({ expiresAt: 1, releasedAt: 1 });

/** Releasing a whole cart, on checkout completion or abandonment. */
reservationSchema.index({ cartId: 1 });

/**
 * One live reservation row per cart-and-variant, so "add one more" updates the
 * existing hold instead of accumulating rows that each have to be released.
 */
reservationSchema.index({ cartId: 1, variantId: 1 }, { unique: true });

export type ReservationDoc = InferSchemaType<typeof reservationSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Reservation: Model<ReservationDoc> =
  model<ReservationDoc>("Reservation", reservationSchema);
