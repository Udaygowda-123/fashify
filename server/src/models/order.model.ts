import { Schema, model, type InferSchemaType, type Model, type Types } from "mongoose";
import { ORDER_STATUSES } from "./types.js";

/**
 * Every product detail is copied onto the line, not referenced.
 *
 * This looks like duplication and is the opposite. If the line held only a
 * variantId, then renaming "Ecru Overshirt" to "Ecru Overshirt II", raising its
 * price, recolouring it or archiving it would silently rewrite every order
 * anyone had ever placed. A customer opening a receipt from March would see
 * today's name and today's price for something they bought at a different one,
 * and the total would no longer equal the sum of the lines. Refunds, invoices,
 * GST records and disputes all depend on the order being a frozen record of
 * what was actually bought.
 */
const orderItemSchema = new Schema(
  {
    /** Kept for restocking and reordering, but never read for display. */
    variantId: { type: Schema.Types.ObjectId, ref: "Variant", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },

    sku: { type: String, required: true },
    nameSnapshot: { type: String, required: true },
    colourSnapshot: { type: String, required: true },
    sizeSnapshot: { type: String, required: true },
    imageSnapshot: { type: String, required: true },

    /** In paise, as charged. */
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

/**
 * All in paise, and all computed on the server from current variant prices.
 * Nothing here is ever taken from the request body.
 */
const pricingSchema = new Schema(
  {
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    shipping: { type: Number, required: true, min: 0, default: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const addressSnapshotSchema = new Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String, default: null },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, required: true, default: "IN" },
  },
  { _id: false },
);

const statusEventSchema = new Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, required: true, default: () => new Date() },
    /** Null when a webhook or a job moved it rather than a person. */
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    note: { type: String, default: null, maxlength: 500 },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    /** Human-readable, for support conversations. e.g. FSH-2K7X4M. */
    orderNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },

    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    /** Kept so the confirmation can be sent without another lookup. */
    email: { type: String, required: true, trim: true, lowercase: true },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) => items.length > 0,
        message: "an order with no items is not an order",
      },
    },

    pricing: { type: pricingSchema, required: true },

    currency: { type: String, required: true, default: "INR" },

    shippingAddress: { type: addressSnapshotSchema, required: true },
    billingAddress: { type: addressSnapshotSchema, required: true },

    /** Recorded for the audit trail even though pricing is already frozen. */
    couponCode: { type: String, default: null, uppercase: true },

    status: {
      type: String,
      enum: ORDER_STATUSES,
      required: true,
      default: "pending_payment",
    },

    /** Append-only. Every transition adds an entry; nothing is overwritten. */
    statusHistory: { type: [statusEventSchema], default: [] },

    /**
     * The client's Idempotency-Key. Unique and sparse: a second POST with the
     * same key hits this index, and the handler answers with the order that
     * already exists instead of creating a twin. Sparse so historical orders
     * without a key do not all collide on null.
     */
    idempotencyKey: { type: String, default: null, trim: true },

    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", default: null },

    /** The cart this came from, so its reservations can be committed. */
    cartId: { type: Schema.Types.ObjectId, ref: "Cart", default: null },

    placedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true, collection: "orders" },
);

/**
 * The index that makes order creation idempotent. Sparse, so only orders that
 * actually carry a key participate.
 */
orderSchema.index(
  { idempotencyKey: 1 },
  { unique: true, sparse: true, name: "order_idempotency_key" },
);

/** "My orders", newest first — and the cursor pagination that pages it. */
orderSchema.index({ userId: 1, placedAt: -1 });

/** The admin queue, filtered by status and newest first. */
orderSchema.index({ status: 1, placedAt: -1 });

/** Restocking a cancelled or returned order needs its lines by variant. */
orderSchema.index({ "items.variantId": 1 });

export type OrderDoc = InferSchemaType<typeof orderSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Order: Model<OrderDoc> = model<OrderDoc>("Order", orderSchema);
