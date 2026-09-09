import type { ErrorRequestHandler, RequestHandler } from "express";
import { MulterError } from "multer";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { isProduction } from "../config/env.js";
import { AppError, ConflictError, NotFoundError, ValidationError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

/** Anything that falls through the router is a 404 in the same envelope. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`${req.method} ${req.path}`));
};

/** Turns a ZodError into field-keyed messages the client can put beside inputs. */
function fromZod(error: ZodError): ValidationError {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "(root)";
    fields[path] ??= issue.message;
  }
  const count = Object.keys(fields).length;
  return new ValidationError(
    count === 1 ? "One field needs fixing." : `${count} fields need fixing.`,
    { fields },
  );
}

/**
 * Translates the errors the stack throws into our envelope. Express 5 forwards
 * rejected promises from handlers here on its own, so route code can be plain
 * `async` with no wrapper.
 */
function normalise(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) return fromZod(error);

  if (error instanceof mongoose.Error.ValidationError) {
    const fields: Record<string, string> = {};
    for (const [path, issue] of Object.entries(error.errors)) {
      fields[path] = issue.message;
    }
    return new ValidationError("Some of that could not be saved.", { fields });
  }

  if (error instanceof MulterError) {
    return new ValidationError(
      error.code === "LIMIT_FILE_SIZE"
        ? "That photograph is too large. Keep it under 8MB."
        : "That file could not be uploaded.",
      { fields: { file: error.message } },
    );
  }

  if (error instanceof mongoose.Error.CastError) {
    return new ValidationError(`"${String(error.value)}" is not a valid ${error.path}.`, {
      fields: { [error.path]: "Not a valid id." },
    });
  }

  // Duplicate key. The index name tells us which uniqueness rule was hit, and
  // several of them are load-bearing: idempotencyKey on orders and eventId on
  // webhook events are how replays stay harmless.
  if (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === 11000
  ) {
    const keyPattern = (error as { keyPattern?: Record<string, unknown> }).keyPattern ?? {};
    const field = Object.keys(keyPattern)[0] ?? "value";
    return new ConflictError(`That ${field} already exists.`, { field });
  }

  const wrapped = new AppError(
    500,
    "INTERNAL",
    "Something went wrong on our side.",
    {},
    false,
  );
  // Keep the original for the log; it never reaches the response.
  (wrapped as { cause?: unknown }).cause = error;
  return wrapped;
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const appError = normalise(error);
  const log = (req as { log?: typeof logger }).log ?? logger;

  if (appError.expected) {
    log.info(
      { code: appError.code, status: appError.status, path: req.path },
      appError.message,
    );
  } else {
    log.error(
      { err: (appError as { cause?: unknown }).cause ?? error, path: req.path },
      "unhandled error",
    );
  }

  const body = appError.toEnvelope();

  // Stack traces are a development aid and an information leak in production.
  if (!isProduction && !appError.expected) {
    const original = (appError as { cause?: unknown }).cause ?? error;
    (body.error.details as Record<string, unknown>).stack =
      original instanceof Error ? original.stack?.split("\n").slice(0, 6) : String(original);
  }

  res.status(appError.status).json(body);
};
