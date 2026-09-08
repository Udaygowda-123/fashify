import { Router } from "express";
import { logger } from "../../lib/logger.js";
import { verifyWebhookSignature } from "../../lib/razorpay.js";
import { handleWebhook } from "../../services/payment.service.js";
import { getRawBody } from "./webhook-raw-body.js";

export const webhookRouter: Router = Router();

/**
 * Razorpay's webhook endpoint.
 *
 * Deliberately NOT behind the auth middleware or the general rate limiter:
 * the caller is Razorpay, it has no bearer token, and throttling it would make
 * it retry a delivery we simply refused to read. Its authenticity comes from
 * the signature over the raw bytes, which is checked before anything else
 * happens.
 *
 * The reply is always fast. Razorpay treats a slow or non-2xx response as a
 * failure and retries, so anything slow — emails, in particular — must happen
 * after the response rather than before it.
 */
webhookRouter.post("/razorpay", async (req, res) => {
  // 1. Authenticity first. Nothing below runs on an unsigned body.
  verifyWebhookSignature({
    rawBody: getRawBody(req),
    signature: req.headers["x-razorpay-signature"] as string | undefined,
  });

  const body = req.body as { event?: string; payload?: Record<string, unknown> };
  const event = body.event ?? "unknown";

  /**
   * Razorpay's own id for the delivery. Falling back to a body-derived id
   * matters: without an id there is nothing to deduplicate on, and a retry
   * would be processed as a fresh event.
   */
  const headerId = req.headers["x-razorpay-event-id"];
  const entityId =
    (body.payload?.payment as { entity?: { id?: string } } | undefined)?.entity?.id ??
    (body.payload?.refund as { entity?: { id?: string } } | undefined)?.entity?.id;
  const eventId =
    (typeof headerId === "string" && headerId) ||
    (entityId ? `${event}:${entityId}` : undefined);

  if (!eventId) {
    // Answer 200 so it is not retried forever, but say why it was dropped.
    logger.warn({ event }, "webhook had no event id and cannot be deduplicated");
    res.status(200).json({ received: true, ignored: "no event id" });
    return;
  }

  const outcome = await handleWebhook({
    eventId,
    event,
    payload: body.payload ?? {},
  });

  // 200 for processed, duplicate and ignored alike — all three mean "stop
  // retrying, we have it".
  res.status(200).json({ received: true, ...outcome });
});
