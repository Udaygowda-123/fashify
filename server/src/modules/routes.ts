import type { Express, Router } from "express";
import { Router as createRouter } from "express";
import mongoose from "mongoose";
import { features } from "../config/env.js";
import { getRedis } from "../lib/redis.js";
import { accountRouter } from "./account/account.routes.js";
import { adminRouter } from "./admin/admin.routes.js";
import { cartRouter } from "./cart/cart.routes.js";
import { catalogRouter } from "./catalog/catalog.routes.js";
import { checkoutRouter } from "./checkout/checkout.routes.js";
import { ordersRouter } from "./orders/orders.routes.js";
import { webhookRouter } from "./payments/webhook.routes.js";
import { returnsRouter } from "./returns/returns.routes.js";

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

  v1.use("/catalog", catalogRouter);
  v1.use("/cart", cartRouter);
  v1.use("/checkout", checkoutRouter);
  v1.use("/orders", ordersRouter);
  v1.use("/returns", returnsRouter);
  v1.use("/account", accountRouter);
  v1.use("/admin", adminRouter);
  // Not behind auth or the limiter: the caller is the gateway, and its
  // authenticity comes from the signature over the raw body.
  v1.use("/webhooks", webhookRouter);

  app.use("/api/v1", v1);
}
