/**
 * The whole data layer for Phase 1. Every export is an async function
 * returning a typed promise, so in Phase 2 each body becomes a `fetch` against
 * the Express server and no caller changes.
 *
 * Set MOCK_LATENCY_MS to see the loading skeletons — they are wired to real
 * suspense boundaries, but with local arrays they resolve too fast to appear:
 *
 *     MOCK_LATENCY_MS=1200 npm run dev
 */
import {
  AUTH_IMAGE,
  COLLECTIONS,
  EDITORIAL_IMAGE,
  EMPTY_RAIL_IMAGE,
  HERO_IMAGE,
  LOOKBOOK,
  PRODUCTS,
} from "./catalogue";
import { ADMIN_FIGURES, ORDERS, STOCK_ALERTS } from "./orders";
import type {
  AdminFigure,
  AdminProductRow,
  BagLine,
  CategorySlug,
  Collection,
  FilterGroup,
  ImageAsset,
  LookbookImage,
  Order,
  Product,
  SortOption,
  StockAlert,
} from "./types";

const LATENCY = Number(process.env.MOCK_LATENCY_MS ?? 0);

async function settle<T>(value: T): Promise<T> {
  if (LATENCY > 0) {
    await new Promise((resolve) => setTimeout(resolve, LATENCY));
  }
  return value;
}

export async function getProducts(): Promise<Product[]> {
  return settle(PRODUCTS);
}

export async function getProduct(slug: string): Promise<Product | null> {
  return settle(PRODUCTS.find((p) => p.slug === slug) ?? null);
}

export async function getProductsByCategory(
  category: CategorySlug,
): Promise<Product[]> {
  return settle(PRODUCTS.filter((p) => p.category === category));
}

/** The pieces named on a product, in the order the product names them. */
export async function getRelatedProducts(slug: string): Promise<Product[]> {
  const product = PRODUCTS.find((p) => p.slug === slug);
  if (!product) return settle([]);
  const related = product.goesWith
    .map((s) => PRODUCTS.find((p) => p.slug === s))
    .filter((p): p is Product => Boolean(p));
  return settle(related);
}

export async function getNewArrivals(limit = 8): Promise<Product[]> {
  const ordered = [...PRODUCTS].sort(
    (a, b) => Number(b.isNew) - Number(a.isNew),
  );
  return settle(ordered.slice(0, limit));
}

export async function getCollections(): Promise<Collection[]> {
  return settle(COLLECTIONS);
}

export async function getLookbook(): Promise<LookbookImage[]> {
  return settle(LOOKBOOK);
}

export async function getHeroImage(): Promise<ImageAsset> {
  return settle(HERO_IMAGE);
}

export async function getEditorialImage(): Promise<ImageAsset> {
  return settle(EDITORIAL_IMAGE);
}

export async function getAuthImage(): Promise<ImageAsset> {
  return settle(AUTH_IMAGE);
}

export async function getEmptyRailImage(): Promise<ImageAsset> {
  return settle(EMPTY_RAIL_IMAGE);
}

/**
 * Counts are derived from the catalogue so the filter UI never disagrees with
 * the grid beside it, even though Phase 1 does not filter anything.
 */
export async function getFilterGroups(): Promise<FilterGroup[]> {
  const countBy = <T extends string>(pick: (p: Product) => T | T[]) => {
    const counts = new Map<T, number>();
    for (const product of PRODUCTS) {
      const keys = pick(product);
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  };

  const categories = countBy((p) => p.category);
  const sizes = countBy((p) =>
    p.sizes.filter((s) => s.inStock).map((s) => s.size),
  );
  const colours = countBy((p) => p.colour.slug);
  const colourNames = new Map(
    PRODUCTS.map((p) => [p.colour.slug, p.colour] as const),
  );

  const groups: FilterGroup[] = [
    {
      id: "category",
      label: "Category",
      options: [...categories].map(([value, count]) => ({
        value,
        label: COLLECTIONS.find((c) => c.slug === value)?.title ?? value,
        count,
      })),
    },
    {
      id: "size",
      label: "Size",
      options: (["XS", "S", "M", "L", "XL", "XXL"] as const)
        .filter((s) => sizes.has(s))
        .map((value) => ({
          value,
          label: value,
          count: sizes.get(value) ?? 0,
        })),
    },
    {
      id: "colour",
      label: "Colour",
      options: [...colours].map(([value, count]) => ({
        value,
        label: colourNames.get(value)?.name ?? value,
        count,
        hex: colourNames.get(value)?.hex,
      })),
    },
    {
      id: "price",
      label: "Price",
      options: [
        {
          value: "under-3000",
          label: "Under ₹3,000",
          count: PRODUCTS.filter((p) => p.price < 3000).length,
        },
        {
          value: "3000-5000",
          label: "₹3,000 to ₹5,000",
          count: PRODUCTS.filter((p) => p.price >= 3000 && p.price < 5000).length,
        },
        {
          value: "5000-7000",
          label: "₹5,000 to ₹7,000",
          count: PRODUCTS.filter((p) => p.price >= 5000 && p.price < 7000).length,
        },
        {
          value: "over-7000",
          label: "Over ₹7,000",
          count: PRODUCTS.filter((p) => p.price >= 7000).length,
        },
      ],
    },
  ];

  return settle(groups);
}

export async function getSortOptions(): Promise<SortOption[]> {
  return settle([
    { value: "featured", label: "Featured" },
    { value: "newest", label: "Newest first" },
    { value: "price-asc", label: "Price, low to high" },
    { value: "price-desc", label: "Price, high to low" },
  ]);
}

/** What the bag holds when the page loads, so the drawer has something in it. */
export async function getInitialBag(): Promise<BagLine[]> {
  const overshirt = PRODUCTS[0];
  const trouser = PRODUCTS.find((p) => p.slug === "wide-leg-trouser-slate")!;
  return settle([
    {
      id: "bl-1",
      productId: overshirt.id,
      slug: overshirt.slug,
      name: overshirt.name,
      price: overshirt.price,
      size: "M",
      colourName: overshirt.colour.name,
      quantity: 1,
      image: overshirt.images[0],
    },
    {
      id: "bl-2",
      productId: trouser.id,
      slug: trouser.slug,
      name: trouser.name,
      price: trouser.price,
      size: "M",
      colourName: trouser.colour.name,
      quantity: 1,
      image: trouser.images[0],
    },
  ]);
}

export async function getOrders(): Promise<Order[]> {
  return settle(ORDERS);
}

export async function getStockAlerts(): Promise<StockAlert[]> {
  return settle(STOCK_ALERTS);
}

export async function getAdminFigures(): Promise<AdminFigure[]> {
  return settle(ADMIN_FIGURES);
}

export async function getAdminProducts(): Promise<AdminProductRow[]> {
  const rows: AdminProductRow[] = PRODUCTS.map((p) => {
    const out = p.sizes.filter((s) => !s.inStock);
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: p.category,
      price: p.price,
      colourName: p.colour.name,
      // Deterministic, so the table reads the same on every render.
      stock: p.sizes.filter((s) => s.inStock).length * 7 + (p.isNew ? 12 : 3),
      sizesOutOfStock: out.map((s) => s.size),
      image: p.images[0],
    };
  });
  return settle(rows);
}

export * from "./types";
