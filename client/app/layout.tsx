import type { Metadata } from "next";
import { Archivo, Bodoni_Moda } from "next/font/google";
import { AuthProvider } from "@/lib/firebase/AuthProvider";
import "./globals.css";

/**
 * Only the document shell lives here. The storefront chrome is in
 * (storefront)/layout.tsx and the admin has its own, because the admin is a
 * tool and should not wear the shop's header.
 */
const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  // The optical size axis is the reason to pick a Didone over a generic
  // serif: it is drawn differently at 96pt than at 14pt.
  axes: ["opsz"],
  variable: "--font-bodoni",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Fashify — considered everyday pieces",
    template: "%s — Fashify",
  },
  description:
    "A unisex label cut in Bengaluru. Overshirts, wide-leg trousers, knitwear and heavy tees in cotton, linen and merino.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      className={`${bodoni.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Shared by the storefront and the admin, since both need to know
            who is signed in and — for the admin — whether they hold the
            admin claim. */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
