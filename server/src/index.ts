import { createApp } from "./app.js";
import { assertProductionReadiness, env, features } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { connectMongo, disconnectMongo, supportsTransactions } from "./lib/mongo.js";
import { disconnectRedis, getRedis } from "./lib/redis.js";

async function main(): Promise<void> {
  assertProductionReadiness();

  await connectMongo();
  // Touch Redis at boot so a bad URL is a startup failure, not a surprise
  // during the first checkout.
  await getRedis().ping();

  if (!supportsTransactions()) {
    logger.warn(
      "this MongoDB deployment is a standalone, so multi-document transactions " +
        "are unavailable; order creation will run without one",
    );
  }

  const unconfigured = Object.entries(features)
    .filter(([, on]) => !on)
    .map(([name]) => name);
  if (unconfigured.length > 0) {
    logger.warn(
      { unconfigured },
      "running without these integrations; their routes answer 503",
    );
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "fashify api listening");
  });

  // Finish in-flight requests before dropping the connections underneath them.
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutting down");
    server.close(async () => {
      await disconnectMongo();
      await disconnectRedis();
      process.exit(0);
    });
    // Do not hang forever on a stuck socket.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, "failed to start");
  process.exit(1);
});
