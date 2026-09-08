import type { RequestHandler } from "express";
import type { Types } from "mongoose";
import { ForbiddenError, UnauthenticatedError } from "../lib/errors.js";
import { verifyIdToken, type Identity } from "../lib/firebase.js";
import { syncUser } from "../services/user.service.js";

export interface RequestAuth {
  identity: Identity;
  userId: Types.ObjectId;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: RequestAuth;
    }
  }
}

function bearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return null;
  return token.trim() || null;
}

/**
 * Verifies a token if one is present and attaches the identity, but never
 * rejects. Used on routes that work for guests and are merely nicer when
 * signed in — the catalog, and the cart.
 */
export const attachIdentity: RequestHandler = async (req, _res, next) => {
  const token = bearer(req.headers.authorization);
  if (!token) {
    next();
    return;
  }
  try {
    const identity = await verifyIdToken(token);
    const user = await syncUser(identity);
    req.auth = { identity, userId: user._id };
  } catch {
    // A bad token on an optional-auth route means "treat them as a guest",
    // not "fail the request". Signing out mid-session should not 401 the shop.
  }
  next();
};

/** Anything that reads or writes a person's own data. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = bearer(req.headers.authorization);
  if (!token) {
    next(new UnauthenticatedError());
    return;
  }
  // Errors here are meant to surface: on a protected route a bad token is a
  // 401, not a silent downgrade to guest.
  const identity = await verifyIdToken(token);
  const user = await syncUser(identity);
  req.auth = { identity, userId: user._id };
  next();
};

/**
 * Adminness comes from the verified token's custom claim, and from nowhere
 * else.
 *
 * Not from the request body, obviously. But also not from `user.role` in our
 * own database, even though it is right there and kept in step: that column is
 * writable by any code path that touches a user document, and a bug or an
 * injection that flipped it would silently hand out the admin surface. The
 * claim can only be changed with the Firebase service account, and it is
 * signed, so a caller cannot forge it and a stray write cannot grant it.
 */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.auth) {
    next(new UnauthenticatedError());
    return;
  }
  if (!req.auth.identity.isAdmin) {
    next(new ForbiddenError("That area is for staff accounts."));
    return;
  }
  next();
};
