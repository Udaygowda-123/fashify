import type { Types } from "mongoose";
import { logger } from "../lib/logger.js";
import { sendEmail } from "../lib/mailer.js";
import { BackInStockRequest, InventoryItem, Product, Variant } from "../models/index.js";
import { BackInStock } from "../emails/templates.js";

/**
 * Emails everyone waiting on a variant that has just come back, oldest first.
 *
 * Oldest first because the person who asked in March should hear before the one
 * who asked this morning — and because when only three came back, the order
 * decides who gets them.
 *
 * `notifiedAt` is stamped with a conditional update per row, so two callers
 * (an admin restocking while the nightly job runs) cannot both email the same
 * address. The stamp goes on BEFORE the send: a duplicate email is worse than
 * a missed one, and a missed one is visible in the logs.
 */
export async function notifyRestocked(
  variantId: Types.ObjectId,
): Promise<{ notified: number; skipped: number }> {
  const inventory = await InventoryItem.findOne({ variantId }).lean();
  const available = inventory ? inventory.onHand - inventory.reserved : 0;
  if (available <= 0) return { notified: 0, skipped: 0 };

  const variant = await Variant.findById(variantId).lean();
  if (!variant) return { notified: 0, skipped: 0 };
  const product = await Product.findById(variant.productId)
    .select("name slug images status")
    .lean();
  if (!product || product.status !== "active") return { notified: 0, skipped: 0 };

  const waiting = await BackInStockRequest.find({ variantId, notifiedAt: null })
    .sort({ createdAt: 1 })
    // Never email more people than there are pieces: telling twelve people
    // about three units produces nine disappointed shoppers.
    .limit(Math.max(1, available))
    .lean();

  let notified = 0;
  let skipped = 0;

  for (const request of waiting) {
    const claimed = await BackInStockRequest.findOneAndUpdate(
      { _id: request._id, notifiedAt: null },
      { $set: { notifiedAt: new Date() } },
      { new: true },
    );
    if (!claimed) {
      skipped += 1;
      continue;
    }

    await sendEmail({
      to: request.email,
      subject: `${product.name} is back in ${variant.size}`,
      kind: "back-in-stock",
      element: BackInStock({
        productName: product.name,
        size: variant.size,
        colour: variant.colour?.name ?? "",
        slug: product.slug,
        available,
        image: product.images[0]?.url ?? null,
      }),
    });
    notified += 1;
  }

  if (notified > 0) {
    logger.info(
      { sku: variant.sku, notified, available },
      "back-in-stock notifications sent",
    );
  }
  return { notified, skipped };
}

/**
 * The scheduled sweep, for stock that appeared without anyone pressing the
 * admin button — a return coming back, or a cancelled order restocking.
 */
export async function runBackInStockSweep(): Promise<{ variants: number; emails: number }> {
  const candidates = await BackInStockRequest.aggregate<{ _id: Types.ObjectId }>([
    { $match: { notifiedAt: null } },
    { $group: { _id: "$variantId" } },
    { $limit: 200 },
  ]);

  let emails = 0;
  let variants = 0;
  for (const candidate of candidates) {
    const result = await notifyRestocked(candidate._id);
    if (result.notified > 0) {
      variants += 1;
      emails += result.notified;
    }
  }
  return { variants, emails };
}
