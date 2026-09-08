import { Schema, model, type InferSchemaType, type Model, type Types } from "mongoose";
import { CATEGORIES, PRODUCT_STATUSES } from "./types.js";

/**
 * A product is not a sellable thing — it is the editorial wrapper around a set
 * of variants. "Ecru Overshirt" has copy, photographs and a category; what a
 * shopper actually buys is "Ecru Overshirt, Medium", which is a Variant.
 */
const imageSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    /** Real description of the photograph, for screen readers. */
    alt: { type: String, required: true, trim: true, maxlength: 300 },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    /** Sort order within the gallery; the first is the grid tile. */
    position: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug must be lowercase and hyphenated"],
    },

    name: { type: String, required: true, trim: true, maxlength: 200 },

    /** One or two sentences shown under the name. */
    summary: { type: String, required: true, trim: true, maxlength: 500 },

    description: { type: String, required: true, trim: true, maxlength: 4000 },

    category: { type: String, enum: CATEGORIES, required: true },

    /** "100% cotton twill, 320gsm, woven in Erode." */
    fabric: { type: String, required: true, trim: true, maxlength: 500 },

    careInstructions: { type: String, required: true, trim: true, maxlength: 500 },

    /** How it fits and what to do if you are between sizes. */
    fitNotes: { type: String, required: true, trim: true, maxlength: 800 },

    images: {
      type: [imageSchema],
      required: true,
      validate: {
        validator: (images: unknown[]) => images.length > 0,
        message: "a product needs at least one photograph",
      },
    },

    status: { type: String, enum: PRODUCT_STATUSES, required: true, default: "draft" },

    /**
     * The headline price, in paise. Variants may each override it — a size run
     * is usually one price, but an XXL can cost more cloth.
     */
    basePrice: {
      type: Number,
      required: true,
      min: [1, "basePrice is in paise and must be positive"],
      validate: {
        validator: Number.isInteger,
        message: "basePrice must be an integer number of paise",
      },
    },

    /** Slugs of pieces shown in the "goes with this" rail. */
    goesWith: { type: [String], default: [] },

    /** Drives the default sort and the "New in" rail. */
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "products" },
);

/**
 * The storefront only ever asks for active products, and almost always
 * newest-first. A compound index means that query is served entirely from the
 * index without touching a document to filter.
 */
productSchema.index({ status: 1, publishedAt: -1 });

/** Category listing pages, same shape. */
productSchema.index({ status: 1, category: 1, publishedAt: -1 });

/**
 * Text search over the fields a shopper would actually type. Weighted so a
 * name match beats a mention buried in the description.
 */
productSchema.index(
  { name: "text", summary: "text", description: "text", fabric: "text" },
  {
    weights: { name: 10, summary: 4, fabric: 2, description: 1 },
    name: "product_text",
  },
);

export type ProductDoc = InferSchemaType<typeof productSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Product: Model<ProductDoc> = model<ProductDoc>("Product", productSchema);
