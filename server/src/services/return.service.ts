import type { Types } from "mongoose";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { Order, Return, type ReturnDoc } from "../models/index.js";
import type { ReturnStatus } from "../models/types.js";
import { receive } from "./inventory.service.js";
import { refundPayment } from "./payment.service.js";
import { transitionOrder } from "./order.service.js";

/**
 * Returns have their own state machine, for the same reason orders do: the
 * steps happen days apart, in the real world, and each one has a side effect
 * that must not be repeated.
 *
 *   requested → approved | rejected
 *   approved  → received | rejected
 *   received  → refunded
 */
export const RETURN_TRANSITIONS: Record<ReturnStatus, readonly ReturnStatus[]> = {
  requested: ["approved", "rejected"],
  approved: ["received", "rejected"],
  received: ["refunded"],
  refunded: [],
  rejected: [],
};

/** How long after delivery a return can still be started. */
export const RETURN_WINDOW_DAYS = 30;

export interface RequestReturnInput {
  orderNumber: string;
  userId: Types.ObjectId;
  reason: string;
  /** SKU and quantity; prices come from the order, never the request. */
  items: { sku: string; quantity: number }[];
}

export async function requestReturn(input: RequestReturnInput): Promise<ReturnDoc> {
  const order = await Order.findOne({
    orderNumber: input.orderNumber.toUpperCase(),
    userId: input.userId,
  });
  if (!order) throw new NotFoundError("That order");

  if (order.status !== "delivered") {
    throw new ConflictError(
      order.status === "shipped"
        ? "This is still on its way. You can start a return once it arrives."
        : "Only delivered orders can be returned.",
      { status: order.status },
    );
  }

  const delivered = order.statusHistory.findLast((event) => event.status === "delivered");
  const deliveredAt = delivered?.at ?? order.placedAt;
  const daysSince = (Date.now() - deliveredAt.getTime()) / (24 * 3600 * 1000);
  if (daysSince > RETURN_WINDOW_DAYS) {
    throw new ConflictError(
      `Returns are open for ${RETURN_WINDOW_DAYS} days, and this arrived ${Math.floor(daysSince)} days ago.`,
    );
  }

  const existing = await Return.findOne({
    orderId: order._id,
    status: { $nin: ["rejected"] },
  });
  if (existing) {
    throw new ConflictError("There is already a return open on this order.", {
      returnId: String(existing._id),
    });
  }

  // Quantities are checked against the order, and prices are taken FROM the
  // order — so a request cannot claim more than was bought, or a higher price
  // than was paid.
  const items: ReturnDoc["items"] = [] as unknown as ReturnDoc["items"];
  let refundAmount = 0;

  for (const requested of input.items) {
    const line = order.items.find((item) => item.sku === requested.sku);
    if (!line) {
      throw new ConflictError(`${requested.sku} is not on that order.`);
    }
    if (requested.quantity < 1 || requested.quantity > line.quantity) {
      throw new ConflictError(
        `You bought ${line.quantity} of ${line.nameSnapshot}, so ${requested.quantity} cannot be returned.`,
      );
    }
    refundAmount += line.unitPrice * requested.quantity;
    (items as unknown as unknown[]).push({
      variantId: line.variantId,
      sku: line.sku,
      nameSnapshot: line.nameSnapshot,
      quantity: requested.quantity,
      unitPrice: line.unitPrice,
      restock: true,
    });
  }

  const created = await Return.create({
    orderId: order._id,
    userId: input.userId,
    items,
    reason: input.reason,
    status: "requested",
    refundAmount,
    statusHistory: [{ status: "requested", at: new Date(), actorId: input.userId }],
  });

  // The order follows the return into its own state.
  await transitionOrder({
    orderId: order._id,
    to: "return_requested",
    actorId: input.userId,
    note: `return ${String(created._id)} requested`,
  });

  return created;
}

function assertReturnTransition(from: ReturnStatus, to: ReturnStatus): void {
  if (from === to) return;
  if (!RETURN_TRANSITIONS[from].includes(to)) {
    throw new ConflictError(
      `A return that is ${from} cannot become ${to}.`,
      { from, to, allowed: RETURN_TRANSITIONS[from] },
    );
  }
}

/**
 * Moves a return along, and applies the side effect that belongs to each step.
 *
 * `received` is where stock goes back — and only for lines marked restockable,
 * because a piece returned worn or damaged must not be sold to the next
 * shopper. `restockedAt` is stamped first and checked, so approving twice
 * cannot put the same units back twice.
 *
 * `refunded` is where the money goes back and the order becomes `returned`.
 */
export async function advanceReturn(args: {
  returnId: Types.ObjectId;
  to: ReturnStatus;
  actorId?: Types.ObjectId | null;
  note?: string;
  /** Overrides which lines go back on the shelf, set by the person unpacking. */
  restock?: Record<string, boolean>;
}): Promise<ReturnDoc> {
  const record = await Return.findById(args.returnId);
  if (!record) throw new NotFoundError("That return");

  assertReturnTransition(record.status, args.to);
  if (record.status === args.to) return record;

  const order = await Order.findById(record.orderId);
  if (!order) throw new NotFoundError("The order for that return");

  if (args.restock) {
    for (const [index, item] of record.items.entries()) {
      const decision = args.restock[item.sku];
      if (typeof decision === "boolean") {
        record.set(`items.${index}.restock`, decision);
      }
    }
    await record.save();
  }

  const updated = await Return.findOneAndUpdate(
    { _id: record._id, status: record.status },
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
    throw new ConflictError("That return changed while you were looking at it.");
  }

  if (args.to === "received") {
    // Guarded so a second `received` cannot restock again.
    const claimed = await Return.findOneAndUpdate(
      { _id: record._id, restockedAt: null },
      { $set: { restockedAt: new Date() } },
      { new: true },
    );
    if (claimed) {
      for (const item of claimed.items) {
        if (!item.restock) {
          logger.info(
            { sku: item.sku, returnId: String(claimed._id) },
            "not restocking: came back unsellable",
          );
          continue;
        }
        await receive({
          variantId: item.variantId,
          quantity: item.quantity,
          reason: `returned on order ${order.orderNumber}`,
          refType: "return",
          refId: claimed._id,
          actorId: args.actorId ?? null,
          type: "return",
        });
      }
    }
  }

  if (args.to === "refunded") {
    try {
      const refundId = await refundPayment({
        orderId: order._id,
        amount: updated.refundAmount,
        reason: `return ${String(updated._id)}`,
      });
      await Return.updateOne({ _id: updated._id }, { $set: { gatewayRefundId: refundId } });
    } catch (error) {
      // Payments may not be configured in development. The return still moves,
      // and the failure is recorded rather than hidden.
      logger.error({ err: error, returnId: String(updated._id) }, "refund could not be issued");
      await Return.updateOne(
        { _id: updated._id },
        { $set: { notes: `refund not issued: ${error instanceof Error ? error.message : String(error)}` } },
      );
    }

    await transitionOrder({
      orderId: order._id,
      to: "returned",
      actorId: args.actorId ?? null,
      note: `return ${String(updated._id)} refunded`,
    });
  }

  if (args.to === "rejected") {
    await transitionOrder({
      orderId: order._id,
      to: "rejected",
      actorId: args.actorId ?? null,
      note: args.note ?? "return rejected",
    });
  }

  const fresh = await Return.findById(updated._id);
  return fresh ?? updated;
}

export async function listReturnsForUser(userId: Types.ObjectId): Promise<ReturnDoc[]> {
  return Return.find({ userId }).sort({ createdAt: -1 }).limit(50);
}

export async function listReturnsForAdmin(status?: ReturnStatus): Promise<ReturnDoc[]> {
  return Return.find(status ? { status } : {})
    .sort({ createdAt: -1 })
    .limit(100);
}
