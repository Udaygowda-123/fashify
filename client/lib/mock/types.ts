/**
 * These are written as API response shapes, not as convenient view models.
 * In Phase 2 the functions in this folder swap their bodies for `fetch` calls
 * against the Express server and nothing that consumes them has to change.
 *
 * Money is a whole number of rupees. No floats anywhere near a price.
 */

export type Rupees = number;

export type SizeCode = "XS" | "S" | "M" | "L" | "XL" | "XXL";

export type CategorySlug = "overshirts" | "trousers" | "knitwear" | "tees";

/** A grid tile spans one column, or two for pieces given more room. */
export type TileSpan = "single" | "wide";

export interface ImageAsset {
  src: string;
  /** Real description of the photograph, not the product name repeated. */
  alt: string;
  width: number;
  height: number;
}

export interface ColourOption {
  slug: string;
  name: string;
  /** Swatch fill. Approximates the cloth; never used for text. */
  hex: string;
}

export interface SizeAvailability {
  size: SizeCode;
  inStock: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  price: Rupees;
  /** The colour this listing represents. */
  colour: ColourOption;
  /** Every colour the piece comes in, this one included. */
  colours: ColourOption[];
  images: ImageAsset[];
  /** Landscape crop of the same garment, for wide grid tiles. */
  wideImage?: ImageAsset;
  sizes: SizeAvailability[];
  span: TileSpan;
  /** One or two sentences. Plain, specific, no filler. */
  summary: string;
  composition: string;
  fitNotes: string;
  delivery: string;
  isNew: boolean;
  /** Slugs of pieces shown in the "goes with this" rail. */
  goesWith: string[];
}

export interface Collection {
  id: string;
  slug: string;
  title: string;
  blurb: string;
  image: ImageAsset;
  pieceCount: number;
}

export interface LookbookImage {
  id: string;
  image: ImageAsset;
}

export interface BagLine {
  /** Stable per line, since one product can be in the bag twice in two sizes. */
  id: string;
  productId: string;
  slug: string;
  name: string;
  price: Rupees;
  size: SizeCode;
  colourName: string;
  quantity: number;
  image: ImageAsset;
}

export type OrderStatus =
  | "new"
  | "packing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface OrderLine {
  name: string;
  size: SizeCode;
  colourName: string;
  quantity: number;
  price: Rupees;
}

export interface Order {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  city: string;
  /** ISO 8601, as the API will send it. */
  placedAt: string;
  status: OrderStatus;
  total: Rupees;
  lines: OrderLine[];
}

export interface StockAlert {
  productId: string;
  slug: string;
  name: string;
  size: SizeCode;
  remaining: number;
}

export interface AdminFigure {
  id: string;
  label: string;
  value: string;
  /** Plain sentence of context, not a percentage badge. */
  note: string;
}

export interface AdminProductRow {
  id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  price: Rupees;
  colourName: string;
  /** Total units across all sizes. */
  stock: number;
  sizesOutOfStock: SizeCode[];
  image: ImageAsset;
}

export interface FilterOption {
  value: string;
  label: string;
  count: number;
  /** Present on colour options only. */
  hex?: string;
}

export interface FilterGroup {
  id: "category" | "size" | "colour" | "price";
  label: string;
  options: FilterOption[];
}

export interface SortOption {
  value: string;
  label: string;
}
