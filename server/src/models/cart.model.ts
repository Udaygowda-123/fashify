import { Schema, model, type InferSchemaType, type Model, type Types } from "mongoose";

const cartItemSchema = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, ref: "Variant", required: true },
    quantity: { type: Number, required: true, min: 1 },

    /**
     * In paise. The price when the item went in, kept so the bag can tell the
     * shopper "this went up since you added it" rather than silently changing
     * the number under them.
     *
     * It is NOT what they are charged. Checkout re-reads every current price
     * from the variant and recomputes the total; this field is for messaging
     * only. Trusting it would let someone add an item, wait for a price rise,
     * and pay the old price — or worse, let a tampered client dictate it.
     */
    priceSnapshot: { type: Number, required: true, min: 0 },

    addedAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const cartSchema = new Schema(
  {
    /** Set once the shopper is signed in. */
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /**
     * Set for a shopper who has not signed in. The value is random; it reaches
     * the browser as a signed cookie, so a guest cannot read someone else's
     * bag by guessing.
     */
    guestToken: {
      type: String,
      default: null,
      trim: true,
    },

    items: { type: [cartItemSchema], default: [] },

    /** Uppercase, validated against Coupon at pricing time, never trusted. */
    couponCode: { type: String, default: null, trim: true, uppercase: true },

    /** When the sweeper may drop an untouched bag. */
    expiresAt: { type: Date, required: true },

    /**
     * Set when the abandoned-bag email goes out, so it goes out exactly once.
     * A second reminder for the same bag reads as spam.
     */
    recoveryEmailSentAt: { type: Date, default: null },

    /** Set when the cart turns into an order, so it is never recovered after. */
    convertedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "carts" },
);

/**
 * Exactly one owner. A cart with neither is unreachable — nobody can ever load
 * it again — and a cart with both is ambiguous the moment the two disagree.
 */
cartSchema.pre("validate", function (next) {
  const hasUser = Boolean(this.userId);
  const hasGuest = Boolean(this.guestToken);
  if (hasUser === hasGuest) {
    next(
      new Error(
        "a cart needs exactly one owner: userId or guestToken, not both and not neither",
      ),
    );
    return;
  }
  next();
});

/**
 * One live cart per signed-in user. Partial so the many guest carts, which
 * have userId null, do not all collide on a single null.
 */
cartSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: "objectId" } } },
);

cartSchema.index(
  { guestToken: 1 },
  { unique: true, partialFilterExpression: { guestToken: { $type: "string" } } },
);

/** The abandoned-bag job: has items, never converted, untouched for a while. */
cartSchema.index({ convertedAt: 1, recoveryEmailSentAt: 1, updatedAt: -1 });

/**
 * A plain index, not a TTL one. Dropping a cart has to release its
 * reservations first, and a TTL monitor cannot do that — the same trap
 * described on the Reservation model.
 */
cartSchema.index({ expiresAt: 1 });

export type CartDoc = InferSchemaType<typeof cartSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Cart: Model<CartDoc> = model<CartDoc>("Cart", cartSchema);
