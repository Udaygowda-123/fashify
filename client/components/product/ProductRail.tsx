import type { Product } from "@/lib/mock/types";
import { ProductTile } from "./ProductTile";

/** A horizontal rail of tiles, reusing the same tile the grid uses. */
export function ProductRail({
  title,
  products,
}: {
  title: string;
  products: Product[];
}) {
  if (products.length === 0) return null;

  return (
    <section className="mt-section">
      <div className="mx-auto max-w-[1600px] pad-x">
        <h2 className="font-display text-d2">{title}</h2>
      </div>
      <div className="mt-8 overflow-x-auto overscroll-x-contain scroll-px-gutter snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] md:mt-10 [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-3 pad-x md:gap-5">
          {products.map((product) => (
            <li
              key={product.id}
              className="w-[64%] shrink-0 snap-start sm:w-[44%] md:w-[30%] xl:w-[23%]"
            >
              <ProductTile product={product} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
