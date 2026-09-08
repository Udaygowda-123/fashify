import { Router } from "express";
import { z } from "zod";
import { ConflictError, ValidationError } from "../../lib/errors.js";
import { verifyCheckoutSignature } from "../../lib/razorpay.js";
import { requireAuth } from "../../middleware/auth.js";
import { checkoutLimiter } from "../../middleware/rate-limit.js";
import { input, validate } from "../../middleware/validate.js";
import { Order, Payment } from "../../models/index.js";
import { extendHolds, getCartView, getOrCreateCart } from "../../services/cart.service.js";
import { createOrder } from "../../services/order.service.js";
import { createGatewayOrder, handleWebhook } from "../../services/payment.service.js";

const addressSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "An Indian mobile number is ten digits starting 6 to 9."),
  line1: z.string().trim().min(3).max(300),
  line2: z.string().trim().max(300).nullish(),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(120),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "A PIN code is six digits and cannot start with 0."),
  country: z.string().trim().length(2).default("IN"),
});

const createOrderBody = z.object({
  email: z.string().trim().email("That does not look like an email address."),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.nullish(),
  /**
   * Note what is absent: no prices, no totals, no discount. The server
   * recomputes all of it, and zod strips anything else the client sends.
   */
});

const verifyBody = z.object({
  razorpayOrderId: z.string().trim().min(4),
  razorpayPaymentId: z.string().trim().min(4),
  signature: z.string().trim().min(8),
});

export const checkoutRouter: Router = Router();

checkoutRouter.use(requireAuth, checkoutLimiter);

/** Keeps the shopper's holds alive while they fill the form in. */
checkoutRouter.post("/extend", async (req, res) => {
  const cart = await getOrCreateCart({ userId: req.auth!.userId });
  res.json({ holdsExpireAt: await extendHolds(cart._id) });
});

/**
 * Creates the order. Idempotent on the Idempotency-Key header — a
 * double-tapped Place Order button gets one order and two 200s.
 */
checkoutRouter.post("/orders", validate({ body: createOrderBody }), async (req, res) => {
  const { body } = input<z.infer<typeof createOrderBody>>(res);

  const idempotencyKey = req.headers["idempotency-key"];
  if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length < 8) {
    throw new ValidationError(
      "This request needs an Idempotency-Key header of at least 8 characters.",
      { fields: { "idempotency-key": "Missing or too short." } },
    );
  }

  const cart = await getOrCreateCart({ userId: req.auth!.userId });
  const { order, replayed } = await createOrder({
    cart,
    userId: req.auth!.userId,
    email: body.email,
    shippingAddress: body.shippingAddress,
    billingAddress: body.billingAddress ?? null,
    idempotencyKey: idempotencyKey.trim(),
  });

  // 200 on a replay, 201 on a genuinely new order, so the client can tell.
  res.status(replayed ? 200 : 201).json({
    order: {
      id: String(order._id),
      orderNumber: order.orderNumber,
      status: order.status,
      pricing: order.pricing,
      items: order.items,
      placedAt: order.placedAt,
    },
    replayed,
  });
});

/** Creates the gateway order the browser checkout opens with. */
checkoutRouter.post(
  "/orders/:orderNumber/payment",
  validate({ params: z.object({ orderNumber: z.string().trim().min(4).max(32) }) }),
  async (req, res) => {
    const { params } = input<unknown, unknown, { orderNumber: string }>(res);
    const order = await Order.findOne({
      orderNumber: params.orderNumber.toUpperCase(),
      userId: req.auth!.userId,
    });
    if (!order) throw new ConflictError("That order could not be found on this account.");

    const { payment, keyId } = await createGatewayOrder(order);

    res.json({
      keyId,
      gatewayOrderId: payment.gatewayOrderId,
      // Paise, as Razorpay expects, and as the order stores it.
      amount: payment.amount,
      currency: payment.currency,
      orderNumber: order.orderNumber,
    });
  },
);

/**
 * The browser's success callback.
 *
 * This confirms the signature so the client can be shown a confirmation
 * immediately, but it is NOT what settles the order — the webhook is. Treating
 * this as authoritative would mean an order could be settled by whoever can
 * reach this endpoint, and would leave orders stuck whenever a shopper closed
 * the tab before the callback fired.
 *
 * It does nudge the same handler the webhook uses, keyed on the payment id, so
 * whichever arrives first wins and the second is a no-op duplicate.
 */
checkoutRouter.post("/verify", validate({ body: verifyBody }), async (req, res) => {
  const { body } = input<z.infer<typeof verifyBody>>(res);

  verifyCheckoutSignature({
    razorpayOrderId: body.razorpayOrderId,
    razorpayPaymentId: body.razorpayPaymentId,
    signature: body.signature,
  });

  const payment = await Payment.findOne({ gatewayOrderId: body.razorpayOrderId });
  if (!payment) throw new ConflictError("That payment could not be found.");

  const order = await Order.findOne({ _id: payment.orderId, userId: req.auth!.userId });
  if (!order) throw new ConflictError("That payment is not on this account.");

  const outcome = await handleWebhook({
    // Same id the webhook would use, so the two cannot both apply.
    eventId: `payment.captured:${body.razorpayPaymentId}`,
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: body.razorpayPaymentId,
          order_id: body.razorpayOrderId,
          amount: payment.amount,
        },
      },
    },
  });

  const fresh = await Order.findById(order._id);
  res.json({
    orderNumber: fresh?.orderNumber,
    status: fresh?.status,
    settledBy: outcome.status,
  });
});

/** The bag as checkout sees it, so the summary and the server agree. */
checkoutRouter.get("/summary", async (req, res) => {
  const cart = await getOrCreateCart({ userId: req.auth!.userId });
  res.json(await getCartView(cart));
});
