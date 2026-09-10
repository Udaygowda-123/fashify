import Link from "next/link";
import { CollectionRail } from "@/components/home/CollectionRail";
import { EditorialBlock } from "@/components/home/EditorialBlock";
import { Hero } from "@/components/home/Hero";
import { ProductGrid } from "@/components/product/ProductGrid";
import {
  getCollections,
  getEditorialImage,
  getHeroImage,
  getLookbook,
  getNewArrivals,
} from "@/lib/mock";

/**
 * A network call to the API is the one thing on this page that can fail for
 * reasons that have nothing to do with the code — a database blip, a cold
 * start, a moment of bad DNS. `getHeroImage`/`getLookbook`/`getEditorialImage`
 * never throw (they return local constants), but `getCollections` and
 * `getNewArrivals` do real fetches, and the storefront's front door should
 * not go completely dark because one of several sections on it had a bad
 * moment — it should show what it can and quietly drop what it can't, rather
 * than 500 the whole page over, say, the collection rail.
 */
async function orEmpty<T>(promise: Promise<T[]>): Promise<T[]> {
  try {
    return await promise;
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [heroImage, collections, products, lookbook, editorialImage] =
    await Promise.all([
      getHeroImage(),
      orEmpty(getCollections()),
      orEmpty(getNewArrivals(11)),
      getLookbook(),
      getEditorialImage(),
    ]);

  return (
    <>
      <Hero image={heroImage} />

      {collections.length > 0 ? <CollectionRail collections={collections} /> : null}

      {/*
        `ProductGrid`'s own empty state is written for the shop page — "no
        matches, try removing a filter" — which would be a non-sequitur here,
        since the home page has no filters to remove. An empty `products`
        array on this page only ever means the fetch had a bad moment, so the
        whole section is skipped rather than shown with the wrong copy.
      */}
      {products.length > 0 ? (
        <section className="mt-section">
          <div className="mx-auto max-w-[1600px] pad-x">
            <div className="flex items-end justify-between gap-6">
              <h2 className="font-display text-d2">New in</h2>
              <Link
                href="/shop"
                className="mb-1 shrink-0 text-meta underline decoration-1 underline-offset-4 hover:decoration-2"
              >
                See everything
              </Link>
            </div>

            <ProductGrid
              products={products}
              lookbook={lookbook}
              bleed
              className="mt-10 md:mt-14"
            />
          </div>
        </section>
      ) : null}

      <EditorialBlock image={editorialImage} />
    </>
  );
}
