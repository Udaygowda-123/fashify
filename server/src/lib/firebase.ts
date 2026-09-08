import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { env, features } from "../config/env.js";
import { FeatureUnavailableError, UnauthenticatedError } from "./errors.js";
import { logger } from "./logger.js";

/**
 * What the server is willing to believe about a caller. Deliberately small:
 * only what a verified Firebase ID token actually proves.
 */
export interface Identity {
  uid: string;
  email?: string;
  name?: string;
  /**
   * From the token's custom claims, set server-side with
   * `setCustomUserClaims`. It is the ONLY source of adminness the middleware
   * will read — see the note in middleware/auth.ts.
   */
  isAdmin: boolean;
}

export type TokenVerifier = (idToken: string) => Promise<Identity>;

let app: App | null = null;

function firebaseApp(): App {
  if (app) return app;
  if (!features.auth) {
    throw new FeatureUnavailableError(
      "Sign-in",
      "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY",
    );
  }
  const existing = getApps()[0];
  app =
    existing ??
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY,
      }),
    });
  logger.info("firebase admin initialised");
  return app;
}

/**
 * The real verifier. `checkRevoked` costs a lookup but means a signed-out or
 * disabled account stops working immediately rather than when its token
 * happens to expire.
 */
const firebaseVerifier: TokenVerifier = async (idToken) => {
  const decoded = await getAuth(firebaseApp())
    .verifyIdToken(idToken, true)
    .catch((error: unknown) => {
      logger.debug({ err: error }, "id token rejected");
      throw new UnauthenticatedError("That sign-in has expired. Sign in again.");
    });

  return {
    uid: decoded.uid,
    email: decoded.email,
    name: decoded.name as string | undefined,
    // Both shapes are accepted so either convention works when the claim is
    // set: { role: "admin" } or { admin: true }.
    isAdmin: decoded.role === "admin" || decoded.admin === true,
  };
};

/**
 * Overridable so the suite can run without Firebase credentials.
 *
 * This is an injected dependency rather than an environment-gated bypass on
 * purpose. A `if (NODE_ENV === "test") trust this header` branch is one
 * misconfigured deploy away from letting anyone claim any uid, including an
 * admin one. A function that only a test file can reach cannot be reached by a
 * request at all.
 */
let override: TokenVerifier | null = null;

export function setTokenVerifier(verifier: TokenVerifier | null): void {
  override = verifier;
}

export function verifyIdToken(idToken: string): Promise<Identity> {
  return (override ?? firebaseVerifier)(idToken);
}

export function isAuthConfigured(): boolean {
  return features.auth || override !== null;
}

/** Used by the grant-admin script to set the claim the middleware reads. */
export async function setAdminClaim(uid: string, isAdmin: boolean): Promise<void> {
  await getAuth(firebaseApp()).setCustomUserClaims(uid, isAdmin ? { role: "admin" } : {});
}

export async function findUidByEmail(email: string): Promise<string | null> {
  const user = await getAuth(firebaseApp())
    .getUserByEmail(email)
    .catch(() => null);
  return user?.uid ?? null;
}
