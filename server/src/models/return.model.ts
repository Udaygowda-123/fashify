import { Schema, model, type InferSchemaType, type Model, type Types } from "mongoose";
import { RETURN_STATUSES } from "./types.js";

const returnItemSchema = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, ref: "Variant", required: true },
    sku: { type: String, required: true },
    nameSnapshot: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    /** In paise, the unit price actually charged on the order. */
    unitPrice: { type: Number, required: true, min: 0 },
    /**
     * Whether this came back sellable. A piece returned worn or damaged is
     * refunded but must not go back into `onHand`, or the next shopper buys it.
     */
    restock: { type: Boolean, required: true, default: true },
  },
  { _id: false },
);

const returnSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    items: {
      type: [returnItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) => items.length > 0,
        message: "a return needs at least one item",
      },
    },

    reason: { type: String, required: true, trim: true, maxlength: 500 },

    status: { type: String, enum: RETURN_STATUSES, required: true, default: "requested" },

    /** In paise. Computed server-side from the order's own line prices. */
    refundAmount: { type: Number, required: true, default: 0, min: 0 },

    /** Razorpay's refund id once the money has actually been sent back. */
    gatewayRefundId: { type: String, default: null },

    /**
     * Set the moment stock has been put back, so approving a return twice
     * cannot restock twice. The same guard shape as `Reservation.releasedAt`.
     */
    restockedAt: { type: Date, default: null },

    notes: { type: String, default: null, maxlength: 1000 },

    statusHistory: {
      type: [
        new Schema(
          {
            status: { type: String, enum: RETURN_STATUSES, required: true },
            at: { type: Date, required: true, default: () => new Date() },
            actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
            note: { type: String, default: null },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true, collection: "returns" },
);

returnSchema.index({ orderId: 1 });
returnSchema.index({ userId: 1, createdAt: -1 });
/** The admin returns queue. */
returnSchema.index({ status: 1, createdAt: -1 });

export type ReturnDoc = InferSchemaType<typeof returnSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Return: Model<ReturnDoc> = model<ReturnDoc>("Return", returnSchema);
