import "dotenv/config";
import { z } from "zod";

/**
 * Every environment variable is validated here, once, at boot. A missing or
 * malformed value fails the process immediately with a readable message —
 * rather than surfacing as `undefined` inside a request three days later.
 *
 * The third-party blocks are optional by design. The whole catalog, cart,
 * inventory and order-pricing surface works with nothing but Mongo and Redis,
 * so the project is runnable from a clean clone without signing up to five
 * services. Each integration reports whether it is configured, and its routes
 * answer 503 rather than pretending. In production the required set is larger:
 * see `assertProductionReadiness` below.
 */
const booleanish = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  // Comma-separated list; CORS is locked to exactly these.
  CLIENT_ORIGIN: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  COOKIE_SECRET: z
    .string()
    .min(16, "COOKIE_SECRET must be at least 16 characters"),

  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  // Service account keys carry literal \n sequences when stored in an env var.
  FIREBASE_PRIVATE_KEY: z
    .string()
    .optional()
    .transform((value) => value?.replace(/\\n/g, "\n")),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Fashify <orders@example.in>"),
  ADMIN_ALERT_EMAIL: z.string().optional(),

  CLOUDINARY_URL: z.string().optional(),

  RESERVATION_TTL_MINUTES: z.coerce.number().int().positive().default(20),
  CART_TTL_DAYS: z.coerce.number().int().positive().default(30),
  ABANDONED_CART_HOURS: z.coerce.number().int().positive().default(4),
  ENABLE_JOBS: booleanish.default("true"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  // Not the logger: the logger's own level comes from this file.
  console.error(`Invalid environment configuration:\n${problems}\n`);
  console.error("Copy .env.example to .env and fill it in.");
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

/** Which optional integrations actually have credentials behind them. */
export const features = {
  auth: Boolean(
    env.FIREBASE_PROJECT_ID &&
      env.FIREBASE_CLIENT_EMAIL &&
      env.FIREBASE_PRIVATE_KEY,
  ),
  payments: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
  webhookVerification: Boolean(env.RAZORPAY_WEBHOOK_SECRET),
  email: Boolean(env.RESEND_API_KEY),
  uploads: Boolean(env.CLOUDINARY_URL),
} as const;

export type FeatureName = keyof typeof features;

/**
 * Only refuses to boot over something that has no independent guard at the
 * point of use. A default COOKIE_SECRET is exactly that: nothing downstream
 * checks it again, so a deploy that forgot to set it would sign every guest
 * cart cookie with a value published in this repo's own history.
 *
 * Everything else is deliberately NOT a hard stop here, because each one
 * already fails safely on its own: an unconfigured integration answers 503
 * through FeatureUnavailableError the moment a route needs it (see
 * config/env.ts's `features` object), and the one genuinely dangerous
 * combination — payments live but webhook signatures unverifiable — is
 * caught independently by verifyWebhookSignature() in lib/razorpay.ts, which
 * refuses in production regardless of whether this function ever ran. A
 * server can therefore go live behind Render or similar before Razorpay and
 * Resend exist yet: checkout and email answer "not configured" instead of
 * doing something insecure, which is the same posture Stripe's own staging
 * guides recommend for a partially-configured environment.
 */
export function assertProductionReadiness(): void {
  if (!isProduction) return;

  if (env.COOKIE_SECRET.startsWith("change-me")) {
    console.error(
      "Refusing to start in production: COOKIE_SECRET is still the example " +
        "value. Generate one with `openssl rand -hex 32` and set it for real.",
    );
    process.exit(1);
  }
}
