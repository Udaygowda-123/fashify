import { Schema, model, type InferSchemaType, type Model, type Types } from "mongoose";
import { USER_ROLES } from "./types.js";

const addressSchema = new Schema({
  label: { type: String, trim: true, default: null },
  fullName: { type: String, required: true, trim: true, maxlength: 200 },
  phone: { type: String, required: true, trim: true },
  line1: { type: String, required: true, trim: true, maxlength: 300 },
  line2: { type: String, trim: true, default: null },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  pincode: {
    type: String,
    required: true,
    match: [/^[1-9][0-9]{5}$/, "an Indian PIN code is six digits and cannot start with 0"],
  },
  country: { type: String, required: true, default: "IN" },
});

const userSchema = new Schema(
  {
    /** The subject of the Firebase ID token. The only identity we trust. */
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    name: { type: String, trim: true, default: null },
    phone: { type: String, trim: true, default: null },

    /**
     * Mirrors the Firebase custom claim so admin listings can be queried, but
     * it is NOT what authorisation checks read. RBAC reads the claim off the
     * verified token — a role in the database could be edited by any write
     * path that reaches this document, and a role in a request body is simply
     * whatever the caller typed.
     */
    role: { type: String, enum: USER_ROLES, required: true, default: "customer" },

    addresses: { type: [addressSchema], default: [] },

    defaultAddressId: { type: Schema.Types.ObjectId, default: null },

    lastSeenAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true, collection: "users" },
);

/**
 * Not unique. Firebase allows the same address across providers, and two rows
 * with one email is a recoverable annoyance where a hard failure at sign-in is
 * not.
 */
userSchema.index({ email: 1 });

export type UserDoc = InferSchemaType<typeof userSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const User: Model<UserDoc> = model<UserDoc>("User", userSchema);
