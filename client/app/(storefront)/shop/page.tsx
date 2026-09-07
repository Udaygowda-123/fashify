import type { Metadata } from "next";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ShopControls } from "@/components/shop/ShopControls";
import {
  getEmptyRailImage,
  getFilterGroups,
  getLookbook,
  getProducts,
  getSortOptions,
} from "@/lib/mock";

export const metadata: Metadata = {
  title: "All pieces",
  description:
    "Every piece in the collection — overshirts, trousers, knitwear and tees.",
};

export default async function ShopPage() {
  const [products, groups, sortOptions, lookbook, emptyImage] =
    await Promise.all([
      getProducts(),
      getFilterGroups(),
      getSortOptions(),
      getLookbook(),
      getEmptyRailImage(),
    ]);

  return (
    <div className="mx-auto max-w-[1600px] pad-x pb-section">
      <header className="pt-8 md:pt-14">
        <h1 className="font-display text-d2">Everything</h1>
        <p className="mt-4 max-w-[52ch] text-b2 text-mist">
          The whole collection, in one place. Sixteen pieces cut from six
          cloths, made to be worn together.
        </p>
      </header>

      <div className="mt-8 md:mt-14">
        <ShopControls
          groups={groups}
          sortOptions={sortOptions}
          resultCount={products.length}
        >
          <ProductGrid
            products={products}
            lookbook={lookbook}
            interruptEvery={7}
            priorityCount={2}
            emptyImage={emptyImage}
          />
        </ShopControls>
      </div>
    </div>
  );
}
