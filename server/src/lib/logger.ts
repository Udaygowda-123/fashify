import pino from "pino";
import { env, isProduction, isTest } from "../config/env.js";

/**
 * Structured JSON in production, human-readable in development. The redact
 * list matters: request logging would otherwise put Firebase ID tokens, the
 * signed guest cookie and Razorpay signatures into the log stream.
 */
export const logger = pino({
  level: isTest ? "silent" : env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-razorpay-signature']",
      "req.headers['idempotency-key']",
      "res.headers['set-cookie']",
      "*.password",
      "*.privateKey",
      "*.FIREBASE_PRIVATE_KEY",
      "*.MONGODB_URI",
    ],
    censor: "[redacted]",
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
      }),
});

export type Logger = typeof logger;
