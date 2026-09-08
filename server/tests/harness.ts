import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/app.js";
import { setTokenVerifier, type Identity } from "../src/lib/firebase.js";
import { User } from "../src/models/index.js";

/**
 * An app instance with a stubbed token verifier.
 *
 * The stub is injected through the same seam production uses, so the auth
 * middleware, user sync and RBAC are all the real code — only the Firebase
 * network call is replaced. Tokens in tests are of the form
 * `test|<uid>|<admin?>`, which no real Firebase token can look like.
 */
export function createTestApp(): Express {
  setTokenVerifier(async (token) => {
    const [prefix, uid, admin] = token.split("|");
    if (prefix !== "test" || !uid) {
      throw new Error("bad test token");
    }
    const identity: Identity = {
      uid,
      email: `${uid}@example.in`,
      name: uid,
      isAdmin: admin === "admin",
    };
    return identity;
  });

  return createApp();
}

export function bearer(uid: string, admin = false): string {
  return `Bearer test|${uid}${admin ? "|admin" : ""}`;
}

/** Signs a user in once so their local row exists, and returns its id. */
export async function signIn(app: Express, uid: string, admin = false) {
  await request(app).get("/api/v1/cart").set("Authorization", bearer(uid, admin));
  const user = await User.findOne({ firebaseUid: uid });
  return user!;
}

export { request };
