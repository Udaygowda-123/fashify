import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Accordion } from "@/components/product/Accordion";
import { Gallery } from "@/components/product/Gallery";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { ProductRail } from "@/components/product/ProductRail";
import { formatPrice } from "@/lib/format";
import { getProduct, getProducts, getRelatedProducts } from "@/lib/mock";

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata(
  props: PageProps<"/shop/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProduct(slug);
  if (!product) return { title: "Piece not found" };
  return { title: product.name, description: product.summary };
}

export default async function ProductPage(props: PageProps<"/shop/[slug]">) {
  const { slug } = await props.params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(slug);

  return (
    <>
      <div className="mx-auto max-w-[1600px] md:pad-x">
        <nav aria-label="Breadcrumb" className="pad-x pt-6 md:px-0 md:pt-10">
          <Link
            href="/shop"
            className="text-meta text-mist underline decoration-1 underline-offset-4 hover:text-ink"
          >
            All pieces
          </Link>
        </nav>

        <div className="mt-6 md:mt-10 md:grid md:grid-cols-12 md:gap-x-10 xl:gap-x-16">
          <div className="md:col-span-7">
            <Gallery images={product.images} />
          </div>

          {/* Sticky beside a column of photographs that is taller than it. */}
          <div className="md:col-span-5 md:sticky md:top-28 md:col-start-8 md:self-start">
            <div className="pad-x pt-8 md:px-0 md:pt-0">
              <h1 className="font-display text-d3">{product.name}</h1>
              <p className="mt-2 text-b1" data-numeric>
                {formatPrice(product.price)}
              </p>
              <p className="mt-5 max-w-[46ch] text-b2 text-mist">
                {product.summary}
              </p>

              <div className="mt-9">
                <ProductPurchase product={product} />
              </div>

              <div className="mt-10">
                <Accordion
                  items={[
                    {
                      id: "composition",
                      title: "Composition and care",
                      body: product.composition,
                    },
                    { id: "fit", title: "Fit", body: product.fitNotes },
                    {
                      id: "delivery",
                      title: "Delivery and returns",
                      body: product.delivery,
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProductRail title="Goes with this" products={related} />

      {/* On a phone this is clearance for the fixed buy bar, which sits over
          the bottom of the page; on a desktop there is no bar and it is just
          the section rhythm before the footer. */}
      <div className="h-24 md:h-section" />
    </>
  );
}
