import { Schema, model, type InferSchemaType, type Model, type Types } from "mongoose";
import { SIZES } from "./types.js";

/**
 * The sellable thing. Every cart line, order line, reservation and inventory
 * row points at a variant, never at a product.
 *
 * Note what is NOT here: any notion of how many there are. Stock lives in
 * InventoryItem — see the comment there for why.
 */
const variantSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    /** Warehouse-facing identifier, e.g. FSH-OVS-ECRU-M. */
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    colour: {
      name: { type: String, required: true, trim: true },
      slug: { type: String, required: true, trim: true, lowercase: true },
      /** Swatch fill. Approximates the cloth; never used for text. */
      hex: {
        type: String,
        required: true,
        match: [/^#[0-9a-fA-F]{6}$/, "hex must look like #RRGGBB"],
      },
    },

    size: { type: String, enum: SIZES, required: true },

    /** In paise. What the shopper pays today. */
    price: {
      type: Number,
      required: true,
      min: [1, "price is in paise and must be positive"],
      validate: {
        validator: Number.isInteger,
        message: "price must be an integer number of paise",
      },
    },

    /**
     * In paise. The higher, struck-through price, when there is one. Must
     * exceed `price` or the discount it implies is a lie.
     */
    compareAtPrice: {
      type: Number,
      default: null,
      validate: {
        validator: function (this: { price: number }, value: number | null) {
          return value === null || (Number.isInteger(value) && value > this.price);
        },
        message: "compareAtPrice must be an integer above price, or null",
      },
    },

    /** Drives shipping bands. */
    weightGrams: { type: Number, required: true, min: 1 },

    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, collection: "variants" },
);

/** Every product page loads its whole size run at once. */
variantSchema.index({ productId: 1 });

/**
 * One variant per product-colour-size. Without this a careless admin import
 * creates a second "Ecru Overshirt / M", and half the stock becomes
 * unreachable behind whichever row the query happens to pick.
 */
variantSchema.index({ productId: 1, "colour.slug": 1, size: 1 }, { unique: true });

/** Faceted search filters on colour and size across the whole catalogue. */
variantSchema.index({ isActive: 1, "colour.slug": 1, size: 1 });

/** Price-band facets and price sorting. */
variantSchema.index({ isActive: 1, price: 1 });

export type VariantDoc = InferSchemaType<typeof variantSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Variant: Model<VariantDoc> = model<VariantDoc>("Variant", variantSchema);
