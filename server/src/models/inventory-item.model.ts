import { Schema, model, type InferSchemaType, type Model, type Types } from "mongoose";

/**
 * One row per variant, and the only place a stock number lives.
 *
 * WHY THIS IS ITS OWN COLLECTION, not a field on Variant:
 *
 * A variant document is read constantly — every grid tile, every product page,
 * every search — and written almost never. A stock number is the opposite: it
 * changes on every add-to-bag, every expiry sweep and every payment. Putting
 * them in one document means every add-to-bag write contends with, and
 * invalidates the cache of, a document that thousands of reads want. Splitting
 * them lets the catalog be cached hard while stock stays hot and consistent.
 *
 * It also keeps the atomic update small. The reservation path is a single
 * conditional update against one tiny document with one index; if stock were a
 * field on Variant, that same update would be rewriting a document carrying
 * images, copy and prices.
 *
 * AVAILABILITY IS NEVER STORED. It is always `onHand - reserved`, computed at
 * read time. A stored `available` is a third number that has to be kept in step
 * with the other two, and the first time a crash lands between two writes it
 * disagrees with them permanently — with no way to tell which one is wrong.
 */
const inventoryItemSchema = new Schema(
  {
    variantId: {
      type: Schema.Types.ObjectId,
      ref: "Variant",
      required: true,
      // Unique: two inventory rows for one variant would let two requests each
      // reserve against a different row and oversell by design.
      unique: true,
      index: true,
    },

    /** Physically in the warehouse, including units held by unpaid bags. */
    onHand: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "onHand cannot go negative"],
    },

    /**
     * Held by carts that have not paid yet. Always <= onHand: the conditional
     * update that increments it requires onHand - reserved >= quantity.
     */
    reserved: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "reserved cannot go negative"],
    },

    /** Below this, the daily digest tells an admin to reorder. */
    lowStockThreshold: {
      type: Number,
      required: true,
      default: 3,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: "inventoryitems",
    // Availability is derived, never persisted — but it is convenient to read.
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

inventoryItemSchema.virtual("available").get(function (this: {
  onHand: number;
  reserved: number;
}) {
  return this.onHand - this.reserved;
});

/**
 * Supports the low-stock digest, which asks "where is onHand - reserved below
 * the threshold" across the whole catalogue.
 */
inventoryItemSchema.index({ lowStockThreshold: 1, onHand: 1 });

export type InventoryItemDoc = InferSchemaType<typeof inventoryItemSchema> & {
  _id: Types.ObjectId;
  available?: number;
};

export const InventoryItem: Model<InventoryItemDoc> =
  model<InventoryItemDoc>("InventoryItem", inventoryItemSchema);
