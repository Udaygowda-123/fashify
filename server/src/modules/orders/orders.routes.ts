import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { input, validate } from "../../middleware/validate.js";
import {
  cancelOrder,
  getOrderForUser,
  listOrdersForUser,
} from "../../services/order.service.js";
import { CUSTOMER_CANCELLABLE } from "../../services/order-status.js";

const listQuery = z.object({
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const orderParam = z.object({
  orderNumber: z.string().trim().min(4).max(32),
});

const cancelBody = z.object({
  reason: z.string().trim().min(3).max(300).default("changed my mind"),
});

/** What the shopper is shown. Internal ids and the cart link stay server-side. */
function present(order: Awaited<ReturnType<typeof getOrderForUser>>) {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    placedAt: order.placedAt,
    pricing: order.pricing,
    currency: order.currency,
    couponCode: order.couponCode,
    items: order.items.map((item) => ({
      sku: item.sku,
      name: item.nameSnapshot,
      colour: item.colourSnapshot,
      size: item.sizeSnapshot,
      image: item.imageSnapshot,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
    })),
    shippingAddress: order.shippingAddress,
    statusHistory: order.statusHistory.map((event) => ({
      status: event.status,
      at: event.at,
      note: event.note,
    })),
    canCancel: CUSTOMER_CANCELLABLE.includes(order.status),
  };
}

export const ordersRouter: Router = Router();

// Every route here reads or changes someone's own orders, so a real token is
// required rather than optional.
ordersRouter.use(requireAuth);

ordersRouter.get("/", validate({ query: listQuery }), async (req, res) => {
  const { query } = input<unknown, z.infer<typeof listQuery>>(res);
  const page = await listOrdersForUser({
    userId: req.auth!.userId,
    limit: query.limit,
    cursor: query.cursor,
  });
  res.json({
    items: page.items.map(present),
    nextCursor: page.nextCursor,
  });
});

ordersRouter.get("/:orderNumber", validate({ params: orderParam }), async (req, res) => {
  const { params } = input<unknown, unknown, z.infer<typeof orderParam>>(res);
  // Scoped to the caller inside the service, so an order number cannot be
  // walked to read someone else's order.
  const order = await getOrderForUser({
    orderNumber: params.orderNumber,
    userId: req.auth!.userId,
  });
  res.json(present(order));
});

ordersRouter.post(
  "/:orderNumber/cancel",
  validate({ params: orderParam, body: cancelBody }),
  async (req, res) => {
    const { params, body } = input<
      z.infer<typeof cancelBody>,
      unknown,
      z.infer<typeof orderParam>
    >(res);

    const order = await getOrderForUser({
      orderNumber: params.orderNumber,
      userId: req.auth!.userId,
    });

    const cancelled = await cancelOrder({
      orderId: order._id,
      actorId: req.auth!.userId,
      reason: body.reason,
      byCustomer: true,
    });

    res.json(present(cancelled));
  },
);
