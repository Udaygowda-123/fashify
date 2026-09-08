import type { Types } from "mongoose";
import type { Identity } from "../lib/firebase.js";
import { User, type UserDoc } from "../models/index.js";

/**
 * Mirrors a verified Firebase identity into our own users collection.
 *
 * Firebase owns identity; we own everything commercial about a person —
 * addresses, orders, which coupons they have used. Rather than reaching into
 * Firebase on every request, the first verified token creates a local row and
 * later ones refresh it.
 *
 * Upsert rather than find-then-create: two requests arriving together with a
 * brand-new user's first token would both find nothing and both insert, and
 * the unique index on firebaseUid would turn one of them into a 500 on
 * sign-in. `upsert` lets the database settle it.
 */
export async function syncUser(identity: Identity): Promise<UserDoc> {
  const user = await User.findOneAndUpdate(
    { firebaseUid: identity.uid },
    {
      $set: {
        // Only overwrite from the token when the token actually carries it;
        // a provider that omits the display name should not blank ours.
        ...(identity.email ? { email: identity.email } : {}),
        ...(identity.name ? { name: identity.name } : {}),
        // Kept in step with the claim so admin listings can be queried, but
        // authorisation never reads this field.
        role: identity.isAdmin ? "admin" : "customer",
        lastSeenAt: new Date(),
      },
      $setOnInsert: {
        firebaseUid: identity.uid,
        // Required by the schema, so an insert with no email in the token
        // still validates.
        ...(identity.email ? {} : { email: `${identity.uid}@placeholder.invalid` }),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return user;
}

export async function getUserById(id: Types.ObjectId): Promise<UserDoc | null> {
  return User.findById(id);
}
