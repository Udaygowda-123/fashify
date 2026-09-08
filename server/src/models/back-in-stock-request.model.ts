import { Schema, model, type InferSchemaType, type Model, type Types } from "mongoose";

/**
 * Someone who wanted a piece in a size that was sold out.
 *
 * This is demand that otherwise walks out of the shop unrecorded: the size
 * shows "sold out", the person leaves, and nobody ever learns they wanted it.
 * Capturing the address turns a lost sale into a queue to email the moment the
 * size is restocked, and — separately useful — tells the buyer which sizes to
 * make more of.
 */
const backInStockRequestSchema = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, ref: "Variant", required: true },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "that does not look like an email address"],
    },

    /** Set when the user was signed in, so the email can be addressed by name. */
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },

    /** Null until the restock email has been sent. */
    notifiedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "backinstockrequests" },
);

/**
 * One request per address per variant. Asking twice is not two notifications —
 * and without this, a page refresh on a form would sign you up again.
 */
backInStockRequestSchema.index({ variantId: 1, email: 1 }, { unique: true });

/**
 * The notifier's query: everyone still waiting on this variant, oldest first,
 * because the person who asked in March should hear before the one who asked
 * this morning.
 */
backInStockRequestSchema.index({ variantId: 1, notifiedAt: 1, createdAt: 1 });

export type BackInStockRequestDoc = InferSchemaType<typeof backInStockRequestSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
};

export const BackInStockRequest: Model<BackInStockRequestDoc> =
  model<BackInStockRequestDoc>("BackInStockRequest", backInStockRequestSchema);
