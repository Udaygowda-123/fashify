import type { PipelineStage } from "mongoose";
import { NotFoundError } from "../lib/errors.js";
import { Product, Variant } from "../models/index.js";
import type { Category, Size } from "../models/types.js";

/** Price facet bands, in paise. Boundaries are inclusive-exclusive. */
export const PRICE_BANDS = [
  { key: "under-3000", label: "Under ₹3,000", min: 0, max: 300_000 },
  { key: "3000-5000", label: "₹3,000 to ₹5,000", min: 300_000, max: 500_000 },
  { key: "5000-7000", label: "₹5,000 to ₹7,000", min: 500_000, max: 700_000 },
  { key: "over-7000", label: "Over ₹7,000", min: 700_000, max: Number.MAX_SAFE_INTEGER },
] as const;

export type PriceBandKey = (typeof PRICE_BANDS)[number]["key"];

export type SortKey = "featured" | "newest" | "price-asc" | "price-desc";

export interface CatalogQuery {
  cursor?: string | undefined;
  limit: number;
  category?: Category[] | undefined;
  size?: Size[] | undefined;
  colour?: string[] | undefined;
  price?: PriceBandKey[] | undefined;
  sort: SortKey;
  q?: string | undefined;
  /** Admin listings want drafts and archived pieces too. */
  includeUnpublished?: boolean;
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
  hex?: string;
}

export interface FacetGroup {
  id: "category" | "size" | "colour" | "price";
  label: string;
  options: FacetOption[];
}

/* -------------------------------------------------------------------------- */
/* Cursor pagination                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Cursors carry the sort key of the last row seen, never an offset.
 *
 * `?skip=40` asks "step over forty rows", and which forty depends on what the
 * data looks like at the moment the query runs. Sell out of a piece between
 * page one and page two and everything shifts up by one: the reader never sees
 * the row that moved onto page one, and sees a row twice when something is
 * added. A cursor asks "give me what sorts after this exact row", which is
 * stable however much the collection churns underneath — and it can use the
 * index instead of counting past rows it will throw away.
 */
interface CursorPayload {
  /** The sort field's value on the last row of the previous page. */
  v: string | number;
  /** The row's id, breaking ties so the sort is total. */
  id: string;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      parsed &&
      typeof parsed === "object" &&
      "v" in parsed &&
      "id" in parsed &&
      typeof parsed.id === "string"
    ) {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    // A malformed cursor is treated as no cursor. Better a first page than a
    // 400 for something the reader did not type.
    return null;
  }
}

interface SortSpec {
  field: string;
  direction: 1 | -1;
  sort: Record<string, 1 | -1>;
}

function sortSpec(sort: SortKey): SortSpec {
  switch (sort) {
    case "price-asc":
      return { field: "minPrice", direction: 1, sort: { minPrice: 1, _id: 1 } };
    case "price-desc":
      return { field: "minPrice", direction: -1, sort: { minPrice: -1, _id: -1 } };
    case "newest":
    case "featured":
    default:
      return { field: "publishedAt", direction: -1, sort: { publishedAt: -1, _id: -1 } };
  }
}

/** `(field, _id) > (v, id)` in the sort's direction, as a keyset predicate. */
function cursorMatch(spec: SortSpec, payload: CursorPayload): PipelineStage.Match {
  const op = spec.direction === 1 ? "$gt" : "$lt";
  const value =
    spec.field === "publishedAt" && typeof payload.v === "string"
      ? new Date(payload.v)
      : payload.v;

  return {
    $match: {
      $or: [
        { [spec.field]: { [op]: value } },
        {
          [spec.field]: value,
          _id: { [op]: payload.id },
        },
      ],
    },
  } as PipelineStage.Match;
}

/* -------------------------------------------------------------------------- */
/* Filter expressions over the joined variants                                */
/* -------------------------------------------------------------------------- */

/**
 * Variant-level filters combine on a SINGLE variant, not across the product.
 *
 * Asking for size M and colour Ecru together should mean "pieces you can
 * actually buy as an Ecru M". Matching a product that happens to have some M
 * and separately some Ecru would offer the shopper a combination that does not
 * exist, and they would find that out only on the product page.
 */
interface VariantFilters {
  size?: Size[] | undefined;
  colour?: string[] | undefined;
  price?: PriceBandKey[] | undefined;
  /** Only count a variant if it can be bought right now. */
  inStockOnly: boolean;
}

function variantCondition(filters: VariantFilters): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [];

  if (filters.size?.length) {
    conditions.push({ $in: ["$$v.size", filters.size] });
  }
  if (filters.colour?.length) {
    conditions.push({ $in: ["$$v.colour.slug", filters.colour] });
  }
  if (filters.price?.length) {
    const bands = PRICE_BANDS.filter((band) =>
      (filters.price as string[]).includes(band.key),
    );
    conditions.push({
      $or: bands.map((band) => ({
        $and: [{ $gte: ["$$v.price", band.min] }, { $lt: ["$$v.price", band.max] }],
      })),
    });
  }
  if (filters.inStockOnly) {
    conditions.push({ $gt: ["$$v.available", 0] });
  }

  return conditions.length === 0 ? { $literal: true } : { $and: conditions };
}

/** "This product has at least one variant satisfying all of the above." */
function hasMatchingVariant(filters: VariantFilters): PipelineStage.Match {
  return {
    $match: {
      $expr: {
        $gt: [
          {
            $size: {
              $filter: {
                input: "$variants",
                as: "v",
                cond: variantCondition(filters),
              },
            },
          },
          0,
        ],
      },
    },
  };
}

/* -------------------------------------------------------------------------- */
/* The faceted read                                                           */
/* -------------------------------------------------------------------------- */

export interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  summary: string;
  category: Category;
  minPrice: number;
  maxPrice: number;
  compareAtPrice: number | null;
  images: { url: string; alt: string; width: number; height: number }[];
  colourCount: number;
  totalAvailable: number;
  isSoldOut: boolean;
  publishedAt: Date | null;
}

export interface CatalogPage {
  items: ProductListItem[];
  facets: FacetGroup[];
  total: number;
  nextCursor: string | null;
}

/**
 * ONE aggregation produces the page of results and every facet count.
 *
 * The naive alternative is a query for the results and then one
 * `countDocuments` per filter option — for this catalogue that is 4 categories
 * + 6 sizes + 11 colours + 4 price bands = 25 extra round trips to render one
 * page, each re-doing the same join. `$facet` runs several pipelines over one
 * shared upstream result instead, and returns them together.
 *
 * The reason it has to be `$facet` and not one filtered set counted four ways
 * is the rule that a facet's counts must reflect the OTHER active filters but
 * not its own. With Knitwear selected, the size counts should say how many
 * knits come in M — but the category counts must still show what is available
 * in Trousers, or selecting Knitwear would drop every other category to zero
 * and the shopper could never switch. So each sub-pipeline re-applies a
 * different subset of the filters, which is exactly what `$facet` allows.
 */
export async function listProducts(query: CatalogQuery): Promise<CatalogPage> {
  const spec = sortSpec(query.sort);
  const payload = query.cursor ? decodeCursor(query.cursor) : null;

  // Filters that apply to every branch, including the facet counts.
  const base: Record<string, unknown> = query.includeUnpublished
    ? {}
    : { status: "active" };
  if (query.q) {
    base.$text = { $search: query.q };
  }

  const categoryMatch: PipelineStage.Match | null = query.category?.length
    ? { $match: { category: { $in: query.category } } }
    : null;

  const allVariantFilters: VariantFilters = {
    size: query.size,
    colour: query.colour,
    price: query.price,
    inStockOnly: true,
  };

  /** The same variant filters, with one group's own filter left out. */
  const without = (drop: "size" | "colour" | "price"): VariantFilters => ({
    size: drop === "size" ? undefined : query.size,
    colour: drop === "colour" ? undefined : query.colour,
    price: drop === "price" ? undefined : query.price,
    inStockOnly: true,
  });

  const pipeline: PipelineStage[] = [
    { $match: base },

    /**
     * Join the size run, and derive availability per variant while we are
     * here. The nested lookup is what lets `available` be computed rather than
     * stored — it is `onHand - reserved`, every time it is read.
     */
    {
      $lookup: {
        from: "variants",
        let: { pid: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$productId", "$$pid"] },
              isActive: true,
            },
          },
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
              available: {
                $let: {
                  vars: { i: { $first: "$inv" } },
                  in: {
                    $subtract: [
                      { $ifNull: ["$$i.onHand", 0] },
                      { $ifNull: ["$$i.reserved", 0] },
                    ],
                  },
                },
              },
            },
          },
          { $project: { inv: 0 } },
        ],
        as: "variants",
      },
    },

    // A product with no sellable variants is not a product a shopper can see.
    { $match: { "variants.0": { $exists: true } } },

    {
      $addFields: {
        minPrice: { $min: "$variants.price" },
        maxPrice: { $max: "$variants.price" },
        compareAtPrice: { $max: "$variants.compareAtPrice" },
        totalAvailable: { $sum: "$variants.available" },
        colourCount: { $size: { $setUnion: ["$variants.colour.slug", []] } },
      },
    },
  ];

  const resultsBranch: PipelineStage.FacetPipelineStage[] = [
    ...(categoryMatch ? [categoryMatch] : []),
    hasMatchingVariant(allVariantFilters),
    { $sort: spec.sort },
    ...(payload ? [cursorMatch(spec, payload)] : []),
    // One extra row is fetched to learn whether another page exists, without
    // a second count query.
    { $limit: query.limit + 1 },
    {
      $project: {
        slug: 1,
        name: 1,
        summary: 1,
        category: 1,
        images: 1,
        minPrice: 1,
        maxPrice: 1,
        compareAtPrice: 1,
        colourCount: 1,
        totalAvailable: 1,
        publishedAt: 1,
      },
    },
  ] as PipelineStage.FacetPipelineStage[];

  const countBranch = (
    stages: PipelineStage.FacetPipelineStage[],
  ): PipelineStage.FacetPipelineStage[] => stages;

  pipeline.push({
    $facet: {
      results: resultsBranch,

      total: countBranch([
        ...(categoryMatch ? [categoryMatch] : []),
        hasMatchingVariant(allVariantFilters),
        { $count: "n" },
      ] as PipelineStage.FacetPipelineStage[]),

      // Category counts ignore the category filter, so the shopper can always
      // see — and switch to — the other categories.
      categoryCounts: countBranch([
        hasMatchingVariant(allVariantFilters),
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ] as PipelineStage.FacetPipelineStage[]),

      // Size counts respect category, colour and price, but not size.
      sizeCounts: countBranch([
        ...(categoryMatch ? [categoryMatch] : []),
        hasMatchingVariant(without("size")),
        {
          $project: {
            sizes: {
              $setUnion: [
                {
                  $map: {
                    input: {
                      $filter: {
                        input: "$variants",
                        as: "v",
                        cond: variantCondition(without("size")),
                      },
                    },
                    as: "v",
                    in: "$$v.size",
                  },
                },
                [],
              ],
            },
          },
        },
        { $unwind: "$sizes" },
        { $group: { _id: "$sizes", count: { $sum: 1 } } },
      ] as PipelineStage.FacetPipelineStage[]),

      colourCounts: countBranch([
        ...(categoryMatch ? [categoryMatch] : []),
        hasMatchingVariant(without("colour")),
        {
          $project: {
            colours: {
              $map: {
                input: {
                  $filter: {
                    input: "$variants",
                    as: "v",
                    cond: variantCondition(without("colour")),
                  },
                },
                as: "v",
                in: { slug: "$$v.colour.slug", name: "$$v.colour.name", hex: "$$v.colour.hex" },
              },
            },
          },
        },
        { $unwind: "$colours" },
        // Distinct per product, so a piece with four M-and-Ecru variants
        // counts once toward Ecru.
        {
          $group: {
            _id: { product: "$_id", slug: "$colours.slug" },
            name: { $first: "$colours.name" },
            hex: { $first: "$colours.hex" },
          },
        },
        {
          $group: {
            _id: "$_id.slug",
            name: { $first: "$name" },
            hex: { $first: "$hex" },
            count: { $sum: 1 },
          },
        },
      ] as PipelineStage.FacetPipelineStage[]),

      priceCounts: countBranch([
        ...(categoryMatch ? [categoryMatch] : []),
        hasMatchingVariant(without("price")),
        {
          $bucket: {
            groupBy: "$minPrice",
            boundaries: [0, 300_000, 500_000, 700_000, Number.MAX_SAFE_INTEGER],
            default: "other",
            output: { count: { $sum: 1 } },
          },
        },
      ] as PipelineStage.FacetPipelineStage[]),
    },
  });

  interface FacetResult {
    results: (ProductListItem & { _id: unknown })[];
    total: { n: number }[];
    categoryCounts: { _id: string; count: number }[];
    sizeCounts: { _id: string; count: number }[];
    colourCounts: { _id: string; name: string; hex: string; count: number }[];
    priceCounts: { _id: number | string; count: number }[];
  }

  const [raw] = await Product.aggregate<FacetResult>(pipeline).collation({
    // Deterministic ordering for equal sort keys regardless of server locale.
    locale: "en",
    numericOrdering: true,
  });

  const rows = raw?.results ?? [];
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  const last = page.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          v:
            spec.field === "publishedAt"
              ? ((last as unknown as { publishedAt: Date }).publishedAt?.toISOString() ?? "")
              : ((last as unknown as Record<string, number>)[spec.field] ?? 0),
          id: String((last as { _id: unknown })._id),
        })
      : null;

  return {
    items: page.map((row) => {
      const { _id, ...rest } = row;
      return {
        ...rest,
        id: String(_id),
        isSoldOut: (rest.totalAvailable ?? 0) <= 0,
      } as ProductListItem;
    }),
    facets: buildFacets(raw),
    total: raw?.total[0]?.n ?? 0,
    nextCursor,
  };
}

const SIZE_ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL"];

const CATEGORY_LABELS: Record<Category, string> = {
  overshirts: "Overshirts",
  trousers: "Trousers",
  knitwear: "Knitwear",
  tees: "Tees",
};

function buildFacets(raw: {
  categoryCounts: { _id: string; count: number }[];
  sizeCounts: { _id: string; count: number }[];
  colourCounts: { _id: string; name: string; hex: string; count: number }[];
  priceCounts: { _id: number | string; count: number }[];
} | undefined): FacetGroup[] {
  if (!raw) return [];

  const priceByLowerBound = new Map(
    raw.priceCounts.map((row) => [String(row._id), row.count]),
  );

  return [
    {
      id: "category",
      label: "Category",
      options: (Object.keys(CATEGORY_LABELS) as Category[])
        .map((key) => ({
          value: key,
          label: CATEGORY_LABELS[key],
          count: raw.categoryCounts.find((row) => row._id === key)?.count ?? 0,
        }))
        // A facet with nothing behind it is noise; leave it out entirely.
        .filter((option) => option.count > 0),
    },
    {
      id: "size",
      label: "Size",
      options: SIZE_ORDER.map((size) => ({
        value: size,
        label: size,
        count: raw.sizeCounts.find((row) => row._id === size)?.count ?? 0,
      })).filter((option) => option.count > 0),
    },
    {
      id: "colour",
      label: "Colour",
      options: raw.colourCounts
        .map((row) => ({
          value: row._id,
          label: row.name,
          hex: row.hex,
          count: row.count,
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    },
    {
      id: "price",
      label: "Price",
      options: PRICE_BANDS.map((band) => ({
        value: band.key,
        label: band.label,
        count: priceByLowerBound.get(String(band.min)) ?? 0,
      })).filter((option) => option.count > 0),
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Detail                                                                     */
/* -------------------------------------------------------------------------- */

export interface ProductDetailVariant {
  id: string;
  sku: string;
  size: Size;
  colour: { name: string; slug: string; hex: string };
  price: number;
  compareAtPrice: number | null;
  available: number;
  /** Enough left that "only 2 left" is worth saying. */
  isLow: boolean;
  inStock: boolean;
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: Category;
  fabric: string;
  careInstructions: string;
  fitNotes: string;
  images: { url: string; alt: string; width: number; height: number }[];
  minPrice: number;
  variants: ProductDetailVariant[];
  colours: { name: string; slug: string; hex: string }[];
  goesWith: string[];
}

export async function getProductBySlug(slug: string): Promise<ProductDetail> {
  const product = await Product.findOne({ slug, status: "active" }).lean();
  if (!product) throw new NotFoundError("That piece");

  const variants = await Variant.aggregate<{
    _id: unknown;
    sku: string;
    size: Size;
    colour: { name: string; slug: string; hex: string };
    price: number;
    compareAtPrice: number | null;
    available: number;
    lowStockThreshold: number;
  }>([
    { $match: { productId: product._id, isActive: true } },
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
        available: {
          $let: {
            vars: { i: { $first: "$inv" } },
            in: {
              $subtract: [
                { $ifNull: ["$$i.onHand", 0] },
                { $ifNull: ["$$i.reserved", 0] },
              ],
            },
          },
        },
        lowStockThreshold: {
          $let: {
            vars: { i: { $first: "$inv" } },
            in: { $ifNull: ["$$i.lowStockThreshold", 3] },
          },
        },
      },
    },
    { $project: { inv: 0 } },
  ]);

  const order = new Map(SIZE_ORDER.map((size, index) => [size, index]));
  variants.sort((a, b) => (order.get(a.size) ?? 99) - (order.get(b.size) ?? 99));

  const colours = new Map<string, { name: string; slug: string; hex: string }>();
  for (const variant of variants) {
    colours.set(variant.colour.slug, variant.colour);
  }

  return {
    id: String(product._id),
    slug: product.slug,
    name: product.name,
    summary: product.summary,
    description: product.description,
    category: product.category as Category,
    fabric: product.fabric,
    careInstructions: product.careInstructions,
    fitNotes: product.fitNotes,
    images: product.images,
    minPrice: Math.min(...variants.map((v) => v.price)),
    variants: variants.map((v) => ({
      id: String(v._id),
      sku: v.sku,
      size: v.size,
      colour: v.colour,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      available: Math.max(0, v.available),
      inStock: v.available > 0,
      isLow: v.available > 0 && v.available <= v.lowStockThreshold,
    })),
    colours: [...colours.values()],
    goesWith: product.goesWith,
  };
}

export async function getRelatedProducts(slug: string): Promise<ProductListItem[]> {
  const product = await Product.findOne({ slug, status: "active" }).select("goesWith").lean();
  if (!product || product.goesWith.length === 0) return [];

  const page = await listProducts({
    limit: product.goesWith.length,
    sort: "featured",
  });

  // Keep the order the product names them in.
  const bySlug = new Map(page.items.map((item) => [item.slug, item]));
  return product.goesWith
    .map((s) => bySlug.get(s))
    .filter((item): item is ProductListItem => Boolean(item));
}

export interface CollectionSummary {
  slug: Category;
  title: string;
  pieceCount: number;
  image: { url: string; alt: string; width: number; height: number } | null;
}

export async function listCollections(): Promise<CollectionSummary[]> {
  const rows = await Product.aggregate<{
    _id: Category;
    pieceCount: number;
    image: { url: string; alt: string; width: number; height: number } | null;
  }>([
    { $match: { status: "active" } },
    { $sort: { publishedAt: -1 } },
    {
      $group: {
        _id: "$category",
        pieceCount: { $sum: 1 },
        image: { $first: { $first: "$images" } },
      },
    },
  ]);

  return (Object.keys(CATEGORY_LABELS) as Category[]).map((slug) => {
    const row = rows.find((r) => r._id === slug);
    return {
      slug,
      title: CATEGORY_LABELS[slug],
      pieceCount: row?.pieceCount ?? 0,
      image: row?.image ?? null,
    };
  });
}
