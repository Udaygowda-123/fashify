import { Schema, model, type InferSchemaType, type Model, type Types } from "mongoose";

/**
 * The record of every webhook we have accepted, and the mechanism that makes
 * duplicate delivery harmless.
 *
 * Razorpay retries on any non-2xx response, and delivers twice on its own often
 * enough that it has to be assumed. Without a guard, a replayed
 * `payment.captured` would run the fulfilment path a second time: `onHand`
 * decremented twice for one sale, a second confirmation email, and — if a
 * refund event replayed — money returned twice.
 *
 * The guard is the unique index on `eventId`, not an `if` statement. Checking
 * "have I seen this?" and then processing is two operations with a gap between
 * them, and two concurrent deliveries of the same event both pass the check
 * before either writes. Inserting first makes the database arbitrate: exactly
 * one insert wins, the loser gets a duplicate-key error, and the loser stops.
 *
 * `processedAt` stays null until the state change has actually been applied,
 * so an event that arrived but crashed mid-processing is visible and can be
 * replayed deliberately.
 */
const webhookEventSchema = new Schema(
  {
    gateway: { type: String, required: true, default: "razorpay" },

    /**
     * The gateway's own id for the delivery. Razorpay sends it as the
     * `x-razorpay-event-id` header.
     */
    eventId: { type: String, required: true, trim: true },

    /** e.g. "payment.captured". */
    event: { type: String, required: true, trim: true },

    receivedAt: { type: Date, required: true, default: () => new Date() },

    /** Null until the handler has finished applying it. */
    processedAt: { type: Date, default: null },

    /** Set when processing threw, so a failure is not mistaken for a duplicate. */
    error: { type: String, default: null },

    payload: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: false, collection: "webhookevents" },
);

/**
 * THE idempotency guard. Unique across gateway and event id — two gateways
 * could theoretically issue the same id, and scoping avoids a false duplicate.
 */
webhookEventSchema.index({ gateway: 1, eventId: 1 }, { unique: true, name: "webhook_event_id" });

/** Finding events that arrived but never completed. */
webhookEventSchema.index({ processedAt: 1, receivedAt: -1 });

export type WebhookEventDoc = InferSchemaType<typeof webhookEventSchema> & {
  _id: Types.ObjectId;
};

export const WebhookEvent: Model<WebhookEventDoc> =
  model<WebhookEventDoc>("WebhookEvent", webhookEventSchema);
