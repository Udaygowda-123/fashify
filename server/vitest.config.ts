import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Every file gets its own in-memory MongoDB, so one suite cannot see
    // another's documents. Concurrency inside a file is the point; concurrency
    // across files would only make failures hard to read.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: "test",
      // The suite never reaches Redis: rate limiting is skipped under test and
      // locks fall through. Set so config validation passes.
      REDIS_URL: "redis://127.0.0.1:6379",
      COOKIE_SECRET: "test-cookie-secret-at-least-16-chars",
      MONGODB_URI: "mongodb://127.0.0.1:27017/placeholder-replaced-by-setup",
      ENABLE_JOBS: "false",
      LOG_LEVEL: "silent",
    },
  },
});
