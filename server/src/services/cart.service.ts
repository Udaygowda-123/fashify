import { randomBytes } from "node:crypto";
import type { Types } from "mongoose";
import { env } from "../config/env.js";
import { ConflictError, InsufficientStockError, NotFoundError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import {
  Cart,
  Product,
  Reservation,
  Variant,
  type CartDoc,
} from "../models/index.js";
import type { Size } from "../models/types.js";
import { getAvailability, release, reserve } from "./inventory.service.js";
import { computePricing, type PricingResult } from "./pricing.service.js";

const CART_TTL_MS = env.CART_TTL_DAYS * 24 * 3600 * 1000;

export function newGuestToken(): string {
  return randomBytes(24).toString("base64url");
}

function cartExpiry(): Date {
  return new Date(Date.now() + CART_TTL_MS);
}

/* -------------------------------------------------------------------------- */
/* Resolving whose bag this is                                                */
/* -------------------------------------------------------------------------- */

/**
 * One live bag per shopper: a user cart if signed in, otherwise the cart
 * behind their guest token. Upserted rather than found-then-created, because
 * two tabs opening at once would otherwise both insert and collide on the
 * unique index.
 */
export async function getOrCreateCart(owner: {
  userId?: Types.ObjectId | null;
  guestToken?: string | null;
}): Promise<CartDoc> {
  if (owner.userId) {
    const cart = await Cart.findOneAndUpdate(
      { userId: owner.userId, convertedAt: null },
      { $setOnInsert: { userId: owner.userId, items: [], expiresAt: cartExpiry() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return cart;
  }

  if (!owner.guestToken) {
    throw new Error("getOrCreateCart needs a userId or a guestToken");
  }

  return Cart.findOneAndUpdate(
    { guestToken: owner.guestToken, convertedAt: null },
    { $setOnInsert: { guestToken: owner.guestToken, items: [], expiresAt: cartExpiry() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

/* -------------------------------------------------------------------------- */
/* The bag, as the client sees it                                             */
/* -------------------------------------------------------------------------- */

export interface CartLineView {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  sku: string;
  size: Size;
  colour: { name: string; slug: string; hex: string };
  image: { url: string; alt: string; width: number; height: number } | null;
  /** Current price, which is what will be charged. */
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  available: number;
  /**
   * Set when the price has moved since the item went in the bag. Surfaced
   * rather than silently swapped, so the shopper is not surprised at checkout.
   */
  priceChanged: { from: number; to: number } | null;
  /** Set when there is now less available than the bag is asking for. */
  overAvailable: boolean;
}

export interface CartView {
  id: string;
  lines: CartLineView[];
  itemCount: number;
  pricing: PricingResult;
  couponCode: string | null;
  /** Plain sentences for the client to show verbatim. */
  notices: string[];
  expiresAt: Date;
  /** The soonest a hold in this bag lapses, so the client can show a timer. */
  holdsExpireAt: Date | null;
}

export async function getCartView(cart: CartDoc): Promise<CartView> {
  if (cart.items.length === 0) {
    return {
      id: String(cart._id),
      lines: [],
      itemCount: 0,
      pricing: await computePricing({ lines: [] }),
      couponCode: null,
      notices: [],
      expiresAt: cart.expiresAt,
      holdsExpireAt: null,
    };
  }

  const variantIds = cart.items.map((item) => item.variantId);
  const [variants, availability, reservations] = await Promise.all([
    Variant.find({ _id: { $in: variantIds } }).lean(),
    getAvailability(variantIds),
    Reservation.find({ cartId: cart._id, releasedAt: null }).lean(),
  ]);

  const variantById = new Map(variants.map((v) => [String(v._id), v]));
  const products = await Product.find({
    _id: { $in: variants.map((v) => v.productId) },
  })
    .select("slug name images")
    .lean();
  const productById = new Map(products.map((p) => [String(p._id), p]));

  const notices: string[] = [];
  const lines: CartLineView[] = [];

  for (const item of cart.items) {
    const variant = variantById.get(String(item.variantId));
    if (!variant) {
      notices.push("A piece in your bag is no longer sold and has been removed.");
      continue;
    }
    const product = productById.get(String(variant.productId));
    const stock = availability.get(String(item.variantId));
    // A cart's own hold counts toward what it may have, so add it back.
    const held =
      reservations.find((r) => String(r.variantId) === String(item.variantId))?.quantity ?? 0;
    const availableToThisCart = (stock?.available ?? 0) + held;

    const priceChanged =
      item.priceSnapshot !== variant.price
        ? { from: item.priceSnapshot, to: variant.price }
        : null;

    if (priceChanged) {
      notices.push(
        priceChanged.to > priceChanged.from
          ? `${product?.name ?? "A piece"} has gone up since you added it.`
          : `${product?.name ?? "A piece"} has come down since you added it.`,
      );
    }

    const overAvailable = item.quantity > availableToThisCart;
    if (overAvailable) {
      notices.push(
        availableToThisCart === 0
          ? `${product?.name ?? "A piece"} in ${variant.size} has sold out.`
          : `Only ${availableToThisCart} of ${product?.name ?? "a piece"} in ${variant.size} are left.`,
      );
    }

    lines.push({
      variantId: String(item.variantId),
      productId: String(variant.productId),
      slug: product?.slug ?? "",
      name: product?.name ?? "",
      sku: variant.sku,
      size: variant.size,
      colour: variant.colour ?? { name: "", slug: "", hex: "#000000" },
      image: product?.images[0]
        ? {
            url: product.images[0].url,
            alt: product.images[0].alt,
            width: product.images[0].width,
            height: product.images[0].height,
          }
        : null,
      unitPrice: variant.price,
      quantity: item.quantity,
      lineTotal: variant.price * item.quantity,
      available: availableToThisCart,
      priceChanged,
      overAvailable,
    });
  }

  const pricing = await computePricing({
    lines: lines.map((line) => ({
      variantId: cart.items.find((i) => String(i.variantId) === line.variantId)!.variantId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
    couponCode: cart.couponCode,
    userId: cart.userId,
    // A code that expired while the bag sat there should not 422 the bag.
    ignoreInvalidCoupon: true,
  });

  if (cart.couponCode && !pricing.coupon) {
    notices.push(`${cart.couponCode} no longer applies to this bag.`);
  }

  const soonest = reservations
    .map((r) => r.expiresAt)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return {
    id: String(cart._id),
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    pricing,
    couponCode: cart.couponCode ?? null,
    // Repeated notices collapse — one sentence per problem, not per line.
    notices: [...new Set(notices)],
    expiresAt: cart.expiresAt,
    holdsExpireAt: soonest ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Changing the bag                                                           */
/* -------------------------------------------------------------------------- */

/** Cap so one bag cannot hold the entire size run away from everyone else. */
const MAX_PER_LINE = 10;

/**
 * Adds units, holding the stock as it goes.
 *
 * The reservation comes first and the cart line second, deliberately: if this
 * process dies in between, the units are held by a reservation with no line,
 * and the sweeper hands them back twenty minutes later. The other order would
 * put a line in the bag that nothing is holding stock for, and the shopper
 * would be told at checkout that what they were looking at is gone.
 */
export async function addItem(args: {
  cart: CartDoc;
  variantId: Types.ObjectId;
  quantity: number;
}): Promise<CartDoc> {
  const { cart, variantId } = args;
  const quantity = Math.trunc(args.quantity);
  if (quantity < 1) throw new ConflictError("Choose at least one.");

  const variant = await Variant.findOne({ _id: variantId, isActive: true }).lean();
  if (!variant) throw new NotFoundError("That size");

  const product = await Product.findOne({
    _id: variant.productId,
    status: "active",
  })
    .select("name")
    .lean();
  if (!product) throw new NotFoundError("That piece");

  const existing = cart.items.find((item) => String(item.variantId) === String(variantId));
  const target = (existing?.quantity ?? 0) + quantity;
  if (target > MAX_PER_LINE) {
    throw new ConflictError(
      `There is a limit of ${MAX_PER_LINE} per size, so others can have some too.`,
      { limit: MAX_PER_LINE, current: existing?.quantity ?? 0 },
    );
  }

  await reserve({
    cartId: cart._id,
    variantId,
    quantity,
    ttlMinutes: env.RESERVATION_TTL_MINUTES,
    label: `${product.name} in ${variant.size}`,
  });

  if (existing) {
    await Cart.updateOne(
      { _id: cart._id, "items.variantId": variantId },
      {
        $inc: { "items.$.quantity": quantity },
        $set: { "items.$.priceSnapshot": variant.price, expiresAt: cartExpiry() },
      },
    );
  } else {
    await Cart.updateOne(
      { _id: cart._id },
      {
        $push: {
          items: {
            variantId,
            quantity,
            priceSnapshot: variant.price,
            addedAt: new Date(),
          },
        },
        $set: { expiresAt: cartExpiry() },
      },
    );
  }

  const updated = await Cart.findById(cart._id);
  if (!updated) throw new NotFoundError("Your bag");
  return updated;
}

/**
 * Sets a line to an exact quantity, reserving or releasing the difference.
 * Setting zero removes the line.
 */
export async function setQuantity(args: {
  cart: CartDoc;
  variantId: Types.ObjectId;
  quantity: number;
}): Promise<CartDoc> {
  const { cart, variantId } = args;
  const quantity = Math.trunc(args.quantity);
  if (quantity < 0) throw new ConflictError("A quantity cannot be negative.");
  if (quantity > MAX_PER_LINE) {
    throw new ConflictError(`There is a limit of ${MAX_PER_LINE} per size.`);
  }

  const line = cart.items.find((item) => String(item.variantId) === String(variantId));
  if (!line) throw new NotFoundError("That item in your bag");

  const delta = quantity - line.quantity;

  if (delta > 0) {
    const variant = await Variant.findById(variantId).select("size productId").lean();
    const product = variant
      ? await Product.findById(variant.productId).select("name").lean()
      : null;
    await reserve({
      cartId: cart._id,
      variantId,
      quantity: delta,
      ttlMinutes: env.RESERVATION_TTL_MINUTES,
      label: product && variant ? `${product.name} in ${variant.size}` : undefined,
    });
  } else if (delta < 0) {
    await releaseFromCart(cart._id, variantId, -delta, "shopper reduced the quantity");
  }

  if (quantity === 0) {
    await Cart.updateOne(
      { _id: cart._id },
      { $pull: { items: { variantId } }, $set: { expiresAt: cartExpiry() } },
    );
  } else {
    await Cart.updateOne(
      { _id: cart._id, "items.variantId": variantId },
      { $set: { "items.$.quantity": quantity, expiresAt: cartExpiry() } },
    );
  }

  const updated = await Cart.findById(cart._id);
  if (!updated) throw new NotFoundError("Your bag");
  return updated;
}

export async function removeItem(args: {
  cart: CartDoc;
  variantId: Types.ObjectId;
}): Promise<CartDoc> {
  return setQuantity({ ...args, quantity: 0 });
}

/**
 * Releases some of a cart's hold and keeps the reservation row in step.
 * Deleting the row when it reaches zero keeps the sweeper's work small.
 */
async function releaseFromCart(
  cartId: Types.ObjectId,
  variantId: Types.ObjectId,
  quantity: number,
  reason: string,
): Promise<void> {
  await release({ cartId, variantId, quantity, reason });

  const reservation = await Reservation.findOneAndUpdate(
    { cartId, variantId },
    { $inc: { quantity: -quantity } },
    { new: true },
  );
  if (reservation && reservation.quantity <= 0) {
    await Reservation.deleteOne({ _id: reservation._id });
  }
}

/** Hands back everything a bag is holding. Used on abandonment and cancel. */
export async function releaseAllHolds(cartId: Types.ObjectId, reason: string): Promise<void> {
  const reservations = await Reservation.find({ cartId, releasedAt: null }).lean();
  for (const reservation of reservations) {
    await release({
      cartId,
      variantId: reservation.variantId,
      quantity: reservation.quantity,
      reason,
    });
  }
  await Reservation.deleteMany({ cartId });
}

/**
 * Pushes the expiry out while someone is actively in checkout. Filling in an
 * address should not cost you the thing you are buying.
 */
export async function extendHolds(cartId: Types.ObjectId): Promise<Date> {
  const expiresAt = new Date(Date.now() + env.RESERVATION_TTL_MINUTES * 60_000);
  await Reservation.updateMany({ cartId, releasedAt: null }, { $set: { expiresAt } });
  return expiresAt;
}

export async function applyCoupon(args: {
  cart: CartDoc;
  code: string | null;
}): Promise<CartDoc> {
  const code = args.code?.trim().toUpperCase() ?? null;

  if (code) {
    // Validate against the live bag so a bad code is rejected here, with a
    // reason, rather than silently sitting on the cart until checkout.
    const view = await getCartView(args.cart);
    const { resolveCoupon } = await import("./pricing.service.js");
    await resolveCoupon({
      code,
      subtotal: view.pricing.subtotal,
      userId: args.cart.userId,
    });
  }

  await Cart.updateOne({ _id: args.cart._id }, { $set: { couponCode: code } });
  const updated = await Cart.findById(args.cart._id);
  if (!updated) throw new NotFoundError("Your bag");
  return updated;
}

/* -------------------------------------------------------------------------- */
/* Guest bag merging                                                          */
/* -------------------------------------------------------------------------- */

export interface MergeReport {
  cart: CartDoc;
  /** Lines that could not be carried over in full, with the reason. */
  dropped: { name: string; size: string; wanted: number; kept: number; reason: string }[];
}

/**
 * Merges a guest bag into the signed-in shopper's bag.
 *
 * Quantities for the same size are summed, and then re-checked against stock,
 * because two bags that were each individually satisfiable may not be
 * together. Anything that no longer fits is reduced or dropped and REPORTED —
 * silently losing what someone put in their bag is the fastest way to lose the
 * sale, and worse, they will not notice until the order arrives short.
 *
 * The guest's holds are released as its lines move across, so the merged bag
 * holds the stock and the abandoned guest bag is not sitting on any.
 */
export async function mergeGuestCart(args: {
  guestToken: string;
  userId: Types.ObjectId;
}): Promise<MergeReport> {
  const guestCart = await Cart.findOne({
    guestToken: args.guestToken,
    convertedAt: null,
  });
  const userCart = await getOrCreateCart({ userId: args.userId });

  if (!guestCart || guestCart.items.length === 0) {
    if (guestCart) await Cart.deleteOne({ _id: guestCart._id });
    return { cart: userCart, dropped: [] };
  }

  const dropped: MergeReport["dropped"] = [];

  // Release the guest bag's holds up front. The merged bag re-reserves what it
  // actually keeps, which is what makes "sum the quantities then re-check"
  // truthful rather than double-counting the guest's own hold.
  await releaseAllHolds(guestCart._id, `merged into the signed-in bag`);

  for (const item of guestCart.items) {
    const variant = await Variant.findOne({ _id: item.variantId, isActive: true }).lean();
    const product = variant
      ? await Product.findOne({ _id: variant.productId, status: "active" })
          .select("name")
          .lean()
      : null;

    if (!variant || !product) {
      dropped.push({
        name: "A piece",
        size: "—",
        wanted: item.quantity,
        kept: 0,
        reason: "it is no longer sold",
      });
      continue;
    }

    const fresh = await Cart.findById(userCart._id);
    const existing = fresh?.items.find(
      (line) => String(line.variantId) === String(item.variantId),
    );
    const wanted = Math.min(MAX_PER_LINE, (existing?.quantity ?? 0) + item.quantity);
    const toAdd = wanted - (existing?.quantity ?? 0);

    if (toAdd <= 0) {
      dropped.push({
        name: product.name,
        size: variant.size,
        wanted: item.quantity,
        kept: 0,
        reason: `your bag already holds the limit of ${MAX_PER_LINE}`,
      });
      continue;
    }

    try {
      await addItem({ cart: fresh ?? userCart, variantId: item.variantId, quantity: toAdd });
    } catch (error) {
      if (error instanceof InsufficientStockError) {
        const available = Number(error.details.available ?? 0);
        if (available > 0) {
          // Take what is left rather than dropping the line entirely.
          await addItem({
            cart: fresh ?? userCart,
            variantId: item.variantId,
            quantity: available,
          }).catch(() => undefined);
        }
        dropped.push({
          name: product.name,
          size: variant.size,
          wanted: item.quantity,
          kept: available,
          reason:
            available > 0
              ? `only ${available} were left`
              : "it sold out while you were away",
        });
        continue;
      }
      throw error;
    }
  }

  // Carry the coupon over only if the user's bag has none of its own.
  if (guestCart.couponCode && !userCart.couponCode) {
    await Cart.updateOne(
      { _id: userCart._id },
      { $set: { couponCode: guestCart.couponCode } },
    );
  }

  await Cart.deleteOne({ _id: guestCart._id });

  const merged = await Cart.findById(userCart._id);
  if (!merged) throw new NotFoundError("Your bag");

  if (dropped.length > 0) {
    logger.info({ userId: String(args.userId), dropped: dropped.length }, "cart merge reduced lines");
  }

  return { cart: merged, dropped };
}

/** Marks a bag as converted so it is never recovered or merged again. */
export async function markConverted(cartId: Types.ObjectId): Promise<void> {
  await Cart.updateOne({ _id: cartId }, { $set: { convertedAt: new Date(), items: [] } });
}
