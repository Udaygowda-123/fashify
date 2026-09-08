import type { RequestHandler } from "express";
import type { ZodTypeAny, z } from "zod";
import { scrubMongoOperators } from "./sanitize.js";

/**
 * zod on every request boundary. Parsed values are written to `res.locals.input`
 * rather than back onto `req`, because in Express 5 `req.query` is a getter and
 * assigning to it throws.
 *
 * Handlers read their input through `input(res)`, which is typed, so a handler
 * cannot reach for a field the schema does not guarantee.
 */
export interface ParsedInput<B = unknown, Q = unknown, P = unknown> {
  body: B;
  query: Q;
  params: P;
}

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate<S extends Schemas>(schemas: S): RequestHandler {
  return (req, res, next) => {
    try {
      const parsed: ParsedInput = {
        body: schemas.body ? schemas.body.parse(req.body) : req.body,
        // Scrubbed here because Express 5 will not let us replace req.query
        // upstream: `?size[$ne]=M` arrives as an object otherwise.
        query: schemas.query
          ? schemas.query.parse(scrubMongoOperators(req.query))
          : req.query,
        params: schemas.params ? schemas.params.parse(req.params) : req.params,
      };
      res.locals.input = parsed;
      next();
    } catch (error) {
      // The error handler turns ZodError into field-keyed messages.
      next(error);
    }
  };
}

/** Typed accessor for what `validate` produced. */
export function input<B = unknown, Q = unknown, P = unknown>(res: {
  locals: Record<string, unknown>;
}): ParsedInput<B, Q, P> {
  return res.locals.input as ParsedInput<B, Q, P>;
}

/** Infers the parsed shape from a schema object, for handler signatures. */
export type InputOf<S extends Schemas> = ParsedInput<
  S["body"] extends ZodTypeAny ? z.infer<S["body"]> : unknown,
  S["query"] extends ZodTypeAny ? z.infer<S["query"]> : unknown,
  S["params"] extends ZodTypeAny ? z.infer<S["params"]> : unknown
>;
