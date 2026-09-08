import { Redis } from "ioredis";
import { env, isTest } from "../config/env.js";
import { logger } from "./logger.js";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;

  client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
    lazyConnect: false,
    // Redis being down must not take the shop down with it. Rate limiting and
    // locks degrade; the catalog and the atomic stock path never touch Redis.
    retryStrategy: (times) => (times > 10 ? null : Math.min(times * 200, 2000)),
  });

  client.on("error", (error: Error) => {
    // ioredis reconnects on its own; logging every attempt is noise.
    logger.debug({ err: error.message }, "redis error");
  });

  if (!isTest) {
    client.once("ready", () => logger.info("redis connected"));
  }

  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (!client) return;
  await client.quit().catch(() => client?.disconnect());
  client = null;
}

/**
 * A best-effort mutex, used only where a duplicate run is wasteful rather than
 * incorrect — the cron sweepers, so two instances do not both send the same
 * abandoned-bag email.
 *
 * It is deliberately NOT used to protect stock. Correctness there comes from a
 * single conditional update inside MongoDB, which holds whether or not Redis
 * is reachable. A lock is an optimisation; the database is the source of truth.
 */
export async function withLock<T>(
  key: string,
  ttlMs: number,
  run: () => Promise<T>,
): Promise<T | null> {
  const redis = getRedis();
  const token = `${process.pid}-${Date.now()}-${Math.random()}`;
  const lockKey = `lock:${key}`;

  let acquired = false;
  try {
    acquired = (await redis.set(lockKey, token, "PX", ttlMs, "NX")) === "OK";
  } catch (error) {
    // Redis unreachable: run anyway rather than stalling the job forever.
    logger.warn({ err: error, key }, "lock unavailable, running unlocked");
    return run();
  }

  if (!acquired) return null;

  try {
    return await run();
  } finally {
    // Release only our own lock — never one a later holder took after ours
    // expired mid-run.
    await redis
      .eval(
        `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
        1,
        lockKey,
        token,
      )
      .catch(() => undefined);
  }
}
