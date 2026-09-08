import { Router } from "express";
import { z } from "zod";
import {
  getProductBySlug,
  getRelatedProducts,
  listCollections,
  listProducts,
  PRICE_BANDS,
  type CatalogQuery,
} from "../../services/catalog.service.js";
import { attachIdentity } from "../../middleware/auth.js";
import { input, validate } from "../../middleware/validate.js";
import { CATEGORIES, SIZES } from "../../models/types.js";

/**
 * A query parameter that may appear once (`?size=M`) or several times
 * (`?size=M&size=L`), and should always arrive as an array. Also accepts a
 * comma-separated single value, which is what a URL built by hand tends to
 * look like.
 */
function multi<T extends readonly [string, ...string[]]>(values: T) {
  return z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      const list = Array.isArray(value) ? value : value.split(",");
      const cleaned = list.map((item) => item.trim()).filter(Boolean);
      return cleaned.length ? cleaned : undefined;
    })
    .pipe(z.array(z.enum(values)).optional());
}

const listQuery = z.object({
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  category: multi(CATEGORIES),
  size: multi(SIZES),
  // Colour slugs are open-ended, so they are shape-checked rather than enumerated.
  colour: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      const list = Array.isArray(value) ? value : value.split(",");
      const cleaned = list
        .map((item) => item.trim().toLowerCase())
        .filter((item) => /^[a-z0-9-]{1,40}$/.test(item));
      return cleaned.length ? cleaned : undefined;
    }),
  price: multi(
    PRICE_BANDS.map((band) => band.key) as unknown as readonly [string, ...string[]],
  ),
  sort: z.enum(["featured", "newest", "price-asc", "price-desc"]).default("featured"),
  q: z.string().trim().min(2).max(80).optional(),
});

const slugParam = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "That is not a valid product address."),
});

export const catalogRouter: Router = Router();

// Identity is optional throughout the catalog: it is a public surface, and
// being signed in changes nothing about what is shown.
catalogRouter.use(attachIdentity);

catalogRouter.get("/products", validate({ query: listQuery }), async (_req, res) => {
  const { query } = input<unknown, z.infer<typeof listQuery>>(res);
  const page = await listProducts(query as CatalogQuery);
  res.json(page);
});

catalogRouter.get("/collections", async (_req, res) => {
  res.json({ items: await listCollections() });
});

catalogRouter.get("/products/:slug", validate({ params: slugParam }), async (_req, res) => {
  const { params } = input<unknown, unknown, z.infer<typeof slugParam>>(res);
  res.json(await getProductBySlug(params.slug));
});

catalogRouter.get(
  "/products/:slug/related",
  validate({ params: slugParam }),
  async (_req, res) => {
    const { params } = input<unknown, unknown, z.infer<typeof slugParam>>(res);
    res.json({ items: await getRelatedProducts(params.slug) });
  },
);
