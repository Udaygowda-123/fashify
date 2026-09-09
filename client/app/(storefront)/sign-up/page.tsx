import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignUpForm } from "@/components/auth/SignUpForm";
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
      <SignUpForm />
    </AuthShell>
  );
}
