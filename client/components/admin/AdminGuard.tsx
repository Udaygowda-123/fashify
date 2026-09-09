"use client";

import Link from "next/link";
import { useAuth } from "@/lib/firebase/AuthProvider";

/**
 * Gates the whole admin surface on the signed-in user's Firebase custom
 * claim — the same claim server/src/middleware/auth.ts's requireAdmin reads.
 * There is deliberately no other way in: no role stored in this app, no query
 * parameter, nothing the browser could be talked into trusting on its own.
 *
 * Client-side because that is where the ID token lives; every actual admin
 * request still goes to the server with that token attached, and the server
 * checks it again independently. This gate is about not showing the tool to
 * someone it will refuse anyway, not about being the security boundary.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin, configured } = useAuth();

  if (!configured) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-tool-bg px-6 text-center">
        <div className="max-w-sm">
          <p className="text-[0.9375rem]">Sign-in is not configured</p>
          <p className="mt-2 text-[0.8125rem] text-tool-mist">
            Set NEXT_PUBLIC_FIREBASE_* in client/.env.local to enable the
            admin sign-in.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-tool-bg">
        <p className="text-[0.8125rem] text-tool-mist">Checking your account…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-tool-bg px-6 text-center">
        <div className="max-w-sm">
          <p className="text-[0.9375rem]">Sign in to continue</p>
          <p className="mt-2 text-[0.8125rem] text-tool-mist">
            This area is for staff accounts.
          </p>
          <Link
            href="/sign-in"
            className="mt-5 inline-flex min-h-9 items-center border border-tool-ink px-4 text-[0.8125rem] hover:bg-tool-sunk"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-tool-bg px-6 text-center">
        <div className="max-w-sm">
          <p className="text-[0.9375rem]">That area is for staff accounts</p>
          <p className="mt-2 text-[0.8125rem] text-tool-mist">
            {user.email} is signed in, but does not hold the admin claim. Grant
            it with <code className="font-mono">npm run grant-admin</code> on
            the server, then sign out and in again.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex min-h-9 items-center border border-tool-ink px-4 text-[0.8125rem] hover:bg-tool-sunk"
          >
            Back to the shop
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
