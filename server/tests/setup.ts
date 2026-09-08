import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll } from "vitest";
import { disconnectMongo, mongoose } from "../src/lib/mongo.js";
import { syncIndexes } from "../src/models/index.js";

/**
 * A real mongod, in memory, per test file. Not a mock: the whole point of the
 * inventory tests is that MongoDB's own document-level atomicity is doing the
 * work, and a mocked driver would prove nothing about that.
 *
 * A single-member replica set rather than a standalone, because order creation
 * uses a transaction and a standalone mongod cannot run one. The reservation
 * path deliberately needs neither.
 */
let replset: MongoMemoryReplSet;

beforeAll(async () => {
  replset = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
    // Reuse the mongod already installed rather than downloading one.
    binary: process.env.MONGOMS_SYSTEM_BINARY
      ? { systemBinary: process.env.MONGOMS_SYSTEM_BINARY }
      : undefined,
  });

  await mongoose.connect(replset.getUri(), { dbName: "fashify_test" });
  // Unique indexes are what make idempotency and webhook replay safe, so the
  // tests must run against them rather than against a bare collection.
  await syncIndexes();
});

afterEach(async () => {
  // Wipe documents but keep indexes, so each test starts clean without paying
  // to rebuild every index.
  const collections = await mongoose.connection.db?.collections();
  for (const collection of collections ?? []) {
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  await disconnectMongo();
  await replset?.stop();
});
