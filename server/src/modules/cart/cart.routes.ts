import { Router, type RequestHandler } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { isProduction } from "../../config/env.js";
import { UnauthenticatedError } from "../../lib/errors.js";
import { attachIdentity, requireAuth } from "../../middleware/auth.js";
import { input, validate } from "../../middleware/validate.js";
import type { CartDoc } from "../../models/index.js";
import {
  addItem,
  applyCoupon,
  extendHolds,
  getCartView,
  getOrCreateCart,
  mergeGuestCart,
  newGuestToken,
  removeItem,
  setQuantity,
} from "../../services/cart.service.js";

const GUEST_COOKIE = "fashify_guest";

/**
 * The guest token is a signed, httpOnly cookie.
 *
 * Signed so it cannot be edited: without a signature a curious visitor could
 * put someone else's token in the cookie and read their bag. httpOnly so a
 * script on the page cannot read it either. It carries no personal data — it
 * is a random string that happens to name a cart.
 */
function setGuestCookie(res: Parameters<RequestHandler>[1], token: string): void {
  res.cookie(GUEST_COOKIE, token, {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 30 * 24 * 3600 * 1000,
    path: "/",
  });
}

declare module "express-serve-static-core" {
  interface Request {
    cart?: CartDoc;
  }
}

/**
 * Resolves whose bag this is, minting a guest token if there is not one yet.
 * A signed-in shopper always gets their user bag, even if a guest cookie is
 * still lying around — the merge endpoint is what moves the guest bag over.
 */
const resolveCart: RequestHandler = async (req, res, next) => {
  if (req.auth) {
    req.cart = await getOrCreateCart({ userId: req.auth.userId });
    next();
    return;
  }

  const signed = req.signedCookies?.[GUEST_COOKIE];
  const token = typeof signed === "string" && signed.length > 0 ? signed : newGuestToken();
  if (token !== signed) setGuestCookie(res, token);

  req.cart = await getOrCreateCart({ guestToken: token });
  next();
};

const objectId = z
  .string()
  .refine((value) => Types.ObjectId.isValid(value), "That is not a valid id.")
  .transform((value) => new Types.ObjectId(value));

const addBody = z.object({
  variantId: objectId,
  quantity: z.coerce.number().int().min(1).max(10).default(1),
});

const quantityBody = z.object({
  quantity: z.coerce.number().int().min(0).max(10),
});

const variantParam = z.object({ variantId: objectId });

const couponBody = z.object({
  code: z.string().trim().max(32).nullable(),
});

export const cartRouter: Router = Router();

cartRouter.use(attachIdentity, resolveCart);

cartRouter.get("/", async (req, res) => {
  res.json(await getCartView(req.cart!));
});

cartRouter.post("/items", validate({ body: addBody }), async (req, res) => {
  const { body } = input<z.infer<typeof addBody>>(res);
  const cart = await addItem({
    cart: req.cart!,
    variantId: body.variantId,
    quantity: body.quantity,
  });
  res.status(201).json(await getCartView(cart));
});

cartRouter.patch(
  "/items/:variantId",
  validate({ params: variantParam, body: quantityBody }),
  async (req, res) => {
    const { body, params } = input<
      z.infer<typeof quantityBody>,
      unknown,
      z.infer<typeof variantParam>
    >(res);
    const cart = await setQuantity({
      cart: req.cart!,
      variantId: params.variantId,
      quantity: body.quantity,
    });
    res.json(await getCartView(cart));
  },
);

cartRouter.delete(
  "/items/:variantId",
  validate({ params: variantParam }),
  async (req, res) => {
    const { params } = input<unknown, unknown, z.infer<typeof variantParam>>(res);
    const cart = await removeItem({ cart: req.cart!, variantId: params.variantId });
    res.json(await getCartView(cart));
  },
);

cartRouter.post("/coupon", validate({ body: couponBody }), async (req, res) => {
  const { body } = input<z.infer<typeof couponBody>>(res);
  const cart = await applyCoupon({ cart: req.cart!, code: body.code });
  res.json(await getCartView(cart));
});

/** Called when the shopper reaches checkout, to keep their holds alive. */
cartRouter.post("/extend", async (req, res) => {
  const expiresAt = await extendHolds(req.cart!._id);
  res.json({ holdsExpireAt: expiresAt });
});

/**
 * Called once, straight after sign-in. Requires a real token — this moves one
 * bag into another, so it must not be reachable by a guess.
 */
cartRouter.post("/merge", requireAuth, async (req, res) => {
  if (!req.auth) throw new UnauthenticatedError();

  const signed = req.signedCookies?.[GUEST_COOKIE];
  if (typeof signed !== "string" || signed.length === 0) {
    // Nothing to merge: answer with the user's bag rather than an error.
    const cart = await getOrCreateCart({ userId: req.auth.userId });
    res.json({ ...(await getCartView(cart)), dropped: [] });
    return;
  }

  const report = await mergeGuestCart({
    guestToken: signed,
    userId: req.auth.userId,
  });

  // The guest bag is gone, so the cookie should be too.
  res.clearCookie(GUEST_COOKIE, { path: "/" });

  res.json({ ...(await getCartView(report.cart)), dropped: report.dropped });
});
