/**
 * Shared literals and money conventions.
 *
 * MONEY: every monetary field in every collection is an integer number of
 * paise — never a float, never rupees. ₹4,800 is stored as 480000.
 *
 * Two reasons. Razorpay's API takes and returns paise, so anything else means
 * converting at the boundary and rounding twice. And a percentage coupon or
 * GST on a whole-rupee price does not land on a whole rupee: 18% of ₹2,200 is
 * ₹396, but 18% of ₹2,250 is ₹405.00 and 7.5% of ₹2,200 is ₹165.00 — the
 * moment a rate has a decimal, rupee arithmetic starts losing fractions, and
 * floats start producing 0.30000000000000004. Integers in the smallest unit,
 * rounded once, at the end.
 */
export const PAISE_PER_RUPEE = 100;

export const rupeesToPaise = (rupees: number): number =>
  Math.round(rupees * PAISE_PER_RUPEE);

export const paiseToRupees = (paise: number): number => paise / PAISE_PER_RUPEE;

export const PRODUCT_STATUSES = ["draft", "active", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const CATEGORIES = ["overshirts", "trousers", "knitwear", "tees"] as const;
export type Category = (typeof CATEGORIES)[number];

export const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
export type Size = (typeof SIZES)[number];

/**
 * The stock ledger's vocabulary. Which counter a movement touches is derived
 * from its type, not stored — see `MOVEMENT_AXES` in the inventory service:
 *
 *   receive  onHand +        goods arrived
 *   reserve  reserved +      a bag is holding it
 *   release  reserved -      the hold expired or the bag let go
 *   fulfil   onHand -, reserved -   paid for and committed
 *   return   onHand +        came back and is sellable again
 *   adjust   onHand ±        a human corrected the count
 */
export const MOVEMENT_TYPES = [
  "receive",
  "reserve",
  "release",
  "fulfil",
  "return",
  "adjust",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_REF_TYPES = ["order", "cart", "manual", "return"] as const;
export type MovementRefType = (typeof MOVEMENT_REF_TYPES)[number];

export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "payment_failed",
  "processing",
  "shipped",
  "delivered",
  "return_requested",
  "returned",
  "rejected",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "created",
  "authorized",
  "captured",
  "failed",
  "refunded",
  "partially_refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const RETURN_STATUSES = [
  "requested",
  "approved",
  "received",
  "refunded",
  "rejected",
] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const COUPON_TYPES = ["percent", "fixed"] as const;
export type CouponType = (typeof COUPON_TYPES)[number];

export const USER_ROLES = ["customer", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];
