import { Schema, model, type InferSchemaType, type Model, type Types } from "mongoose";
import { COUPON_TYPES } from "./types.js";

const couponSchema = new Schema(
  {
    /** Stored uppercase so "welcome10" and "WELCOME10" are one coupon. */
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9][A-Z0-9-]{2,31}$/, "a code is 3-32 characters of A-Z, 0-9 and -"],
    },

    description: { type: String, required: true, trim: true, maxlength: 200 },

    type: { type: String, enum: COUPON_TYPES, required: true },

    /**
     * For `percent`, basis points — 1000 is 10%. Integers again, so 12.5% is
     * expressible without a float. For `fixed`, paise off.
     */
    value: { type: Number, required: true, min: 1 },

    /** In paise. The bag must reach this before the code applies. */
    minSubtotal: { type: Number, required: true, default: 0, min: 0 },

    /** Null means unlimited. */
    usageLimit: { type: Number, default: null, min: 1 },

    /**
     * Incremented atomically when an order is placed, and checked against
     * `usageLimit` in the same conditional update — the same shape as the
     * stock reservation, and for the same reason. Reading the count, comparing
     * it, then writing lets a code with one use left be redeemed twice.
     *
     * `perUserLimit` is enforced separately, by counting that user's existing
     * orders carrying this code. Order already holds both `userId` and
     * `couponCode`, so no separate redemption collection is needed, and order
     * idempotency already stops one checkout counting twice.
     */
    usedCount: { type: Number, required: true, default: 0, min: 0 },

    /** Null means unlimited per person. */
    perUserLimit: { type: Number, default: null, min: 1 },

    validFrom: { type: Date, required: true, default: () => new Date() },
    validUntil: { type: Date, default: null },

    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, collection: "coupons" },
);

/** Applying a code looks it up by code and checks the window in one go. */
couponSchema.index({ code: 1, isActive: 1 });

export type CouponDoc = InferSchemaType<typeof couponSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Coupon: Model<CouponDoc> = model<CouponDoc>("Coupon", couponSchema);
