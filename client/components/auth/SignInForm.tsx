"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useAuth } from "@/lib/firebase/AuthProvider";

/** Firebase's own codes, turned into sentences that say what to do. */
function messageFor(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "That email and password do not match an account here.";
      case "auth/too-many-requests":
        return "Too many attempts. Wait a minute and try again.";
      case "auth/invalid-email":
        return "That does not look like an email address.";
      default:
        return "Could not sign you in. Try again.";
    }
  }
  return "Could not sign you in. Try again.";
}

export function SignInForm() {
  const { signIn, configured } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!configured) {
      setError("Sign-in is not configured on this deployment yet.");
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email, password);
      router.push("/");
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={onSubmit}>
      <Field
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="you@example.in"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Field
        label="Password"
        type="password"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        error={error ?? undefined}
      />
      <div className="flex flex-col gap-4">
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
        <Link
          href="/sign-in"
          className="self-start text-meta text-mist underline decoration-1 underline-offset-4 hover:text-ink"
        >
          I have forgotten my password
        </Link>
      </div>
    </form>
  );
}
