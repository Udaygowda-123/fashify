import { Router } from "express";
import multer from "multer";
import { Types } from "mongoose";
import { z } from "zod";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { uploadProductImage } from "../../lib/cloudinary.js";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { input, validate } from "../../middleware/validate.js";
import { Order, Return } from "../../models/index.js";
import { CATEGORIES, ORDER_STATUSES, RETURN_STATUSES, SIZES } from "../../models/types.js";
import {
  createProduct,
  getDashboard,
  getLowStock,
  getStockHistory,
  listAdminProducts,
} from "../../services/admin.service.js";
import { adjust, reconcile } from "../../services/inventory.service.js";
import { cancelOrder, transitionOrder } from "../../services/order.service.js";
import { advanceReturn, listReturnsForAdmin } from "../../services/return.service.js";
import { notifyRestocked } from "../../jobs/notify-back-in-stock.js";

const objectId = z
  .string()
  .refine((value) => Types.ObjectId.isValid(value), "That is not a valid id.")
  .transform((value) => new Types.ObjectId(value));

export const adminRouter: Router = Router();

/**
 * Every admin route sits behind BOTH middlewares.
 *
 * `requireAuth` establishes who the caller is from a verified token;
 * `requireAdmin` reads the token's custom claim. Neither consults the request
 * body, and neither consults `user.role` in our database — that column is
 * writable by any code path that touches a user document, so a bug there would
 * hand out this whole surface.
 */
adminRouter.use(requireAuth, requireAdmin);

/* ---- dashboard ---- */

adminRouter.get("/dashboard", async (_req, res) => {
  res.json(await getDashboard());
});

/* ---- products and stock ---- */

const productListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(500).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

adminRouter.get("/products", validate({ query: productListQuery }), async (_req, res) => {
  const { query } = input<unknown, z.infer<typeof productListQuery>>(res);
  res.json(await listAdminProducts(query));
});

const imageSchema = z.object({
  url: z.string().trim().min(1).max(500),
  alt: z.string().trim().min(3).max(300),
  width: z.coerce.number().int().min(1),
  height: z.coerce.number().int().min(1),
});

const createProductBody = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase and hyphenated."),
  name: z.string().trim().min(2).max(200),
  summary: z.string().trim().min(10).max(500),
  description: z.string().trim().min(10).max(4000),
  category: z.enum(CATEGORIES),
  fabric: z.string().trim().min(3).max(500),
  careInstructions: z.string().trim().min(3).max(500),
  fitNotes: z.string().trim().min(3).max(800),
  // Paise, as everywhere else. An integer, so nobody can send 4800.5.
  basePrice: z.coerce.number().int().min(1),
  status: z.enum(["draft", "active"]).default("draft"),
  images: z.array(imageSchema).min(1, "A product needs at least one photograph."),
  variants: z
    .array(
      z.object({
        sku: z.string().trim().min(3).max(80),
        size: z.enum(SIZES),
        colour: z.object({
          name: z.string().trim().min(1).max(60),
          slug: z.string().trim().regex(/^[a-z0-9-]+$/),
          hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Looks like #RRGGBB."),
        }),
        price: z.coerce.number().int().min(1),
        weightGrams: z.coerce.number().int().min(1).default(460),
        onHand: z.coerce.number().int().min(0).default(0),
        lowStockThreshold: z.coerce.number().int().min(0).default(3),
      }),
    )
    .min(1, "A product needs at least one size."),
});

adminRouter.post("/products", validate({ body: createProductBody }), async (req, res) => {
  const { body } = input<z.infer<typeof createProductBody>>(res);
  const created = await createProduct(body, req.auth!.userId);
  res.status(201).json(created);
});

/**
 * Multer holds the file in memory rather than writing it to disk — the
 * buffer is handed straight to Cloudinary and then discarded, so nothing is
 * ever written to this server's filesystem.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, file.mimetype.startsWith("image/"));
  },
});

/**
 * A real upload, once CLOUDINARY_URL is configured. Returns the same
 * {url, alt, width, height} shape `createProductBody.images` expects, so the
 * admin form can drop the result straight into its image list.
 */
adminRouter.post("/uploads", upload.single("file"), async (req, res) => {
  if (!req.file) {
    throw new ValidationError("No file was attached.", { fields: { file: "Required." } });
  }
  const result = await uploadProductImage(req.file.buffer, req.file.originalname);
  res.status(201).json(result);
});

const adjustBody = z.object({
  variantId: objectId,
  /** Signed: negative corrects a count down. */
  delta: z.coerce.number().int().refine((value) => value !== 0, "A change of zero does nothing."),
  reason: z.string().trim().min(3).max(300),
});

/**
 * A manual stock correction — a stocktake, breakage, a miscount on delivery.
 * Always paired with a reason, because a bare number in the ledger is no help
 * at 2am.
 */
adminRouter.post("/stock/adjust", validate({ body: adjustBody }), async (req, res) => {
  const { body } = input<z.infer<typeof adjustBody>>(res);
  const before = await reconcile(body.variantId);

  const availability = await adjust({
    variantId: body.variantId,
    delta: body.delta,
    reason: body.reason,
    actorId: req.auth!.userId,
  });

  // Restocking a sold-out size is what the waiting list is for.
  let notified = 0;
  if (body.delta > 0 && (before[0]?.storedOnHand ?? 0) - (before[0]?.storedReserved ?? 0) <= 0) {
    notified = (await notifyRestocked(body.variantId)).notified;
  }

  res.json({ ...availability, backInStockEmails: notified });
});

adminRouter.get(
  "/stock/:variantId/history",
  validate({ params: z.object({ variantId: objectId }) }),
  async (_req, res) => {
    const { params } = input<unknown, unknown, { variantId: Types.ObjectId }>(res);
    res.json(await getStockHistory(params.variantId));
  },
);

adminRouter.get("/stock/low", async (_req, res) => {
  res.json({ items: await getLowStock() });
});

/**
 * Replays the ledger and reports anything that disagrees with the counters.
 *
 * This is the pay-off for keeping an append-only ledger: drift becomes
 * something you can see on a screen rather than something you infer from an
 * oversold order weeks later.
 */
adminRouter.get("/stock/reconciliation", async (_req, res) => {
  const rows = await reconcile();
  const drifted = rows.filter((row) => !row.ok);
  res.json({
    checked: rows.length,
    drifted: drifted.length,
    ok: drifted.length === 0,
    rows: drifted.slice(0, 100),
  });
});

/* ---- orders ---- */

const orderListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(500).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  q: z.string().trim().max(80).optional(),
});

adminRouter.get("/orders", validate({ query: orderListQuery }), async (_req, res) => {
  const { query } = input<unknown, z.infer<typeof orderListQuery>>(res);

  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.q) {
    filter.$or = [
      { orderNumber: query.q.toUpperCase() },
      { email: query.q.toLowerCase() },
    ];
  }
  if (query.cursor) {
    try {
      const { v, id } = JSON.parse(
        Buffer.from(query.cursor, "base64url").toString("utf8"),
      ) as { v: string; id: string };
      filter.$and = [
        {
          $or: [
            { placedAt: { $lt: new Date(v) } },
            { placedAt: new Date(v), _id: { $lt: id } },
          ],
        },
      ];
    } catch {
      // Unreadable cursor: first page.
    }
  }

  const rows = await Order.find(filter)
    .sort({ placedAt: -1, _id: -1 })
    .limit(query.limit + 1)
    .lean();

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page.at(-1);

  res.json({
    items: page.map((order) => ({
      orderNumber: order.orderNumber,
      status: order.status,
      email: order.email,
      customerName: order.shippingAddress.fullName,
      city: order.shippingAddress.city,
      total: order.pricing.total,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      placedAt: order.placedAt,
    })),
    nextCursor:
      hasMore && last
        ? Buffer.from(
            JSON.stringify({ v: last.placedAt.toISOString(), id: String(last._id) }),
          ).toString("base64url")
        : null,
  });
});

adminRouter.get(
  "/orders/:orderNumber",
  validate({ params: z.object({ orderNumber: z.string().trim().min(4).max(32) }) }),
  async (_req, res) => {
    const { params } = input<unknown, unknown, { orderNumber: string }>(res);
    const order = await Order.findOne({
      orderNumber: params.orderNumber.toUpperCase(),
    }).lean();
    if (!order) throw new NotFoundError("That order");

    const returns = await Return.find({ orderId: order._id }).lean();

    res.json({
      ...order,
      _id: String(order._id),
      userId: String(order.userId),
      returns: returns.map((record) => ({
        id: String(record._id),
        status: record.status,
        refundAmount: record.refundAmount,
      })),
    });
  },
);

const statusBody = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional(),
});

/**
 * The only way an order's status changes. The transition is validated against
 * the state machine, so an illegal move is a 409 rather than a silent write.
 */
adminRouter.patch(
  "/orders/:orderNumber/status",
  validate({
    params: z.object({ orderNumber: z.string().trim().min(4).max(32) }),
    body: statusBody,
  }),
  async (req, res) => {
    const { params, body } = input<
      z.infer<typeof statusBody>,
      unknown,
      { orderNumber: string }
    >(res);

    const order = await Order.findOne({ orderNumber: params.orderNumber.toUpperCase() });
    if (!order) throw new NotFoundError("That order");

    // Cancelling has to put stock back, so it goes through its own path.
    const updated =
      body.status === "cancelled"
        ? await cancelOrder({
            orderId: order._id,
            actorId: req.auth!.userId,
            reason: body.note ?? "cancelled by staff",
          })
        : await transitionOrder({
            orderId: order._id,
            to: body.status,
            actorId: req.auth!.userId,
            note: body.note,
          });

    res.json({ orderNumber: updated.orderNumber, status: updated.status });
  },
);

/* ---- returns ---- */

adminRouter.get(
  "/returns",
  validate({ query: z.object({ status: z.enum(RETURN_STATUSES).optional() }) }),
  async (_req, res) => {
    const { query } = input<unknown, { status?: (typeof RETURN_STATUSES)[number] }>(res);
    const records = await listReturnsForAdmin(query.status);
    res.json({
      items: records.map((record) => ({
        id: String(record._id),
        orderId: String(record.orderId),
        status: record.status,
        reason: record.reason,
        refundAmount: record.refundAmount,
        restockedAt: record.restockedAt,
        createdAt: record.createdAt,
        items: record.items.map((item) => ({
          sku: item.sku,
          name: item.nameSnapshot,
          quantity: item.quantity,
          restock: item.restock,
        })),
      })),
    });
  },
);

const advanceBody = z.object({
  status: z.enum(RETURN_STATUSES),
  note: z.string().trim().max(500).optional(),
  /** Per-SKU decision on whether the piece came back sellable. */
  restock: z.record(z.string(), z.boolean()).optional(),
});

adminRouter.patch(
  "/returns/:returnId",
  validate({ params: z.object({ returnId: objectId }), body: advanceBody }),
  async (req, res) => {
    const { params, body } = input<
      z.infer<typeof advanceBody>,
      unknown,
      { returnId: Types.ObjectId }
    >(res);

    const updated = await advanceReturn({
      returnId: params.returnId,
      to: body.status,
      actorId: req.auth!.userId,
      note: body.note,
      restock: body.restock,
    });

    res.json({
      id: String(updated._id),
      status: updated.status,
      restockedAt: updated.restockedAt,
      gatewayRefundId: updated.gatewayRefundId,
    });
  },
);
