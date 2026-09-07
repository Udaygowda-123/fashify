import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { getAuthImage } from "@/lib/mock";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  const image = await getAuthImage();

  return (
    <AuthShell
      image={image}
      panelLine="Your size, your address, and every order you have placed."
      title="Sign in"
      footer={
        <>
          No account yet?{" "}
          <Link
            href="/sign-up"
            className="text-ink underline decoration-1 underline-offset-4 hover:decoration-2"
          >
            Create one
          </Link>
          . It takes a minute and makes returns easier.
        </>
      }
    >
      <form className="flex flex-col gap-6">
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
          autoComplete="current-password"
        />
        <div className="flex flex-col gap-4">
          <Button type="submit" fullWidth>
            Sign in
          </Button>
          <Link
            href="/sign-in"
            className="self-start text-meta text-mist underline decoration-1 underline-offset-4 hover:text-ink"
          >
            I have forgotten my password
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
