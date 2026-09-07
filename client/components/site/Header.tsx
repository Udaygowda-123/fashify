"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useBag } from "@/components/bag/BagProvider";
import { Drawer } from "@/components/ui/Drawer";
import { cx } from "@/lib/format";

const NAV = [
  { href: "/shop", label: "Overshirts" },
  { href: "/shop", label: "Trousers" },
  { href: "/shop", label: "Knitwear" },
  { href: "/shop", label: "Tees" },
];

export function Header() {
  const pathname = usePathname();
  const { itemCount, openBag } = useBag();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Only the home page has a photograph behind the header to sit over.
  const overlay = pathname === "/";

  useEffect(() => {
    if (!overlay) return;
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overlay]);

  const light = overlay && !scrolled;

  return (
    <>
      <header
        className={cx(
          "sticky top-0 z-40 transition-colors duration-300 ease-out-quiet motion-reduce:transition-none",
          light ? "bg-transparent text-stone" : "bg-stone text-ink",
        )}
      >
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-6 pad-x md:h-20">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="-ml-2 flex h-11 w-11 items-center justify-center md:hidden"
          >
            <span className="sr-only">Open menu</span>
            <svg
              viewBox="0 0 18 12"
              aria-hidden
              className="w-4.5"
              fill="currentColor"
            >
              <rect width="18" height="1.2" />
              <rect width="18" height="1.2" y="5.4" />
              <rect width="18" height="1.2" y="10.8" />
            </svg>
          </button>

          <Link
            href="/"
            className="font-display text-[1.375rem] leading-none tracking-[-0.01em] md:text-[1.5rem]"
          >
            Fashify
          </Link>

          <nav aria-label="Collections" className="hidden md:block md:flex-1">
            <ul className="flex items-center gap-7">
              {NAV.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-meta hover:underline hover:decoration-1 hover:underline-offset-4"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1 md:gap-5">
            <Link
              href="/sign-in"
              className="hidden text-meta hover:underline hover:decoration-1 hover:underline-offset-4 md:block"
            >
              Sign in
            </Link>
            <button
              type="button"
              onClick={openBag}
              className="-mr-2 flex h-11 min-w-11 items-center justify-center gap-1.5 px-2 text-meta md:mr-0"
            >
              <span>Bag</span>
              {itemCount > 0 ? (
                <>
                  {/* Brass appears as a mark, never as text — it is 3.0:1 on
                      stone, which passes for an indicator and fails for a
                      numeral. So the dot is brass and the count is not. */}
                  <span
                    aria-hidden
                    className="h-1 w-1 shrink-0 bg-brass"
                  />
                  <span className="text-meta" data-numeric aria-hidden>
                    {itemCount}
                  </span>
                </>
              ) : null}
              <span className="sr-only">
                {itemCount === 0
                  ? ", empty"
                  : `, ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
              </span>
            </button>
          </div>
        </div>
      </header>

      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        side="right"
        title="Menu"
      >
        <nav aria-label="Collections">
          <ul className="flex flex-col">
            {NAV.map((item) => (
              <li key={item.label} className="border-b border-rule">
                <Link
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-14 items-center font-display text-d4"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="border-b border-rule">
              <Link
                href="/shop"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-14 items-center font-display text-d4"
              >
                Everything
              </Link>
            </li>
          </ul>
        </nav>
        <div className="mt-8 flex flex-col gap-4">
          <Link
            href="/sign-in"
            onClick={() => setMenuOpen(false)}
            className="text-meta underline decoration-1 underline-offset-4"
          >
            Sign in
          </Link>
          <Link
            href="/admin"
            onClick={() => setMenuOpen(false)}
            className="text-meta text-mist underline decoration-1 underline-offset-4"
          >
            Admin
          </Link>
        </div>
      </Drawer>
    </>
  );
}
