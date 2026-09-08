import type { RequestHandler } from "express";

/**
 * Strips Mongo operator keys from anything that arrives in a request.
 *
 * Written by hand rather than pulled in: `express-mongo-sanitize` mutates
 * `req.query`, which is a getter in Express 5, so it throws on every request.
 * The rule is small enough to own — drop keys beginning with `$`, and keys
 * containing a dot, which is how `{"a.b": 1}` reaches into a subdocument.
 *
 * This is defence in depth. The real protection is that every route parses its
 * input with zod, and zod strips unknown keys before a filter is ever built.
 */
function scrub(value: unknown, depth = 0): unknown {
  if (depth > 12 || value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((item) => scrub(item, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith("$") || key.includes(".")) continue;
    out[key] = scrub(nested, depth + 1);
  }
  return out;
}

/**
 * Body only. Path params are always strings, and `req.query` cannot be
 * reassigned in Express 5 — it is scrubbed inside `validate` instead, just
 * before its schema parses it.
 */
export const sanitizeRequest: RequestHandler = (req, _res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = scrub(req.body);
  }
  next();
};

export { scrub as scrubMongoOperators };
