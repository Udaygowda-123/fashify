import { randomBytes } from "node:crypto";
import type { Types } from "mongoose";
import { env } from "../config/env.js";
import {
  ConflictError,
  InsufficientStockError,
  NotFoundError,
} from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import {
  Cart,
  InventoryItem,
  Order,
  Product,
  Reservation,
  Variant,
  type CartDoc,
  type OrderDoc,
} from "../models/index.js";
import type { OrderStatus } from "../models/types.js";
import { fulfil, receive, release, reserve } from "./inventory.service.js";
import { claimCouponUse, computePricing, releaseCouponUse } from "./pricing.service.js";
import { assertTransition, CUSTOMER_CANCELLABLE } from "./order-status.js";

/**
 * Human-readable and hard to mistype aloud: no O/0 or I/1 confusion, since
 * these get read out over the phone to support.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newOrderNumber(): string {
  const bytes = randomBytes(6);
  let out = "";
  for (const byte of bytes) {
    out += ALPHABET[byte % ALPHABET.length];
  }
  return `FSH-${out}`;
}

export interface AddressInput {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

export interface CreateOrderInput {
  cart: CartDoc;
  userId: Types.ObjectId;
  email: string;
  shippingAddress: AddressInput;
  billingAddress?: AddressInput | null;
  /** From the Idempotency-Key header. */
  idempotencyKey: string;
}

export interface CreateOrderResult {
  order: OrderDoc;
  /** True when this key had already created an order and we returned that one. */
  replayed: boolean;
}

function snapshotAddress(address: AddressInput) {
  return {
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2 ?? null,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    country: address.country ?? "IN",
  };
}

/**
 * ------------------------------------------------------------------------
 * ORDER CREATION — idempotent, priced server-side, stock re-verified.
 * ------------------------------------------------------------------------
 *
 * Idempotency is enforced by the unique index on `idempotencyKey`, not by
 * looking first. "Does an order with this key exist? No? Create one" is two
 * operations, and a double-tapped Place Order button fires both requests
 * before either has written — so both see nothing and both insert. Attempting
 * the insert and treating the duplicate-key error as "the other one won" makes
 * the database the arbiter, which is the only participant that can be.
 *
 * Stock is NOT decremented here. The units are already held by the bag's
 * reservations; payment is what converts a hold into a permanent decrement.
 * What this does is verify the holds still cover the order and extend them, so
 * a slow card form does not lose the shopper the thing they are buying.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const { cart, userId, idempotencyKey } = input;

  // A replay of a key we have already used: answer with the original.
  const existing = await Order.findOne({ idempotencyKey });
  if (existing) {
    return { order: existing, replayed: true };
  }

  if (cart.items.length === 0) {
    throw new ConflictError("There is nothing in your bag.", {});
  }

  const variantIds = cart.items.map((item) => item.variantId);
  const variants = await Variant.find({ _id: { $in: variantIds } }).lean();
  const variantById = new Map(variants.map((v) => [String(v._id), v]));
  const products = await Product.find({
    _id: { $in: variants.map((v) => v.productId) },
  })
    .select("name images status")
    .lean();
  const productById = new Map(products.map((p) => [String(p._id), p]));

  const reservations = await Reservation.find({
    cartId: cart._id,
    releasedAt: null,
  }).lean();
  const heldByVariant = new Map(
    reservations.map((r) => [String(r.variantId), r.quantity]),
  );

  // The plain element shape, not OrderDoc["items"] — that is a Mongoose
  // DocumentArray and cannot be built from a bare literal.
  type OrderItemInput = {
    variantId: Types.ObjectId;
    productId: Types.ObjectId;
    sku: string;
    nameSnapshot: string;
    colourSnapshot: string;
    sizeSnapshot: string;
    imageSnapshot: string;
    unitPrice: number;
    quantity: number;
  };
  const items: OrderItemInput[] = [];
  const priceableLines = [];

  for (const line of cart.items) {
    const variant = variantById.get(String(line.variantId));
    const product = variant ? productById.get(String(variant.productId)) : undefined;

    if (!variant || !product || product.status !== "active") {
      throw new ConflictError(
        "Something in your bag is no longer sold. Take it out and try again.",
        { variantId: String(line.variantId) },
      );
    }

    /**
     * Make sure the hold still covers this line. Holds expire, and a shopper
     * can sit on a checkout page for an hour — so top up the difference here,
     * and if the units are gone, say exactly which piece and how many are
     * left rather than a generic failure.
     */
    const held = heldByVariant.get(String(line.variantId)) ?? 0;
    const shortfall = line.quantity - held;
    if (shortfall > 0) {
      await reserve({
        cartId: cart._id,
        variantId: line.variantId,
        quantity: shortfall,
        ttlMinutes: env.RESERVATION_TTL_MINUTES,
        label: `${product.name} in ${variant.size}`,
      });
    }

    items.push({
      variantId: variant._id,
      productId: variant.productId,
      sku: variant.sku,
      // Snapshotted, so this order still reads correctly after the piece is
      // renamed, repriced or archived.
      nameSnapshot: product.name,
      colourSnapshot: variant.colour?.name ?? "",
      sizeSnapshot: variant.size,
      imageSnapshot: product.images[0]?.url ?? "",
      unitPrice: variant.price,
      quantity: line.quantity,
    });

    priceableLines.push({
      variantId: variant._id,
      quantity: line.quantity,
      unitPrice: variant.price,
    });
  }

  // Recomputed here from current prices. Nothing price-shaped from the request
  // is consulted, including the cart's own priceSnapshot.
  const pricing = await computePricing({
    lines: priceableLines,
    couponCode: cart.couponCode,
    userId,
  });

  if (cart.couponCode) {
    const claimed = await claimCouponUse(cart.couponCode);
    if (!claimed) {
      throw new ConflictError(
        `${cart.couponCode} ran out just now. Remove it and place the order again.`,
        { couponCode: cart.couponCode },
      );
    }
  }

  const shipping = snapshotAddress(input.shippingAddress);
  const billing = input.billingAddress
    ? snapshotAddress(input.billingAddress)
    : shipping;

  // Extend the holds to cover the payment attempt.
  const holdUntil = new Date(Date.now() + env.RESERVATION_TTL_MINUTES * 60_000);
  await Reservation.updateMany(
    { cartId: cart._id, releasedAt: null },
    { $set: { expiresAt: holdUntil } },
  );

  // A collision on orderNumber is astronomically unlikely but cheap to retry.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const order = await Order.create({
        orderNumber: newOrderNumber(),
        userId,
        email: input.email.toLowerCase(),
        items,
        pricing: {
          subtotal: pricing.subtotal,
          discount: pricing.discount,
          shipping: pricing.shipping,
          tax: pricing.tax,
          total: pricing.total,
        },
        currency: "INR",
        shippingAddress: shipping,
        billingAddress: billing,
        couponCode: cart.couponCode ?? null,
        status: "pending_payment",
        statusHistory: [{ status: "pending_payment", at: new Date(), actorId: null }],
        idempotencyKey,
        cartId: cart._id,
        placedAt: new Date(),
      });
      return { order, replayed: false };
    } catch (error) {
      const duplicate =
        typeof error === "object" &&
        error !== null &&
        (error as { code?: number }).code === 11000;
      const keyPattern = (error as { keyPattern?: Record<string, unknown> })?.keyPattern ?? {};

      if (duplicate && "idempotencyKey" in keyPattern) {
        // Another request with the same key won the race. Hand back its order
        // — and give the coupon use back, since that order already claimed one.
        if (cart.couponCode) await releaseCouponUse(cart.couponCode);
        const winner = await Order.findOne({ idempotencyKey });
        if (winner) return { order: winner, replayed: true };
      }
      if (duplicate && "orderNumber" in keyPattern) {
        continue; // retry with a fresh number
      }
      if (cart.couponCode) await releaseCouponUse(cart.couponCode);
      throw error;
    }
  }

  if (cart.couponCode) await releaseCouponUse(cart.couponCode);
  throw new ConflictError("Could not allocate an order number. Try again.");
}

/**
 * Payment succeeded: turn every hold on this order into a permanent decrement.
 *
 * Ordering matters and is chosen to fail safe:
 *   1. claim the reservations (stamp releasedAt) so the sweeper will delete
 *      them without decrementing — otherwise a sweep landing mid-commit would
 *      release units that step 2 is about to consume
 *   2. fulfil each line, which is itself guarded and so is replay-safe
 *   3. delete the reservation rows and convert the cart
 *
 * A crash between 1 and 2 leaks the units (reserved stays high), which
 * reconciliation reports. The opposite ordering could release and then fulfil
 * the same units, pushing counters below the truth — an oversell.
 */
export async function commitOrderStock(order: OrderDoc): Promise<void> {
  if (!order.cartId) {
    logger.warn({ orderId: String(order._id) }, "order has no cart to commit");
  }

  if (order.cartId) {
    await Reservation.updateMany(
      { cartId: order.cartId, releasedAt: null },
      { $set: { releasedAt: new Date() } },
    );
  }

  for (const item of order.items) {
    await fulfil({
      orderId: order._id,
      variantId: item.variantId,
      quantity: item.quantity,
      reason: `paid on order ${order.orderNumber}`,
    });
  }

  if (order.cartId) {
    await Reservation.deleteMany({ cartId: order.cartId });
    await Cart.updateOne(
      { _id: order.cartId },
      { $set: { convertedAt: new Date(), items: [], couponCode: null } },
    );
  }
}

/**
 * Moves an order along, appending to the history rather than overwriting a
 * field. The transition is checked, and the update is conditional on the
 * status we believe it is in — so two admins clicking at once cannot both
 * apply a move from the same starting point.
 */
export async function transitionOrder(args: {
  orderId: Types.ObjectId;
  to: OrderStatus;
  actorId?: Types.ObjectId | null;
  note?: string;
}): Promise<OrderDoc> {
  const order = await Order.findById(args.orderId);
  if (!order) throw new NotFoundError("That order");

  assertTransition(order.status, args.to);
  if (order.status === args.to) return order;

  const updated = await Order.findOneAndUpdate(
    { _id: args.orderId, status: order.status },
    {
      $set: { status: args.to },
      $push: {
        statusHistory: {
          status: args.to,
          at: new Date(),
          actorId: args.actorId ?? null,
          note: args.note ?? null,
        },
      },
    },
    { new: true },
  );

  if (!updated) {
    // Someone else moved it between our read and our write.
    throw new ConflictError(
      "That order changed while you were looking at it. Reload and try again.",
    );
  }

  return updated;
}

/**
 * Cancels an order and puts the stock back.
 *
 * Which stock operation depends on whether payment ever landed. An unpaid
 * order was only ever holding units, so those are released. A paid order took
 * them off the shelf, so they have to be received back — releasing would
 * decrement `reserved` that no longer includes them and lose a unit.
 */
export async function cancelOrder(args: {
  orderId: Types.ObjectId;
  actorId?: Types.ObjectId | null;
  reason: string;
  byCustomer?: boolean;
}): Promise<OrderDoc> {
  const order = await Order.findById(args.orderId);
  if (!order) throw new NotFoundError("That order");

  if (args.byCustomer && !CUSTOMER_CANCELLABLE.includes(order.status)) {
    throw new ConflictError(
      order.status === "shipped" || order.status === "delivered"
        ? "This has already gone out. Start a return instead."
        : "This order can no longer be cancelled.",
      { status: order.status },
    );
  }

  const wasCommitted = order.status !== "pending_payment";

  const updated = await transitionOrder({
    orderId: order._id,
    to: "cancelled",
    actorId: args.actorId ?? null,
    note: args.reason,
  });

  for (const item of order.items) {
    if (wasCommitted) {
      await receive({
        variantId: item.variantId,
        quantity: item.quantity,
        reason: `cancelled order ${order.orderNumber}`,
        refType: "order",
        refId: order._id,
        actorId: args.actorId ?? null,
        type: "return",
      });
    } else if (order.cartId) {
      await release({
        cartId: order.cartId,
        variantId: item.variantId,
        quantity: item.quantity,
        reason: `cancelled order ${order.orderNumber}`,
      });
    }
  }

  if (!wasCommitted && order.cartId) {
    await Reservation.deleteMany({ cartId: order.cartId });
  }

  if (order.couponCode) {
    await releaseCouponUse(order.couponCode);
  }

  return updated;
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export interface OrderListPage {
  items: OrderDoc[];
  nextCursor: string | null;
}

/** Keyset pagination on (placedAt, _id), same reasoning as the catalog. */
export async function listOrdersForUser(args: {
  userId: Types.ObjectId;
  limit: number;
  cursor?: string | undefined;
}): Promise<OrderListPage> {
  const filter: Record<string, unknown> = { userId: args.userId };

  if (args.cursor) {
    try {
      const { v, id } = JSON.parse(
        Buffer.from(args.cursor, "base64url").toString("utf8"),
      ) as { v: string; id: string };
      filter.$or = [
        { placedAt: { $lt: new Date(v) } },
        { placedAt: new Date(v), _id: { $lt: id } },
      ];
    } catch {
      // Ignore an unreadable cursor and serve the first page.
    }
  }

  const rows = await Order.find(filter)
    .sort({ placedAt: -1, _id: -1 })
    .limit(args.limit + 1);

  const hasMore = rows.length > args.limit;
  const items = hasMore ? rows.slice(0, args.limit) : rows;
  const last = items.at(-1);

  return {
    items,
    nextCursor:
      hasMore && last
        ? Buffer.from(
            JSON.stringify({ v: last.placedAt.toISOString(), id: String(last._id) }),
          ).toString("base64url")
        : null,
  };
}

export async function getOrderForUser(args: {
  orderNumber: string;
  userId: Types.ObjectId;
}): Promise<OrderDoc> {
  const order = await Order.findOne({
    orderNumber: args.orderNumber.toUpperCase(),
    // Scoped to the owner, so an order number cannot be walked.
    userId: args.userId,
  });
  if (!order) throw new NotFoundError("That order");
  return order;
}

/** Whether a variant is still buyable, for the "only n left" messaging. */
export async function availabilityForOrderItems(order: OrderDoc): Promise<
  Map<string, number>
> {
  const items = await InventoryItem.find({
    variantId: { $in: order.items.map((item) => item.variantId) },
  }).lean();
  return new Map(
    items.map((item) => [String(item.variantId), item.onHand - item.reserved]),
  );
}

export { InsufficientStockError };
