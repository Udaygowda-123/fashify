/**
 * Sets or removes the Firebase custom claim that the RBAC middleware reads.
 *
 *   npm run grant-admin -- someone@example.in
 *   npm run grant-admin -- someone@example.in --revoke
 *
 * This is the ONLY way an account becomes an admin. There is no database flag
 * that does it — see the comment on requireAdmin in middleware/auth.ts for
 * why: a role column any code path can write to is a role any bug can grant.
 * The claim can only be set with the Firebase service account credentials
 * this script runs with, and it is signed into the token, so nothing short of
 * that can forge it.
 *
 * Requires FIREBASE_* to be configured — there is no local fallback, because
 * granting admin is exactly the operation that must not have one.
 */
import { logger } from "../lib/logger.js";
import { findUidByEmail, setAdminClaim } from "../lib/firebase.js";

async function main(): Promise<void> {
  const email = process.argv[2];
  const revoke = process.argv.includes("--revoke");

  if (!email || email.startsWith("--")) {
    console.error("Usage: npm run grant-admin -- <email> [--revoke]");
    process.exit(1);
  }

  const uid = await findUidByEmail(email);
  if (!uid) {
    logger.error({ email }, "no Firebase account with that email");
    process.exit(1);
  }

  await setAdminClaim(uid, !revoke);
  logger.info({ email, uid, admin: !revoke }, revoke ? "admin claim revoked" : "admin claim granted");
  logger.info("the account must sign out and in again for the new token to carry the claim");
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, "could not update the admin claim");
  process.exit(1);
});
