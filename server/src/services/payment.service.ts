import type { Types } from "mongoose";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { publishableKey, razorpay } from "../lib/razorpay.js";
import {
  Order,
  Payment,
  WebhookEvent,
  type OrderDoc,
  type PaymentDoc,
} from "../models/index.js";
import { commitOrderStock, transitionOrder } from "./order.service.js";

/**
 * Creates the gateway-side order the browser checkout needs, and our Payment
 * row alongside it.
 *
 * The amount comes from `order.pricing.total`, which was computed on the
 * server from current prices. It is never taken from the request.
 */
export async function createGatewayOrder(order: OrderDoc): Promise<{
  payment: PaymentDoc;
  keyId: string;
}> {
  if (order.status !== "pending_payment") {
    throw new ConflictError("This order has already been paid for.", {
      status: order.status,
    });
  }

  const existing = await Payment.findOne({ orderId: order._id });
  if (existing && existing.status === "created") {
    // Reusing the gateway order means a shopper who closed the modal and came
    // back does not create a second one.
    return { payment: existing, keyId: publishableKey() };
  }

  const gatewayOrder = await razorpay().orders.create({
    amount: order.pricing.total,
    currency: order.currency,
    receipt: order.orderNumber,
    notes: { orderNumber: order.orderNumber, orderId: String(order._id) },
  });

  const payment = await Payment.create({
    orderId: order._id,
    gateway: "razorpay",
    gatewayOrderId: gatewayOrder.id,
    amount: order.pricing.total,
    currency: order.currency,
    status: "created",
  });

  await Order.updateOne({ _id: order._id }, { $set: { paymentId: payment._id } });

  return { payment, keyId: publishableKey() };
}

/* -------------------------------------------------------------------------- */
/* Webhooks                                                                   */
/* -------------------------------------------------------------------------- */

export interface WebhookOutcome {
  status: "processed" | "duplicate" | "ignored";
  event: string;
  orderNumber?: string;
}

/**
 * ------------------------------------------------------------------------
 * WEBHOOK IDEMPOTENCY — the database decides, not an `if`.
 * ------------------------------------------------------------------------
 *
 * Razorpay retries on any non-2xx, and delivers twice on its own often enough
 * that it has to be assumed. A `payment.captured` processed twice would
 * decrement stock twice for one sale and send two confirmations; a refund
 * processed twice could return the money twice.
 *
 * The obvious guard — "have I seen this event id? if not, process it" — is two
 * operations with a gap, and two simultaneous deliveries both pass the check
 * before either writes. So the insert goes first: the unique index on
 * (gateway, eventId) means exactly one insert can succeed, and the loser's
 * duplicate-key error IS the answer "already handled". No lock, no race.
 *
 * `processedAt` is stamped only after the state change lands, so an event that
 * arrived and then failed is distinguishable from one that completed — and can
 * be replayed deliberately rather than being mistaken for a duplicate.
 */
export async function handleWebhook(args: {
  eventId: string;
  event: string;
  payload: Record<string, unknown>;
}): Promise<WebhookOutcome> {
  let record;
  try {
    record = await WebhookEvent.create({
      gateway: "razorpay",
      eventId: args.eventId,
      event: args.event,
      payload: args.payload,
      receivedAt: new Date(),
    });
  } catch (error) {
    const duplicate =
      typeof error === "object" &&
      error !== null &&
      (error as { code?: number }).code === 11000;
    if (duplicate) {
      logger.info({ eventId: args.eventId, event: args.event }, "webhook already handled");
      return { status: "duplicate", event: args.event };
    }
    throw error;
  }

  try {
    const outcome = await applyEvent(args.event, args.payload);
    await WebhookEvent.updateOne(
      { _id: record._id },
      { $set: { processedAt: new Date() } },
    );
    return outcome;
  } catch (error) {
    // Leave processedAt null and record why, so this is visibly unfinished
    // rather than silently counted as done.
    await WebhookEvent.updateOne(
      { _id: record._id },
      { $set: { error: error instanceof Error ? error.message : String(error) } },
    );
    throw error;
  }
}

interface RazorpayEntity {
  id?: string;
  order_id?: string;
  amount?: number;
  method?: string;
  error_description?: string;
}

function entityOf(payload: Record<string, unknown>, kind: "payment" | "refund"): RazorpayEntity {
  const container = payload[kind] as { entity?: RazorpayEntity } | undefined;
  return container?.entity ?? {};
}

async function applyEvent(
  event: string,
  payload: Record<string, unknown>,
): Promise<WebhookOutcome> {
  switch (event) {
    case "payment.captured":
    case "order.paid":
      return markPaid(entityOf(payload, "payment"), event);
    case "payment.failed":
      return markFailed(entityOf(payload, "payment"), event);
    case "refund.processed":
      return markRefunded(entityOf(payload, "refund"), event);
    default:
      // Razorpay sends a lot of events we have no opinion about. Recording and
      // ignoring is correct; erroring would make it retry forever.
      logger.debug({ event }, "webhook event ignored");
      return { status: "ignored", event };
  }
}

async function findPaymentByGatewayOrder(orderId: string | undefined) {
  if (!orderId) return null;
  return Payment.findOne({ gatewayOrderId: orderId });
}

/**
 * The money landed. This is where a hold becomes a sale.
 *
 * Guarded at both levels: the transition helper treats "already paid" as a
 * no-op, and `fulfil` inside `commitOrderStock` is itself conditional — so a
 * replay that somehow got past the event-id check still cannot decrement
 * stock twice.
 */
async function markPaid(entity: RazorpayEntity, event: string): Promise<WebhookOutcome> {
  const payment = await findPaymentByGatewayOrder(entity.order_id);
  if (!payment) {
    logger.warn({ gatewayOrderId: entity.order_id }, "webhook for an unknown payment");
    return { status: "ignored", event };
  }

  const order = await Order.findById(payment.orderId);
  if (!order) throw new NotFoundError("The order for that payment");

  /**
   * The amount is checked against what we asked for. A mismatch means either
   * a bug or someone paying a different amount than the order — either way it
   * must not be treated as settled.
   */
  if (typeof entity.amount === "number" && entity.amount !== payment.amount) {
    logger.error(
      { expected: payment.amount, received: entity.amount, orderNumber: order.orderNumber },
      "payment amount does not match the order",
    );
    throw new ConflictError("The amount paid does not match the order total.");
  }

  await Payment.updateOne(
    { _id: payment._id },
    {
      $set: {
        status: "captured",
        gatewayPaymentId: entity.id ?? payment.gatewayPaymentId,
        method: entity.method ?? payment.method,
      },
      $push: {
        events: { eventId: entity.id ?? event, event, receivedAt: new Date(), payload: entity },
      },
    },
  );

  if (order.status === "pending_payment") {
    await transitionOrder({
      orderId: order._id,
      to: "paid",
      note: `${event} received`,
    });
    await commitOrderStock(order);
  }

  return { status: "processed", event, orderNumber: order.orderNumber };
}

/**
 * The payment failed. The holds are deliberately left alone: the shopper is
 * very likely about to try another card, and releasing their stock the instant
 * a card is declined would lose them the sale. The sweeper picks the holds up
 * if they really do walk away.
 */
async function markFailed(entity: RazorpayEntity, event: string): Promise<WebhookOutcome> {
  const payment = await findPaymentByGatewayOrder(entity.order_id);
  if (!payment) return { status: "ignored", event };

  const order = await Order.findById(payment.orderId);
  if (!order) return { status: "ignored", event };

  await Payment.updateOne(
    { _id: payment._id },
    {
      $set: { status: "failed", gatewayPaymentId: entity.id ?? payment.gatewayPaymentId },
      $push: {
        events: { eventId: entity.id ?? event, event, receivedAt: new Date(), payload: entity },
      },
    },
  );

  if (order.status === "pending_payment") {
    await transitionOrder({
      orderId: order._id,
      to: "payment_failed",
      note: entity.error_description ?? "payment failed at the gateway",
    });
  }

  return { status: "processed", event, orderNumber: order.orderNumber };
}

async function markRefunded(entity: RazorpayEntity, event: string): Promise<WebhookOutcome> {
  const payment = await Payment.findOne({
    $or: [
      { gatewayPaymentId: entity.id },
      { gatewayOrderId: entity.order_id },
    ],
  });
  if (!payment) return { status: "ignored", event };

  const order = await Order.findById(payment.orderId);
  if (!order) return { status: "ignored", event };

  const refunded = typeof entity.amount === "number" ? entity.amount : payment.amount;

  await Payment.updateOne(
    { _id: payment._id },
    {
      $set: {
        status: refunded >= payment.amount ? "refunded" : "partially_refunded",
        amountRefunded: Math.min(payment.amount, payment.amountRefunded + refunded),
      },
      $push: {
        events: { eventId: entity.id ?? event, event, receivedAt: new Date(), payload: entity },
      },
    },
  );

  return { status: "processed", event, orderNumber: order.orderNumber };
}

/** Issues a refund for a return. Amount in paise. */
export async function refundPayment(args: {
  orderId: Types.ObjectId;
  amount: number;
  reason: string;
}): Promise<string> {
  const payment = await Payment.findOne({ orderId: args.orderId });
  if (!payment?.gatewayPaymentId) {
    throw new ConflictError("There is no captured payment on that order to refund.");
  }

  const refund = await razorpay().payments.refund(payment.gatewayPaymentId, {
    amount: args.amount,
    notes: { reason: args.reason },
  });

  await Payment.updateOne(
    { _id: payment._id },
    {
      $set: {
        status:
          args.amount >= payment.amount - payment.amountRefunded
            ? "refunded"
            : "partially_refunded",
      },
      $inc: { amountRefunded: args.amount },
    },
  );

  return refund.id;
}
