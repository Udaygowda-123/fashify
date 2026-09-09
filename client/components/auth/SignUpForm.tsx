"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useAuth } from "@/lib/firebase/AuthProvider";

function messageFor(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/email-already-in-use":
        return "An account already exists for that email. Sign in instead.";
      case "auth/weak-password":
        return "That password is too easy to guess. Use eight characters or more.";
      case "auth/invalid-email":
        return "That does not look like an email address.";
      default:
        return "Could not create that account. Try again.";
    }
  }
  return "Could not create that account. Try again.";
}

export function SignUpForm() {
  const { signUp, configured } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!configured) {
      setError("Sign-up is not configured on this deployment yet.");
      return;
    }
    if (password.length < 8) {
      setError("Use eight characters or more.");
      return;
    }

    setSubmitting(true);
    try {
      await signUp(email, password, name);
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
        label="Name"
        name="name"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
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
        autoComplete="new-password"
        hint="Eight characters or more."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        error={error ?? undefined}
      />
      <Button type="submit" fullWidth disabled={submitting}>
        {submitting ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-micro text-mist">
        By creating an account you agree to our terms and to how we handle your data.
      </p>
    </form>
  );
}
