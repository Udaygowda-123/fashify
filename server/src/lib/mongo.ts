import mongoose from "mongoose";
import { env, isTest } from "../config/env.js";
import { logger } from "./logger.js";

let connecting: Promise<typeof mongoose> | null = null;

/**
 * Idempotent connect, so importing this from a script, the server and a test
 * helper cannot open three pools.
 *
 * `strictQuery` is on so a typo in a filter key throws instead of silently
 * matching every document — the difference between an empty result and
 * deleting the collection.
 */
export async function connectMongo(uri = env.MONGODB_URI): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (connecting) return connecting;

  mongoose.set("strictQuery", true);
  // Surfaces a mistyped path in a $set as an error rather than a no-op write.
  mongoose.set("strict", "throw");

  connecting = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 15_000,
      // Atlas free tier caps connections; a lean pool leaves room for the
      // concurrency test to open its own.
      maxPoolSize: isTest ? 5 : 20,
      minPoolSize: 0,
      retryWrites: true,
    })
    .then((connection) => {
      logger.info(
        { db: connection.connection.name, host: connection.connection.host },
        "mongo connected",
      );
      return connection;
    })
    .catch((error: unknown) => {
      connecting = null;
      throw error;
    });

  return connecting;
}

export async function disconnectMongo(): Promise<void> {
  connecting = null;
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
}

/**
 * True when the deployment can run multi-document transactions — a replica set
 * or a sharded cluster, but not a standalone mongod. Order creation needs one;
 * the reservation path deliberately does not, because a single conditional
 * update on one document is already atomic without a transaction.
 */
export function supportsTransactions(): boolean {
  const topology = (mongoose.connection as unknown as {
    client?: { topology?: { s?: { description?: { type?: string } } } };
  }).client?.topology?.s?.description?.type;
  return topology === "ReplicaSetWithPrimary" || topology === "Sharded";
}

mongoose.connection.on("disconnected", () => {
  logger.warn("mongo disconnected");
});

mongoose.connection.on("error", (error) => {
  logger.error({ err: error }, "mongo error");
});

export { mongoose };
