import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { pinoHttp } from "pino-http";
import { env, features } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { generalLimiter } from "./middleware/rate-limit.js";
import { sanitizeRequest } from "./middleware/sanitize.js";
import { registerRoutes } from "./modules/routes.js";
import { rawBodySaver } from "./modules/payments/webhook-raw-body.js";

export function createApp(): Express {
  const app = express();

  // Behind a proxy the rate limiter and logs need the real client address.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req.headers["x-request-id"] as string) ?? randomUUID(),
      // 4xx is the client's problem, not a server warning.
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "info" : "debug",
      autoLogging: {
        ignore: (req) => req.url === "/health" || req.url === "/api/v1/health",
      },
    }),
  );

  app.use(helmet());

  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
      // Idempotency-Key is ours; the rest are standard.
      allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Request-Id"],
      exposedHeaders: ["X-Request-Id"],
    }),
  );

  /**
   * The webhook route needs the byte-exact body to verify its signature, so
   * the raw buffer is stashed before JSON parsing rewrites it. Re-serialising
   * parsed JSON does not reproduce the original bytes and the HMAC will not
   * match.
   */
  app.use(express.json({ limit: "1mb", verify: rawBodySaver }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));
  app.use(cookieParser(env.COOKIE_SECRET));
  app.use(sanitizeRequest);
  app.use(generalLimiter);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  registerRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export { features };
