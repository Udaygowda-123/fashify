import Link from "next/link";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminNav } from "@/components/admin/AdminNav";

/**
 * A different world from the storefront on purpose: white ground, hairline
 * rules, Archivo throughout at 13px, and no Bodoni except the wordmark. It
 * should read as a tool someone works in all day, not as the shop.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AdminGuard>
      <div className="flex min-h-svh flex-col bg-tool-bg text-[0.8125rem] leading-normal text-tool-ink md:flex-row">
        <header className="shrink-0 border-b border-tool-rule md:w-56 md:border-r md:border-b-0">
          <div className="flex items-center justify-between gap-4 px-4 py-3 md:block md:px-3 md:py-5">
            <div className="flex items-baseline gap-2">
              <Link href="/admin" className="font-display text-base">
                Fashify
              </Link>
              <span className="text-[0.6875rem] text-tool-mist">Admin</span>
            </div>
            <Link
              href="/"
              className="text-[0.75rem] text-tool-mist underline decoration-1 underline-offset-4 hover:text-tool-ink md:mt-2 md:block"
            >
              View the shop
            </Link>
          </div>
          <div className="border-t border-tool-rule px-1 py-1 md:mt-4 md:border-0 md:px-0">
            <AdminNav />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </AdminGuard>
  );
}
