import type { Request } from "express";

/**
 * Keeps the exact bytes of a webhook body so its HMAC can be verified.
 *
 * `JSON.stringify(req.body)` is not the same bytes as what arrived — key order,
 * whitespace and unicode escaping all differ — so the signature would never
 * match. This runs inside `express.json`'s `verify` hook, before parsing, and
 * only holds the buffer for webhook paths so ordinary requests do not each
 * keep a second copy of their body in memory.
 */
const WEBHOOK_PATHS = ["/api/v1/webhooks/"];

export interface WithRawBody extends Request {
  rawBody?: Buffer;
}

export function rawBodySaver(
  req: Request,
  _res: unknown,
  buf: Buffer,
  _encoding: string,
): void {
  if (WEBHOOK_PATHS.some((path) => req.originalUrl.startsWith(path))) {
    (req as WithRawBody).rawBody = Buffer.from(buf);
  }
}

export function getRawBody(req: Request): Buffer | undefined {
  return (req as WithRawBody).rawBody;
}
