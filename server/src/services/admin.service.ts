import type { Types } from "mongoose";
import { NotFoundError } from "../lib/errors.js";
import {
  InventoryItem,
  Order,
  Product,
  Return,
  StockMovement,
  Variant,
  type ProductDoc,
} from "../models/index.js";
import type { Category, Size } from "../models/types.js";
import { ensureInventoryItem } from "./inventory.service.js";

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export interface DashboardFigure {
  id: string;
  label: string;
  value: string;
  note: string;
}

const inr = (paise: number): string =>
  `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;

/**
 * The figures on the overview, computed in two aggregations rather than one
 * query per tile.
 *
 * Only orders that got past payment count as revenue. Including
 * `pending_payment` would report money that has not arrived, which is the kind
 * of number that gets acted on and then quietly revised.
 */
export async function getDashboard(): Promise<{
  figures: DashboardFigure[];
  statusCounts: Record<string, number>;
}> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const EARNED = ["paid", "processing", "shipped", "delivered", "return_requested"];

  const [thisWeek, lastWeek, statuses, returnsOpen] = await Promise.all([
    Order.aggregate<{ revenue: number; orders: number; units: number }>([
      { $match: { placedAt: { $gte: weekAgo }, status: { $in: EARNED } } },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$pricing.total" },
          orders: { $sum: 1 },
          units: { $sum: { $sum: "$items.quantity" } },
        },
      },
    ]),
    Order.aggregate<{ revenue: number }>([
      {
        $match: {
          placedAt: { $gte: twoWeeksAgo, $lt: weekAgo },
          status: { $in: EARNED },
        },
      },
      { $group: { _id: null, revenue: { $sum: "$pricing.total" } } },
    ]),
    Order.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Return.countDocuments({ status: { $in: ["requested", "approved", "received"] } }),
  ]);

  const week = thisWeek[0] ?? { revenue: 0, orders: 0, units: 0 };
  const previous = lastWeek[0]?.revenue ?? 0;
  const statusCounts = Object.fromEntries(statuses.map((row) => [row._id, row.count]));
  const awaitingPacking = (statusCounts.paid ?? 0) + (statusCounts.processing ?? 0);

  const averageOrder = week.orders > 0 ? Math.round(week.revenue / week.orders) : 0;

  return {
    figures: [
      {
        id: "revenue",
        label: "Revenue, last 7 days",
        value: inr(week.revenue),
        note:
          previous === 0
            ? "No settled orders the week before."
            : week.revenue >= previous
              ? `Up from ${inr(previous)} the week before.`
              : `Down from ${inr(previous)} the week before.`,
      },
      {
        id: "orders",
        label: "Orders, last 7 days",
        value: String(week.orders),
        note:
          awaitingPacking === 0
            ? "Nothing waiting to be packed."
            : `${awaitingPacking} waiting to be packed.`,
      },
      {
        id: "basket",
        label: "Average order",
        value: inr(averageOrder),
        note: `${week.units} pieces across ${week.orders} orders.`,
      },
      {
        id: "returns",
        label: "Returns open",
        value: String(returnsOpen),
        note:
          returnsOpen === 0
            ? "Nothing to process."
            : "Approve or reject these to keep the queue moving.",
      },
    ],
    statusCounts,
  };
}

/* -------------------------------------------------------------------------- */
/* Products and stock                                                         */
/* -------------------------------------------------------------------------- */

export interface AdminVariantRow {
  id: string;
  sku: string;
  size: Size;
  colour: { name: string; slug: string; hex: string };
  price: number;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  isLow: boolean;
}

export interface AdminProductRow {
  id: string;
  slug: string;
  name: string;
  category: Category;
  status: string;
  basePrice: number;
  image: string | null;
  totalOnHand: number;
  totalAvailable: number;
  soldOutSizes: Size[];
  variants: AdminVariantRow[];
}

/**
 * The admin products table, with real stock per size.
 *
 * One aggregation with two lookups rather than a query per product: the table
 * shows thirty rows and each needs its whole size run, which is 200+ round
 * trips done naively.
 */
export async function listAdminProducts(args: {
  limit: number;
  cursor?: string | undefined;
  status?: string | undefined;
}): Promise<{ items: AdminProductRow[]; nextCursor: string | null }> {
  const match: Record<string, unknown> = {};
  if (args.status) match.status = args.status;
  if (args.cursor) {
    try {
      const { id } = JSON.parse(
        Buffer.from(args.cursor, "base64url").toString("utf8"),
      ) as { id: string };
      match._id = { $lt: id };
    } catch {
      // Unreadable cursor: serve the first page.
    }
  }

  const rows = await Product.aggregate<
    ProductDoc & { variants: (AdminVariantRow & { _id: unknown })[] }
  >([
    { $match: match },
    { $sort: { _id: -1 } },
    { $limit: args.limit + 1 },
    {
      $lookup: {
        from: "variants",
        let: { pid: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$productId", "$$pid"] } } },
          {
            $lookup: {
              from: "inventoryitems",
              localField: "_id",
              foreignField: "variantId",
              as: "inv",
            },
          },
          {
            $addFields: {
              onHand: { $ifNull: [{ $first: "$inv.onHand" }, 0] },
              reserved: { $ifNull: [{ $first: "$inv.reserved" }, 0] },
              lowStockThreshold: { $ifNull: [{ $first: "$inv.lowStockThreshold" }, 3] },
            },
          },
          {
            $addFields: {
              available: { $subtract: ["$onHand", "$reserved"] },
            },
          },
          { $project: { inv: 0 } },
        ],
        as: "variants",
      },
    },
  ]);

  const hasMore = rows.length > args.limit;
  const page = hasMore ? rows.slice(0, args.limit) : rows;
  const last = page.at(-1);

  return {
    items: page.map((product) => {
      const variants: AdminVariantRow[] = product.variants.map((variant) => ({
        id: String(variant._id),
        sku: variant.sku,
        size: variant.size,
        colour: variant.colour,
        price: variant.price,
        onHand: variant.onHand,
        reserved: variant.reserved,
        available: variant.available,
        lowStockThreshold: variant.lowStockThreshold,
        isLow: variant.available <= variant.lowStockThreshold,
      }));

      return {
        id: String(product._id),
        slug: product.slug,
        name: product.name,
        category: product.category as Category,
        status: product.status,
        basePrice: product.basePrice,
        image: product.images[0]?.url ?? null,
        totalOnHand: variants.reduce((sum, v) => sum + v.onHand, 0),
        totalAvailable: variants.reduce((sum, v) => sum + v.available, 0),
        soldOutSizes: [
          ...new Set(variants.filter((v) => v.available <= 0).map((v) => v.size)),
        ],
        variants,
      };
    }),
    nextCursor:
      hasMore && last
        ? Buffer.from(JSON.stringify({ id: String(last._id) })).toString("base64url")
        : null,
  };
}

export interface LowStockRow {
  variantId: string;
  sku: string;
  productName: string;
  slug: string;
  size: Size;
  colour: string;
  available: number;
  lowStockThreshold: number;
}

/**
 * Everything at or below its threshold, worst first.
 *
 * The comparison has to be `onHand - reserved` against the threshold, which is
 * why it is an aggregation and not a `find`: a variant with twenty on hand and
 * nineteen held is one unit from selling out, and a query on `onHand` alone
 * would call it healthy.
 */
export async function getLowStock(): Promise<LowStockRow[]> {
  return InventoryItem.aggregate<LowStockRow>([
    {
      $addFields: { available: { $subtract: ["$onHand", "$reserved"] } },
    },
    { $match: { $expr: { $lte: ["$available", "$lowStockThreshold"] } } },
    { $sort: { available: 1 } },
    { $limit: 100 },
    {
      $lookup: {
        from: "variants",
        localField: "variantId",
        foreignField: "_id",
        as: "variant",
      },
    },
    { $unwind: "$variant" },
    { $match: { "variant.isActive": true } },
    {
      $lookup: {
        from: "products",
        localField: "variant.productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    { $match: { "product.status": { $ne: "archived" } } },
    {
      $project: {
        _id: 0,
        variantId: { $toString: "$variantId" },
        sku: "$variant.sku",
        size: "$variant.size",
        colour: "$variant.colour.name",
        productName: "$product.name",
        slug: "$product.slug",
        available: 1,
        lowStockThreshold: 1,
      },
    },
  ]);
}

/** The ledger for one variant, newest first, for the drill-down. */
export async function getStockHistory(variantId: Types.ObjectId, limit = 50) {
  const variant = await Variant.findById(variantId).lean();
  if (!variant) throw new NotFoundError("That size");

  const movements = await StockMovement.find({ variantId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return {
    sku: variant.sku,
    movements: movements.map((movement) => ({
      id: String(movement._id),
      type: movement.type,
      quantity: movement.quantity,
      reason: movement.reason,
      refType: movement.refType,
      refId: movement.refId ? String(movement.refId) : null,
      at: movement.createdAt,
    })),
  };
}

export interface CreateProductInput {
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: Category;
  fabric: string;
  careInstructions: string;
  fitNotes: string;
  basePrice: number;
  images: { url: string; alt: string; width: number; height: number }[];
  variants: {
    sku: string;
    size: Size;
    colour: { name: string; slug: string; hex: string };
    price: number;
    weightGrams: number;
    /** Opening stock, recorded as a `receive` movement. */
    onHand?: number;
    lowStockThreshold?: number;
  }[];
  status?: "draft" | "active";
}

/**
 * Creates a product and its size run, giving every variant an inventory row.
 *
 * A variant without one is invisible to the availability join and cannot be
 * reserved, so it would look permanently sold out — which is why this is done
 * here rather than left to whoever remembers.
 */
export async function createProduct(
  input: CreateProductInput,
  actorId: Types.ObjectId,
): Promise<AdminProductRow> {
  const product = await Product.create({
    slug: input.slug,
    name: input.name,
    summary: input.summary,
    description: input.description,
    category: input.category,
    fabric: input.fabric,
    careInstructions: input.careInstructions,
    fitNotes: input.fitNotes,
    basePrice: input.basePrice,
    images: input.images.map((image, position) => ({ ...image, position })),
    status: input.status ?? "draft",
    publishedAt: input.status === "active" ? new Date() : null,
  });

  const { receive } = await import("./inventory.service.js");

  for (const variantInput of input.variants) {
    const variant = await Variant.create({
      productId: product._id,
      sku: variantInput.sku,
      size: variantInput.size,
      colour: variantInput.colour,
      price: variantInput.price,
      weightGrams: variantInput.weightGrams,
      isActive: true,
    });
    await ensureInventoryItem(variant._id, variantInput.lowStockThreshold ?? 3);

    if (variantInput.onHand && variantInput.onHand > 0) {
      await receive({
        variantId: variant._id,
        quantity: variantInput.onHand,
        reason: "opening stock",
        refType: "manual",
        actorId,
      });
    }
  }

  const page = await listAdminProducts({ limit: 1, status: undefined });
  const created = page.items.find((row) => row.id === String(product._id));
  if (!created) throw new NotFoundError("The product just created");
  return created;
}
