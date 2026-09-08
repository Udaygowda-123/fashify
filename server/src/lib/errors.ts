/**
 * One error envelope for the whole API:
 *
 *   { "error": { "code": "INSUFFICIENT_STOCK", "message": "...", "details": {} } }
 *
 * `code` is stable and machine-readable — the client switches on it. `message`
 * is written for a person to read on a screen, so it says what happened and
 * what to do, and never leaks internals.
 */
export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "INSUFFICIENT_STOCK",
  "INVALID_STATUS_TRANSITION",
  "CART_EMPTY",
  "COUPON_INVALID",
  "PAYMENT_FAILED",
  "SIGNATURE_INVALID",
  "RATE_LIMITED",
  "FEATURE_UNAVAILABLE",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: Record<string, unknown>;
  /** False for genuine bugs, so the handler knows to log at error level. */
  readonly expected: boolean;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details: Record<string, unknown> = {},
    expected = true,
  ) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
    this.expected = expected;
    Error.captureStackTrace?.(this, new.target);
  }

  toEnvelope() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

export class ValidationError extends AppError {
  constructor(message = "Some of that could not be read.", details: Record<string, unknown> = {}) {
    super(400, "VALIDATION_FAILED", message, details);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Sign in to continue.") {
    super(401, "UNAUTHENTICATED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "This account cannot do that.") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(what = "That") {
    super(404, "NOT_FOUND", `${what} could not be found.`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(409, "CONFLICT", message, details);
  }
}

/**
 * Carries the numbers the shopper needs: which piece, and how many are left.
 * A bare "out of stock" makes people reload and try again.
 */
export class InsufficientStockError extends AppError {
  constructor(args: {
    variantId: string;
    requested: number;
    available: number;
    label?: string;
  }) {
    const { variantId, requested, available, label } = args;
    const piece = label ? ` of the ${label}` : "";
    const message =
      available === 0
        ? `There are none${piece} left.`
        : available === 1
          ? `Only 1${piece} left, and you asked for ${requested}.`
          : `Only ${available}${piece} left, and you asked for ${requested}.`;
    super(409, "INSUFFICIENT_STOCK", message, {
      variantId,
      requested,
      available,
    });
  }
}

export class InvalidStatusTransitionError extends AppError {
  constructor(from: string, to: string, allowed: readonly string[]) {
    super(
      409,
      "INVALID_STATUS_TRANSITION",
      `An order that is ${from.replace(/_/g, " ")} cannot become ${to.replace(/_/g, " ")}.`,
      { from, to, allowed },
    );
  }
}

export class CouponInvalidError extends AppError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(422, "COUPON_INVALID", message, details);
  }
}

export class SignatureInvalidError extends AppError {
  constructor(message = "That signature does not match.") {
    super(400, "SIGNATURE_INVALID", message);
  }
}

/**
 * Thrown when a route needs an integration that has no credentials. Better
 * than a 500, and better than pretending the call succeeded.
 */
export class FeatureUnavailableError extends AppError {
  constructor(feature: string, envVars: string) {
    super(
      503,
      "FEATURE_UNAVAILABLE",
      `${feature} is not configured on this server.`,
      { feature, requires: envVars },
    );
  }
}

export class InternalError extends AppError {
  constructor(message = "Something went wrong on our side.") {
    super(500, "INTERNAL", message, {}, false);
  }
}
