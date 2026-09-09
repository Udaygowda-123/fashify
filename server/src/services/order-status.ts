import { InvalidStatusTransitionError } from "../lib/errors.js";
import type { OrderStatus } from "../models/types.js";

/**
 * ------------------------------------------------------------------------
 * ORDER STATUS IS A STATE MACHINE, NOT A STRING.
 * ------------------------------------------------------------------------
 *
 * The tempting version is `order.status = req.body.status`. That accepts every
 * transition, including the ones that make no sense and the ones that cost
 * money: a delivered order moved back to pending_payment, a refunded order
 * marked paid, a cancelled order shipped. Worse, it accepts them silently, so
 * the damage is discovered from the consequences rather than from an error.
 *
 * Declaring the legal moves turns "what can happen next" into data that can be
 * read, tested and shown in the admin, and makes everything else a 409.
 *
 * Exactly the map from the brief:
 *
 *   pending_payment → paid | payment_failed | cancelled
 *   paid            → processing | refunded
 *   processing      → shipped | cancelled
 *   shipped         → delivered
 *   delivered       → return_requested
 *   return_requested→ returned | rejected
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ["paid", "payment_failed", "cancelled"],
  paid: ["processing", "refunded"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["return_requested"],
  return_requested: ["returned", "rejected"],
  // Ends of the line. Nothing follows, so nothing may.
  returned: [],
  rejected: [],
  cancelled: [],
  payment_failed: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** Throws a 409 naming what was allowed, so the caller can correct itself. */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (from === to) {
    // Re-asserting the current status is a no-op, not a mistake — a webhook
    // replay does exactly this.
    return;
  }
  if (!canTransition(from, to)) {
    throw new InvalidStatusTransitionError(from, to, ORDER_TRANSITIONS[from]);
  }
}

export function isTerminal(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status].length === 0;
}

/** Statuses where the money has been taken and the stock has left the shelf. */
export const COMMITTED_STATUSES: readonly OrderStatus[] = [
  "paid",
  "processing",
  "shipped",
  "delivered",
  "return_requested",
  "returned",
];

/**
 * Statuses a shopper is still allowed to cancel from, themselves.
 *
 * Deliberately just `pending_payment`: the declared map only allows
 * `paid -> processing | refunded` and `processing -> shipped | cancelled`, so
 * once money has moved there is no direct "cancelled" transition out of
 * `paid` — stopping a paid order means refunding it, not cancelling it. Admin
 * staff can still move a `processing` order to `cancelled`, which is legal and
 * goes through the same cancelOrder() path (see order.service.ts); it is just
 * not something a customer triggers themselves through this list.
 */
export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = ["pending_payment"];
