import { Schema, model, type InferSchemaType, type Model, type Types } from "mongoose";
import { MOVEMENT_REF_TYPES, MOVEMENT_TYPES } from "./types.js";

/**
 * The stock ledger. Append-only: nothing in the codebase updates or deletes a
 * movement, and there is no code path that can.
 *
 * WHY A LEDGER. `InventoryItem` holds two numbers, and numbers on their own
 * cannot answer the question you actually have at 2am: *why* is this 3 and not
 * 5. A row per change turns that into a readable history — this bag reserved
 * two, that sweep released one, this order committed one — and lets the
 * numbers be rebuilt from scratch and compared against what is stored. That
 * comparison is the reconciliation endpoint, and it is the only way to catch
 * silent drift rather than discovering it from an oversold order.
 *
 * THE INVARIANT, precisely. `quantity` is signed, and which counter a movement
 * moves is decided by its `type`, not by an extra field:
 *
 *   sum(quantity) over types receive, fulfil, return, adjust  === onHand
 *   sum(quantity) over types reserve, release, fulfil         === reserved
 *
 * `fulfil` appears in both because paying for a held unit takes it off the
 * shelf and releases the hold in the same movement — it is one event, so it is
 * one row, counted on both axes.
 */
const stockMovementSchema = new Schema(
  {
    variantId: {
      type: Schema.Types.ObjectId,
      ref: "Variant",
      required: true,
    },

    type: {
      type: String,
      enum: MOVEMENT_TYPES,
      required: true,
    },

    /**
     * Signed, in units. Positive adds to the axis its type touches, negative
     * takes away. A `reserve` of 2 is +2; the `release` that undoes it is -2.
     */
    quantity: {
      type: Number,
      required: true,
      validate: {
        validator: (value: number) => Number.isInteger(value) && value !== 0,
        message: "quantity must be a non-zero integer",
      },
    },

    /** Free text for a person reading the history. */
    reason: { type: String, required: true, trim: true, maxlength: 300 },

    refType: { type: String, enum: MOVEMENT_REF_TYPES, required: true },

    /** The cart, order or return this movement belongs to. Null for manual. */
    refId: { type: Schema.Types.ObjectId, default: null },

    /** The admin who did it, when a human did. */
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    // Only createdAt: an append-only row is never modified, so updatedAt would
    // be a field that is always equal to createdAt and always a lie if it were
    // not.
    timestamps: { createdAt: true, updatedAt: false },
    collection: "stockmovements",
  },
);

/** Reconciliation replays one variant in order; the history view pages it. */
stockMovementSchema.index({ variantId: 1, createdAt: -1 });

/** "What did this order do to stock" — used when cancelling and returning. */
stockMovementSchema.index({ refType: 1, refId: 1 });

export type StockMovementDoc = InferSchemaType<typeof stockMovementSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
};

export const StockMovement: Model<StockMovementDoc> =
  model<StockMovementDoc>("StockMovement", stockMovementSchema);
