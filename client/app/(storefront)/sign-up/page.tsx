import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { getAuthImage } from "@/lib/mock";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage() {
  const image = await getAuthImage();

  return (
    <AuthShell
      image={image}
      panelLine="Keep your size on file and send anything back for thirty days."
      title="Create an account"
      intro="One address, one size, and returns you can start yourself."
      footer={
        <>
          Already have one?{" "}
          <Link
            href="/sign-in"
            className="text-ink underline decoration-1 underline-offset-4 hover:decoration-2"
          >
            Sign in
          </Link>
          .
        </>
      }
    >
      <form className="flex flex-col gap-6">
        <Field label="Name" name="name" autoComplete="name" />
        <Field
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.in"
        />
        <Field
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          hint="Eight characters or more."
        />
        <Button type="submit" fullWidth>
          Create account
        </Button>
        <p className="text-micro text-mist">
          By creating an account you agree to our terms and to how we handle
          your data.
        </p>
      </form>
    </AuthShell>
  );
}
