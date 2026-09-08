import rateLimit, { type Store } from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { isTest } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { getRedis } from "../lib/redis.js";

/**
 * Redis-backed so the limit is shared across instances — an in-memory store
 * silently multiplies every limit by the number of processes.
 *
 * If Redis is unreachable the library falls back to its memory store, which is
 * the right failure mode: a weaker limit beats refusing traffic.
 */
function store(prefix: string): Store | undefined {
  if (isTest) return undefined;
  try {
    return new RedisStore({
      // ioredis' `call` wants (command, ...args); the store hands us one flat
      // array, so the head is split off to satisfy the signature.
      sendCommand: (...args: string[]) =>
        getRedis().call(args[0] as string, ...args.slice(1)) as Promise<never>,
      prefix: `rl:${prefix}:`,
    });
  } catch (error) {
    logger.warn({ err: error }, "redis rate-limit store unavailable, using memory");
    return undefined;
  }
}

function limiter(options: {
  name: string;
  windowMs: number;
  max: number;
  message: string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    // Skip entirely under test: 20 concurrent add-to-bag calls is the point of
    // the concurrency test, not something to throttle.
    skip: () => isTest,
    store: store(options.name),
    handler: (_req, _res, next) => {
      next(new AppError(429, "RATE_LIMITED", options.message));
    },
  });
}

/** Broad ceiling on everything, generous enough to be invisible in normal use. */
export const generalLimiter = limiter({
  name: "general",
  windowMs: 60_000,
  max: 300,
  message: "That is a lot of requests. Wait a minute and try again.",
});

/** Tighter: these are the endpoints worth brute-forcing or abusing. */
export const authLimiter = limiter({
  name: "auth",
  windowMs: 15 * 60_000,
  max: 20,
  message: "Too many sign-in attempts. Try again in a few minutes.",
});

export const checkoutLimiter = limiter({
  name: "checkout",
  windowMs: 60_000,
  max: 12,
  message: "Too many checkout attempts. Wait a moment and try again.",
});

/** One address should not be able to sign up the world for restock alerts. */
export const notifyLimiter = limiter({
  name: "notify",
  windowMs: 60 * 60_000,
  max: 20,
  message: "You have signed up for a lot of alerts. Try again later.",
});
