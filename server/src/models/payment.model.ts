import { Schema, model, type InferSchemaType, type Model, type Types } from "mongoose";
import { PAYMENT_STATUSES } from "./types.js";

const paymentSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },

    gateway: { type: String, required: true, default: "razorpay" },

    /** Razorpay's order id, `order_...`. What the client hands the checkout. */
    gatewayOrderId: { type: String, required: true, trim: true },

    /** Razorpay's payment id, `pay_...`. Arrives with the webhook. */
    gatewayPaymentId: { type: String, default: null, trim: true },

    /** In paise, matching what was sent to the gateway. */
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, default: "INR" },

    status: { type: String, enum: PAYMENT_STATUSES, required: true, default: "created" },

    /** "upi", "card", "netbanking" — whatever the gateway reports. */
    method: { type: String, default: null },

    amountRefunded: { type: Number, required: true, default: 0, min: 0 },

    /**
     * Every webhook payload we accepted for this payment, appended in order.
     *
     * Kept raw and untouched because when a payment is disputed the question is
     * "what exactly did the gateway tell us, and when" — a summary we derived
     * cannot answer that. It is also how a mis-parsed event can be replayed
     * after the parsing bug is fixed.
     */
    events: {
      type: [
        new Schema(
          {
            eventId: { type: String, required: true },
            event: { type: String, required: true },
            receivedAt: { type: Date, required: true, default: () => new Date() },
            payload: { type: Schema.Types.Mixed, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true, collection: "payments" },
);

paymentSchema.index({ orderId: 1 });

/** The webhook arrives knowing only the gateway's ids, so both are indexed. */
paymentSchema.index({ gatewayOrderId: 1 }, { unique: true });
paymentSchema.index(
  { gatewayPaymentId: 1 },
  { unique: true, partialFilterExpression: { gatewayPaymentId: { $type: "string" } } },
);

export type PaymentDoc = InferSchemaType<typeof paymentSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Payment: Model<PaymentDoc> = model<PaymentDoc>("Payment", paymentSchema);
