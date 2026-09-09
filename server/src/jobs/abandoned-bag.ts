import { createHmac } from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { sendEmail } from "../lib/mailer.js";
import { withLock } from "../lib/redis.js";
import { Cart, Product, User, Variant } from "../models/index.js";
import { AbandonedBag } from "../emails/templates.js";

const CLIENT = env.CLIENT_ORIGIN[0] ?? "http://localhost:3000";

/**
 * A link that restores the bag in the browser it is opened in.
 *
 * Signed, because the token names a cart: an unsigned link could be edited to
 * open somebody else's bag, with their address in the checkout form. The
 * signature is over the token and cannot be produced without COOKIE_SECRET.
 */
export function recoveryUrl(cartId: string, guestToken: string | null): string {
  const payload = guestToken ?? cartId;
  const signature = createHmac("sha256", env.COOKIE_SECRET)
    .update(payload)
    .digest("base64url");
  return `${CLIENT}/bag/recover?t=${encodeURIComponent(payload)}&s=${signature}`;
}

export function verifyRecoveryToken(token: string, signature: string): boolean {
  const expected = createHmac("sha256", env.COOKIE_SECRET).update(token).digest("base64url");
  return expected === signature;
}

/**
 * Finds bags that have been sitting untouched with something in them and sends
 * one reminder.
 *
 * Exactly one. `recoveryEmailSentAt` is stamped with a conditional update, so
 * a second run — or two instances — cannot send a second. A shop that emails
 * the same bag every four hours is not recovering a sale, it is teaching
 * someone to filter its address.
 *
 * The holds on these bags have long since expired and been swept, which is
 * why the email says the pieces are not held: promising otherwise would be a
 * lie the shopper discovers at checkout.
 */
export async function runAbandonedBagSweep(): Promise<{ sent: number; considered: number }> {
  const cutoff = new Date(Date.now() - env.ABANDONED_CART_HOURS * 3600 * 1000);

  const candidates = await Cart.find({
    // Something in it, never ordered, never reminded, and gone quiet.
    "items.0": { $exists: true },
    convertedAt: null,
    recoveryEmailSentAt: null,
    updatedAt: { $lte: cutoff },
    // Only bags we can actually reach: a guest who never signed in has no
    // address to write to.
    userId: { $ne: null },
  })
    .limit(200)
    .lean();

  let sent = 0;

  for (const cart of candidates) {
    const claimed = await Cart.findOneAndUpdate(
      { _id: cart._id, recoveryEmailSentAt: null },
      { $set: { recoveryEmailSentAt: new Date() } },
      { new: true },
    );
    if (!claimed) continue; // another run got there first

    const user = cart.userId ? await User.findById(cart.userId).lean() : null;
    if (!user?.email || user.email.endsWith("@placeholder.invalid")) continue;

    const variants = await Variant.find({
      _id: { $in: cart.items.map((item) => item.variantId) },
    }).lean();
    const products = await Product.find({
      _id: { $in: variants.map((v) => v.productId) },
    })
      .select("name images status")
      .lean();
    const productById = new Map(products.map((p) => [String(p._id), p]));

    const lines = cart.items.flatMap((item) => {
      const variant = variants.find((v) => String(v._id) === String(item.variantId));
      const product = variant ? productById.get(String(variant.productId)) : undefined;
      if (!variant || !product || product.status !== "active") return [];
      return [
        {
          name: product.name,
          size: variant.size,
          colour: variant.colour?.name ?? "",
          quantity: item.quantity,
          // Current price, so the email cannot quote a stale one.
          unitPrice: variant.price,
          image: product.images[0]?.url ?? null,
        },
      ];
    });

    if (lines.length === 0) continue;

    const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

    await sendEmail({
      to: user.email,
      subject: "Your bag is still here",
      kind: "abandoned-bag",
      element: AbandonedBag({
        name: user.name ?? null,
        lines,
        total,
        recoveryUrl: recoveryUrl(String(cart._id), cart.guestToken ?? null),
      }),
    });
    sent += 1;
  }

  if (sent > 0) {
    logger.info({ sent, considered: candidates.length }, "abandoned bag reminders sent");
  }
  return { sent, considered: candidates.length };
}

export async function runAbandonedBagSweepLocked(): Promise<void> {
  await withLock("sweep:abandoned-bags", 10 * 60_000, async () => {
    await runAbandonedBagSweep();
  });
}
