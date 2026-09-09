/**
 * The whole data layer, now backed by the real Express API from server/.
 * Every export keeps the exact signature it had in Phase 1 — every caller
 * (pages, components) is unchanged; only what happens inside each function
 * changed, from reading a local array to calling `fetch`.
 *
 * Four functions stay local and always will: getHeroImage, getEditorialImage,
 * getAuthImage and getEmptyRailImage return page furniture — art direction for
 * the hero, the editorial block, the auth panel and the empty-bag state — not
 * commerce data. There is no Product or Collection row for "the photograph
 * behind the sign-in form", and there should not be one; the server's data
 * model in server/src/models/ is deliberately silent on it.
 */
import { apiFetch, toQuery } from "@/lib/api/client";
import {
  AUTH_IMAGE,
  EDITORIAL_IMAGE,
  EMPTY_RAIL_IMAGE,
  HERO_IMAGE,
  LOOKBOOK,
} from "./catalogue";
import type {
  CategorySlug,
  Collection,
  ColourOption,
  FilterGroup,
  ImageAsset,
  LookbookImage,
  Product,
  ProductVariant,
  SortOption,
} from "./types";

const toRupees = (paise: number): number => Math.round(paise / 100);

function toImage(image: { url: string; alt: string; width: number; height: number }): ImageAsset {
  return { src: image.url, alt: image.alt, width: image.width, height: image.height };
}

/** Generic, policy copy — the same on every product, so it lives here rather
 *  than in the server's per-product data. */
const DELIVERY =
  "Free delivery across India, two to four working days. Returns are free for 30 days, unworn and with tags on.";

/* -------------------------------------------------------------------------- */
/* Catalog list — one shared fetch behind getProducts and getFilterGroups     */
/* -------------------------------------------------------------------------- */

interface ServerListItem {
  id: string;
  slug: string;
  name: string;
  summary: string;
  category: CategorySlug;
  minPrice: number;
  compareAtPrice: number | null;
  images: { url: string; alt: string; width: number; height: number }[];
  colourCount: number;
  isSoldOut: boolean;
}

interface ServerFacetGroup {
  id: FilterGroup["id"];
  label: string;
  options: { value: string; label: string; count: number; hex?: string }[];
}

interface ServerListResponse {
  items: ServerListItem[];
  facets: ServerFacetGroup[];
  total: number;
  nextCursor: string | null;
}

/**
 * A grid tile only ever reads `colours.length`, never a colour's own name —
 * see components/product/ProductTile.tsx — so a same-length array of blanks
 * is a safe stand-in for the real per-colour data the list endpoint does not
 * send (that would mean joining every variant for every row of a 30-piece
 * grid, for a number the client already gets as `colourCount`).
 */
function blankColours(count: number): ColourOption[] {
  return Array.from({ length: Math.max(1, count) }, (_, i) => ({
    slug: `c${i}`,
    name: "",
    hex: "#00000000",
  }));
}

function toListProduct(item: ServerListItem): Product {
  const colours = blankColours(item.colourCount);
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    category: item.category,
    price: toRupees(item.minPrice),
    colour: colours[0]!,
    colours,
    images: item.images.map(toImage),
    sizes: [],
    span: "single",
    summary: item.summary,
    composition: "",
    fitNotes: "",
    delivery: DELIVERY,
    isNew: false,
    goesWith: [],
  };
}

/**
 * Query params match the shape server/src/modules/catalog/catalog.routes.ts
 * validates. `limit` is capped at 48 there; the seed carries 30 products, so
 * one page covers the whole catalogue for the demo scale. The server's
 * cursor pagination is real and ready — the shop UI just does not page
 * through it yet.
 */
async function fetchList(params: {
  category?: CategorySlug[];
  limit?: number;
  sort?: string;
}): Promise<ServerListResponse> {
  return apiFetch<ServerListResponse>(
    `/catalog/products${toQuery({
      category: params.category,
      limit: params.limit ?? 48,
      sort: params.sort ?? "featured",
    })}`,
  );
}

export async function getProducts(): Promise<Product[]> {
  const data = await fetchList({});
  return data.items.map(toListProduct);
}

export async function getProduct(slug: string): Promise<Product | null> {
  try {
    const detail = await apiFetch<{
      id: string;
      slug: string;
      name: string;
      summary: string;
      category: CategorySlug;
      fabric: string;
      fitNotes: string;
      images: { url: string; alt: string; width: number; height: number }[];
      minPrice: number;
      variants: {
        id: string;
        sku: string;
        size: string;
        colour: ColourOption;
        price: number;
        compareAtPrice: number | null;
        available: number;
        inStock: boolean;
        isLow: boolean;
      }[];
      colours: ColourOption[];
      goesWith: string[];
    }>(`/catalog/products/${slug}`);

    const variants: ProductVariant[] = detail.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size as ProductVariant["size"],
      colour: v.colour,
      price: toRupees(v.price),
      compareAtPrice: v.compareAtPrice ? toRupees(v.compareAtPrice) : null,
      available: v.available,
      inStock: v.inStock,
      isLow: v.isLow,
    }));

    const defaultColour = detail.colours[0] ?? { slug: "", name: "", hex: "#000000" };
    const sizesForDefault = variants
      .filter((v) => v.colour.slug === defaultColour.slug)
      .map((v) => ({ size: v.size, inStock: v.inStock }));

    return {
      id: detail.id,
      slug: detail.slug,
      name: detail.name,
      category: detail.category,
      price: toRupees(detail.minPrice),
      colour: defaultColour,
      colours: detail.colours,
      images: detail.images.map(toImage),
      sizes: sizesForDefault,
      variants,
      span: "single",
      summary: detail.summary,
      composition: detail.fabric,
      fitNotes: detail.fitNotes,
      delivery: DELIVERY,
      isNew: false,
      goesWith: detail.goesWith,
    };
  } catch {
    return null;
  }
}

export async function getProductsByCategory(
  category: CategorySlug,
): Promise<Product[]> {
  const data = await fetchList({ category: [category] });
  return data.items.map(toListProduct);
}

/** The pieces named on a product, in the order the product names them. */
export async function getRelatedProducts(slug: string): Promise<Product[]> {
  const data = await apiFetch<{ items: ServerListItem[] }>(
    `/catalog/products/${slug}/related`,
  );
  return data.items.map(toListProduct);
}

export async function getNewArrivals(limit = 8): Promise<Product[]> {
  const data = await fetchList({ limit, sort: "newest" });
  return data.items.map(toListProduct);
}

/**
 * Real counts, from the server's `$facet` aggregation over the unfiltered
 * catalogue — the same request `getProducts()` makes, deduplicated into one
 * round trip by Next's fetch request memoization since both call `fetchList`
 * with identical arguments.
 */
export async function getFilterGroups(): Promise<FilterGroup[]> {
  const data = await fetchList({});
  return data.facets;
}

export async function getSortOptions(): Promise<SortOption[]> {
  return [
    { value: "featured", label: "Featured" },
    { value: "newest", label: "Newest first" },
    { value: "price-asc", label: "Price, low to high" },
    { value: "price-desc", label: "Price, high to low" },
  ];
}

/* -------------------------------------------------------------------------- */
/* Collections                                                                */
/* -------------------------------------------------------------------------- */

/** One line of editorial copy per category — the server sends the count, not the sell. */
const COLLECTION_BLURBS: Record<CategorySlug, string> = {
  overshirts: "The layer that does most of the work.",
  trousers: "Wide, tapered and straight, in twill and washed linen.",
  knitwear: "Merino for under things, lambswool and alpaca for over them.",
  tees: "Two weights, bound necks, cut long enough to stay tucked.",
};

export async function getCollections(): Promise<Collection[]> {
  const data = await apiFetch<{
    items: {
      slug: CategorySlug;
      title: string;
      pieceCount: number;
      image: { url: string; alt: string; width: number; height: number } | null;
    }[];
  }>("/catalog/collections");

  return data.items
    .filter((row) => row.image)
    .map((row) => ({
      id: row.slug,
      slug: row.slug,
      title: row.title,
      blurb: COLLECTION_BLURBS[row.slug],
      image: toImage(row.image!),
      pieceCount: row.pieceCount,
    }));
}

/* -------------------------------------------------------------------------- */
/* Editorial images — page furniture, not commerce data. See the file header. */
/* -------------------------------------------------------------------------- */

export async function getLookbook(): Promise<LookbookImage[]> {
  return LOOKBOOK;
}

export async function getHeroImage(): Promise<ImageAsset> {
  return HERO_IMAGE;
}

export async function getEditorialImage(): Promise<ImageAsset> {
  return EDITORIAL_IMAGE;
}

export async function getAuthImage(): Promise<ImageAsset> {
  return AUTH_IMAGE;
}

export async function getEmptyRailImage(): Promise<ImageAsset> {
  return EMPTY_RAIL_IMAGE;
}

export * from "./types";
