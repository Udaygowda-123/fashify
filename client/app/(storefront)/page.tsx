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

export default async function HomePage() {
  const [heroImage, collections, products, lookbook, editorialImage] =
    await Promise.all([
      getHeroImage(),
      getCollections(),
      getNewArrivals(11),
      getLookbook(),
      getEditorialImage(),
    ]);

  return (
    <>
      <Hero image={heroImage} />

      <CollectionRail collections={collections} />

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
            className="mt-10 md:mt-14"
          />
        </div>
      </section>

      <EditorialBlock image={editorialImage} />
    </>
  );
}
