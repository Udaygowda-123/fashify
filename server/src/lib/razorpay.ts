import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { env, features, isProduction } from "../config/env.js";
import { FeatureUnavailableError, SignatureInvalidError } from "./errors.js";
import { logger } from "./logger.js";

let client: Razorpay | null = null;

export function razorpay(): Razorpay {
  if (client) return client;
  if (!features.payments) {
    throw new FeatureUnavailableError("Payments", "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET");
  }
  client = new Razorpay({
    key_id: env.RAZORPAY_KEY_ID!,
    key_secret: env.RAZORPAY_KEY_SECRET!,
  });
  return client;
}

/** The publishable key the browser needs to open the checkout. */
export function publishableKey(): string {
  if (!features.payments) {
    throw new FeatureUnavailableError("Payments", "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET");
  }
  return env.RAZORPAY_KEY_ID!;
}

/**
 * Constant-time comparison.
 *
 * `a === b` on a signature leaks how many leading bytes matched through how
 * long the comparison took, which is enough to reconstruct a valid signature
 * one byte at a time. The length check first is fine — length is not secret.
 */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Verifies the signature Razorpay's browser checkout hands back on success.
 *
 * This is the client telling us it paid, so on its own it proves nothing about
 * the money — it is signed with our secret, so it proves the message came from
 * Razorpay, but the authoritative event is still the webhook. Both are checked.
 */
export function verifyCheckoutSignature(args: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): void {
  if (!features.payments) {
    throw new FeatureUnavailableError("Payments", "RAZORPAY_KEY_SECRET");
  }
  const expected = createHmac("sha256", env.RAZORPAY_KEY_SECRET!)
    .update(`${args.razorpayOrderId}|${args.razorpayPaymentId}`)
    .digest("hex");

  if (!safeEqual(expected, args.signature)) {
    throw new SignatureInvalidError("That payment could not be verified.");
  }
}

/**
 * Verifies a webhook delivery against the raw request bytes.
 *
 * It must be the raw body: re-serialising the parsed JSON changes key order,
 * whitespace and unicode escaping, so the HMAC would never match. That is why
 * `express.json`'s verify hook stashes the buffer.
 */
export function verifyWebhookSignature(args: {
  rawBody: Buffer | undefined;
  signature: string | undefined;
}): void {
  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    // Refusing in production is the point: an endpoint that skips signature
    // checks lets anyone mark any order paid by posting JSON at it.
    if (isProduction) {
      throw new FeatureUnavailableError("Webhook verification", "RAZORPAY_WEBHOOK_SECRET");
    }
    logger.warn(
      "RAZORPAY_WEBHOOK_SECRET is unset, so this webhook was accepted unverified " +
        "(development only — production refuses to start without it)",
    );
    return;
  }

  if (!args.rawBody || !args.signature) {
    throw new SignatureInvalidError("That webhook was not signed.");
  }

  const expected = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(args.rawBody)
    .digest("hex");

  if (!safeEqual(expected, args.signature)) {
    throw new SignatureInvalidError("That webhook signature does not match.");
  }
}
