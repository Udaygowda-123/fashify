"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/format";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/products/new", label: "Add product" },
  { href: "/admin/orders", label: "Orders" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections">
      {/* A rail on a desktop, a scrolling tab bar on a phone. */}
      <ul className="flex gap-1 overflow-x-auto md:flex-col md:gap-0 md:overflow-visible">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <li key={link.href} className="shrink-0 md:shrink">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-10 items-center px-3 text-[0.8125rem] transition-colors duration-150 motion-reduce:transition-none md:min-h-9 md:border-l-2",
                  active
                    ? "bg-tool-sunk text-tool-ink md:border-tool-ink"
                    : "text-tool-mist hover:text-tool-ink md:border-transparent",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
