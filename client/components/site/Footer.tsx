import Link from "next/link";
import { NewsletterField } from "./NewsletterField";

const COLUMNS = [
  {
    heading: "Shop",
    links: [
      { label: "Overshirts", href: "/shop" },
      { label: "Trousers", href: "/shop" },
      { label: "Knitwear", href: "/shop" },
      { label: "Tees", href: "/shop" },
      { label: "Everything", href: "/shop" },
    ],
  },
  {
    heading: "Help",
    links: [
      { label: "Delivery", href: "/shop" },
      { label: "Returns", href: "/shop" },
      { label: "Size guide", href: "/shop" },
      { label: "Contact us", href: "/shop" },
    ],
  },
  {
    heading: "The label",
    links: [
      { label: "Our fabrics", href: "/" },
      { label: "Where things are made", href: "/" },
      { label: "Stores", href: "/" },
      { label: "Admin", href: "/admin" },
    ],
  },
];

export function Footer() {
  return (
    // No top margin: pages set their own trailing space, and the home page
    // ends on the bottle-green editorial block so the green runs straight in.
    <footer className="bg-bottle text-stone">
      <div className="mx-auto max-w-[1600px] pad-x py-16 md:py-20">
        <div className="flex flex-col gap-14 lg:flex-row lg:justify-between lg:gap-20">
          <div className="max-w-sm">
            <p className="font-display text-d3">Fashify</p>
            <p className="mt-4 text-b2 text-mist-light">
              Considered everyday pieces in cotton, linen and merino. Cut in
              Bengaluru, sold across India.
            </p>

            <NewsletterField />
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:gap-16">
            {COLUMNS.map((column) => (
              <nav key={column.heading} aria-label={column.heading}>
                <h2 className="text-meta text-mist-light">{column.heading}</h2>
                <ul className="mt-4 flex flex-col gap-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-b2 hover:underline hover:decoration-1 hover:underline-offset-4"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-mist-light/25 pt-8 text-micro text-mist-light sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Fashify Clothing Private Limited</p>
          <ul className="flex flex-wrap gap-6">
            <li>
              <Link href="/" className="hover:underline hover:underline-offset-4">
                Terms
              </Link>
            </li>
            <li>
              <Link href="/" className="hover:underline hover:underline-offset-4">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/" className="hover:underline hover:underline-offset-4">
                Prices include GST
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
