import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { attachIdentity, requireAuth } from "../../middleware/auth.js";
import { notifyLimiter } from "../../middleware/rate-limit.js";
import { input, validate } from "../../middleware/validate.js";
import { BackInStockRequest, InventoryItem, User, Variant } from "../../models/index.js";

const addressBody = z.object({
  label: z.string().trim().max(60).nullish(),
  fullName: z.string().trim().min(2).max(200),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "An Indian mobile number is ten digits starting 6 to 9."),
  line1: z.string().trim().min(3).max(300),
  line2: z.string().trim().max(300).nullish(),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(120),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "A PIN code is six digits and cannot start with 0."),
  country: z.string().trim().length(2).default("IN"),
  makeDefault: z.boolean().default(false),
});

export const accountRouter: Router = Router();

/* ---- addresses ---- */

accountRouter.get("/addresses", requireAuth, async (req, res) => {
  const user = await User.findById(req.auth!.userId).lean();
  if (!user) throw new NotFoundError("Your account");
  res.json({
    items: user.addresses.map((address) => ({
      ...address,
      _id: String(address._id),
      isDefault: String(address._id) === String(user.defaultAddressId),
    })),
  });
});

accountRouter.post(
  "/addresses",
  requireAuth,
  validate({ body: addressBody }),
  async (req, res) => {
    const { body } = input<z.infer<typeof addressBody>>(res);
    const { makeDefault, ...address } = body;

    const user = await User.findByIdAndUpdate(
      req.auth!.userId,
      { $push: { addresses: address } },
      { new: true },
    );
    if (!user) throw new NotFoundError("Your account");

    const added = user.addresses.at(-1);
    // The first address a shopper saves is their default whether they asked
    // or not — otherwise checkout has nothing preselected.
    if (added && (makeDefault || user.addresses.length === 1)) {
      user.defaultAddressId = added._id;
      await user.save();
    }

    res.status(201).json({ ...added?.toObject(), _id: String(added?._id) });
  },
);

accountRouter.delete(
  "/addresses/:addressId",
  requireAuth,
  validate({
    params: z.object({
      addressId: z
        .string()
        .refine((value) => Types.ObjectId.isValid(value), "Not a valid id."),
    }),
  }),
  async (req, res) => {
    const { params } = input<unknown, unknown, { addressId: string }>(res);
    const user = await User.findById(req.auth!.userId);
    if (!user) throw new NotFoundError("Your account");

    const before = user.addresses.length;
    user.addresses.pull({ _id: params.addressId });
    if (user.addresses.length === before) throw new NotFoundError("That address");

    if (String(user.defaultAddressId) === params.addressId) {
      user.defaultAddressId = user.addresses[0]?._id ?? null;
    }
    await user.save();

    res.status(204).end();
  },
);

/* ---- back in stock ---- */

const notifyBody = z.object({
  variantId: z
    .string()
    .refine((value) => Types.ObjectId.isValid(value), "Not a valid id.")
    .transform((value) => new Types.ObjectId(value)),
  email: z.string().trim().toLowerCase().email("That does not look like an email address."),
});

/**
 * "Tell me when it's back."
 *
 * Open to guests — the whole point is to capture demand from someone who has
 * not signed in and would otherwise just leave. Rate limited so one address
 * cannot sign the world up, and the compound unique index means asking twice
 * is not two notifications.
 */
accountRouter.post(
  "/back-in-stock",
  attachIdentity,
  notifyLimiter,
  validate({ body: notifyBody }),
  async (req, res) => {
    const { body } = input<z.infer<typeof notifyBody>>(res);

    const variant = await Variant.findOne({ _id: body.variantId, isActive: true }).lean();
    if (!variant) throw new NotFoundError("That size");

    const inventory = await InventoryItem.findOne({ variantId: body.variantId }).lean();
    const available = inventory ? inventory.onHand - inventory.reserved : 0;
    if (available > 0) {
      // Nothing to wait for. Saying so is better than silently queueing them.
      throw new ConflictError("That size is in stock — you can buy it now.", {
        available,
      });
    }

    // Upsert, so a page refresh does not create a second row or 409 on the
    // unique index.
    await BackInStockRequest.findOneAndUpdate(
      { variantId: body.variantId, email: body.email },
      {
        $setOnInsert: {
          variantId: body.variantId,
          email: body.email,
          userId: req.auth?.userId ?? null,
        },
      },
      { upsert: true, new: true },
    );

    res.status(201).json({
      message: `We will email ${body.email} the moment it is back in ${variant.size}.`,
    });
  },
);
