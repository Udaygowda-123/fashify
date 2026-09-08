/**
 * Every model in one import, and one place to build indexes from.
 *
 * Mongoose creates indexes lazily by default, which means the first request
 * after a deploy can run without the unique index that makes it correct — the
 * idempotency key and the webhook event id both depend on theirs existing. So
 * `syncIndexes` is called explicitly at boot rather than left to autoIndex.
 */
export { Product, type ProductDoc } from "./product.model.js";
export { Variant, type VariantDoc } from "./variant.model.js";
export { InventoryItem, type InventoryItemDoc } from "./inventory-item.model.js";
export { StockMovement, type StockMovementDoc } from "./stock-movement.model.js";
export { Reservation, type ReservationDoc } from "./reservation.model.js";
export { Cart, type CartDoc } from "./cart.model.js";
export { Order, type OrderDoc } from "./order.model.js";
export { Payment, type PaymentDoc } from "./payment.model.js";
export { WebhookEvent, type WebhookEventDoc } from "./webhook-event.model.js";
export { Coupon, type CouponDoc } from "./coupon.model.js";
export { Return, type ReturnDoc } from "./return.model.js";
export {
  BackInStockRequest,
  type BackInStockRequestDoc,
} from "./back-in-stock-request.model.js";
export { User, type UserDoc } from "./user.model.js";
export * from "./types.js";

import { BackInStockRequest } from "./back-in-stock-request.model.js";
import { Cart } from "./cart.model.js";
import { Coupon } from "./coupon.model.js";
import { InventoryItem } from "./inventory-item.model.js";
import { Order } from "./order.model.js";
import { Payment } from "./payment.model.js";
import { Product } from "./product.model.js";
import { Reservation } from "./reservation.model.js";
import { Return } from "./return.model.js";
import { StockMovement } from "./stock-movement.model.js";
import { User } from "./user.model.js";
import { Variant } from "./variant.model.js";
import { WebhookEvent } from "./webhook-event.model.js";
import { logger } from "../lib/logger.js";

const ALL = [
  Product,
  Variant,
  InventoryItem,
  StockMovement,
  Reservation,
  Cart,
  Order,
  Payment,
  WebhookEvent,
  Coupon,
  Return,
  BackInStockRequest,
  User,
];

/**
 * Builds every declared index. Safe to run repeatedly; existing indexes are
 * left alone and ones no longer declared are dropped.
 */
export async function syncIndexes(): Promise<void> {
  for (const model of ALL) {
    await model.syncIndexes();
  }
  logger.info({ collections: ALL.length }, "indexes synced");
}
