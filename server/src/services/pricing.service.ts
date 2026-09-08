import type { Types } from "mongoose";
import { CouponInvalidError } from "../lib/errors.js";
import { Coupon, Order, type CouponDoc } from "../models/index.js";

/**
 * ------------------------------------------------------------------------
 * ALL PRICING HAPPENS HERE, FROM CURRENT DATABASE VALUES.
 * ------------------------------------------------------------------------
 *
 * The client sends variant ids, quantities and at most a coupon code. It does
 * not send prices, line totals, discounts, shipping or a grand total, and if it
 * did they would be ignored.
 *
 * This is not defensiveness for its own sake. A checkout that accepts a total
 * from the browser can be bought from with the developer console: change one
 * number and pay ₹1 for an order of ₹12,000, and the server has no way to know
 * it was ever different. The only safe posture is that every figure on the
 * order is computed here, from prices read at this moment.
 *
 * Everything is integer paise, and rounding happens once, at the end of each
 * calculation, with `Math.round`.
 */

/** Free delivery over this, in paise. */
export const FREE_SHIPPING_THRESHOLD = 250_000;
export const SHIPPING_FLAT_RATE = 12_000;

/**
 * Indian GST on apparel: 5% up to ₹1,000 a piece, 12% above it.
 *
 * Displayed prices are GST-inclusive, which is the norm for retail here and
 * what the storefront footer says. So `tax` is the component already inside
 * the subtotal, recorded for the invoice — it is NOT added on top, and the
 * total does not include it a second time.
 */
const GST_LOW_RATE = 0.05;
const GST_HIGH_RATE = 0.12;
const GST_RATE_THRESHOLD = 100_000;

export function gstRateFor(unitPrice: number): number {
  return unitPrice <= GST_RATE_THRESHOLD ? GST_LOW_RATE : GST_HIGH_RATE;
}

export interface PriceableLine {
  variantId: Types.ObjectId;
  quantity: number;
  /** Read from the variant now, never from the request. */
  unitPrice: number;
}

export interface Pricing {
  subtotal: number;
  discount: number;
  shipping: number;
  /** The GST already contained in the subtotal, for the invoice. */
  tax: number;
  total: number;
}

export interface PricingResult extends Pricing {
  coupon: { code: string; description: string; discount: number } | null;
  freeShippingShortfall: number;
}

function includedGst(lines: PriceableLine[]): number {
  let tax = 0;
  for (const line of lines) {
    const rate = gstRateFor(line.unitPrice);
    const lineTotal = line.unitPrice * line.quantity;
    // Inclusive: the tax inside a gross figure is gross × r / (1 + r).
    tax += Math.round((lineTotal * rate) / (1 + rate));
  }
  return tax;
}

/**
 * Validates a coupon against a subtotal and a user, and returns what it takes
 * off. Throws with a message that says which rule failed, because "invalid
 * code" makes people retype a code that was never going to work.
 */
export async function resolveCoupon(args: {
  code: string;
  subtotal: number;
  userId?: Types.ObjectId | null;
}): Promise<{ coupon: CouponDoc; discount: number }> {
  const code = args.code.trim().toUpperCase();
  const coupon = await Coupon.findOne({ code });

  if (!coupon || !coupon.isActive) {
    throw new CouponInvalidError(`${code} is not a code we recognise.`);
  }

  const now = new Date();
  if (coupon.validFrom > now) {
    throw new CouponInvalidError(`${code} is not active yet.`);
  }
  if (coupon.validUntil && coupon.validUntil < now) {
    throw new CouponInvalidError(`${code} expired on ${coupon.validUntil.toDateString()}.`);
  }
  if (typeof coupon.usageLimit === "number" && coupon.usedCount >= coupon.usageLimit) {
    throw new CouponInvalidError(`${code} has been fully claimed.`);
  }
  if (args.subtotal < coupon.minSubtotal) {
    const shortfall = coupon.minSubtotal - args.subtotal;
    throw new CouponInvalidError(
      `${code} applies to orders over ₹${(coupon.minSubtotal / 100).toLocaleString("en-IN")}. Add ₹${(shortfall / 100).toLocaleString("en-IN")} more to use it.`,
      { shortfall },
    );
  }

  if (typeof coupon.perUserLimit === "number" && args.userId) {
    // Counted from orders rather than a redemption collection: an order
    // already records both the user and the code, and orders that never got
    // paid should not count against the limit.
    const used = await Order.countDocuments({
      userId: args.userId,
      couponCode: code,
      status: { $nin: ["payment_failed", "cancelled"] },
    });
    if (used >= coupon.perUserLimit) {
      throw new CouponInvalidError(
        coupon.perUserLimit === 1
          ? `${code} is one use per person, and this account has used it.`
          : `${code} can be used ${coupon.perUserLimit} times per person, and this account has used it ${used} times.`,
      );
    }
  }

  const discount =
    coupon.type === "percent"
      ? // value is basis points, so 1000 is 10%.
        Math.round((args.subtotal * coupon.value) / 10_000)
      : Math.min(coupon.value, args.subtotal);

  return { coupon, discount };
}

/**
 * The one function that produces the numbers on a bag or an order.
 *
 * `couponCode` is optional and failures are surfaced rather than swallowed —
 * except when `ignoreInvalidCoupon` is set, which the bag view uses so a code
 * that has since expired does not make the whole bag fail to load.
 */
export async function computePricing(args: {
  lines: PriceableLine[];
  couponCode?: string | null;
  userId?: Types.ObjectId | null;
  ignoreInvalidCoupon?: boolean;
}): Promise<PricingResult> {
  const subtotal = args.lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );

  let discount = 0;
  let couponSummary: PricingResult["coupon"] = null;

  if (args.couponCode) {
    try {
      const resolved = await resolveCoupon({
        code: args.couponCode,
        subtotal,
        userId: args.userId ?? null,
      });
      discount = resolved.discount;
      couponSummary = {
        code: resolved.coupon.code,
        description: resolved.coupon.description,
        discount,
      };
    } catch (error) {
      if (!args.ignoreInvalidCoupon) throw error;
    }
  }

  const afterDiscount = Math.max(0, subtotal - discount);
  const shipping =
    args.lines.length === 0 || afterDiscount >= FREE_SHIPPING_THRESHOLD
      ? 0
      : SHIPPING_FLAT_RATE;

  return {
    subtotal,
    discount,
    shipping,
    tax: includedGst(args.lines),
    // GST is already inside the subtotal, so it is not added again here.
    total: afterDiscount + shipping,
    coupon: couponSummary,
    freeShippingShortfall:
      shipping === 0 ? 0 : Math.max(0, FREE_SHIPPING_THRESHOLD - afterDiscount),
  };
}

/**
 * Claims one use of a coupon, atomically.
 *
 * Same shape as the stock reservation and for the same reason: reading
 * `usedCount`, comparing it to `usageLimit` and then writing lets the last use
 * of a code be claimed by two checkouts at once. The limit is checked inside
 * the filter, so exactly one of them can match.
 *
 * Returns false when the code ran out between pricing and payment — the caller
 * decides whether to fail the order or place it at full price.
 */
export async function claimCouponUse(code: string): Promise<boolean> {
  const result = await Coupon.findOneAndUpdate(
    {
      code: code.toUpperCase(),
      isActive: true,
      $or: [
        { usageLimit: null },
        { $expr: { $lt: ["$usedCount", "$usageLimit"] } },
      ],
    },
    { $inc: { usedCount: 1 } },
    { new: true },
  ).lean();
  return Boolean(result);
}

/** Gives a use back when an order is cancelled before payment. */
export async function releaseCouponUse(code: string): Promise<void> {
  await Coupon.updateOne(
    { code: code.toUpperCase(), usedCount: { $gte: 1 } },
    { $inc: { usedCount: -1 } },
  );
}
