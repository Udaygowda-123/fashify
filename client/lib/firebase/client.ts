import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/**
 * Public by design — an API key here names a project, it does not grant
 * access to it. What actually protects the app is Firebase's own request
 * restrictions and the server verifying every ID token before trusting it.
 *
 * `isFirebaseConfigured` lets sign-in/sign-up render a clear, honest message
 * instead of a broken form when these are unset — which they are until a real
 * Firebase project exists. See client/.env.example.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function firebaseAuth(): Auth {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* in .env.local.",
    );
  }
  app ??= getApps()[0] ?? initializeApp(config);
  auth ??= getAuth(app);
  return auth;
}
