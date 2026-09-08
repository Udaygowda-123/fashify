import type { Express, Router } from "express";
import { Router as createRouter } from "express";
import mongoose from "mongoose";
import { features } from "../config/env.js";
import { getRedis } from "../lib/redis.js";

/**
 * Every route hangs off /api/v1. Modules are registered here so there is one
 * place to see the whole surface.
 */
export function registerRoutes(app: Express): void {
  const v1: Router = createRouter();

  v1.get("/health", async (_req, res) => {
    const mongoState = mongoose.connection.readyState;
    let redisState = "unknown";
    try {
      redisState = (await getRedis().ping()) === "PONG" ? "up" : "down";
    } catch {
      redisState = "down";
    }

    const healthy = mongoState === 1;
    res.status(healthy ? 200 : 503).json({
      status: healthy ? "ok" : "degraded",
      dependencies: {
        mongo: mongoState === 1 ? "up" : "down",
        redis: redisState,
      },
      // Which optional integrations are wired up on this deployment.
      features,
    });
  });

  app.use("/api/v1", v1);
}
