import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignInForm } from "@/components/auth/SignInForm";
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
      <SignInForm />
    </AuthShell>
  );
}
