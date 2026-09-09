import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { input, validate } from "../../middleware/validate.js";
import type { ReturnDoc } from "../../models/index.js";
import {
  listReturnsForUser,
  requestReturn,
  RETURN_WINDOW_DAYS,
} from "../../services/return.service.js";

const requestBody = z.object({
  orderNumber: z.string().trim().min(4).max(32),
  reason: z.string().trim().min(3).max(500),
  items: z
    .array(
      z.object({
        sku: z.string().trim().min(1).max(80),
        quantity: z.coerce.number().int().min(1).max(20),
      }),
    )
    .min(1, "Choose at least one piece to send back."),
  /** Note what is absent: no prices. They are read off the order. */
});

function present(record: ReturnDoc) {
  return {
    id: String(record._id),
    status: record.status,
    reason: record.reason,
    refundAmount: record.refundAmount,
    createdAt: record.createdAt,
    items: record.items.map((item) => ({
      sku: item.sku,
      name: item.nameSnapshot,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    history: record.statusHistory.map((event) => ({
      status: event.status,
      at: event.at,
      note: event.note,
    })),
  };
}

export const returnsRouter: Router = Router();

returnsRouter.use(requireAuth);

returnsRouter.get("/", async (req, res) => {
  const records = await listReturnsForUser(req.auth!.userId);
  res.json({ items: records.map(present), windowDays: RETURN_WINDOW_DAYS });
});

returnsRouter.post("/", validate({ body: requestBody }), async (req, res) => {
  const { body } = input<z.infer<typeof requestBody>>(res);
  const record = await requestReturn({
    orderNumber: body.orderNumber,
    userId: req.auth!.userId,
    reason: body.reason,
    items: body.items,
  });
  res.status(201).json(present(record));
});
