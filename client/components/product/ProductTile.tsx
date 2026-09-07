import Image from "next/image";
import Link from "next/link";
import { formatColourCount, formatPrice } from "@/lib/format";
import type { Product } from "@/lib/mock/types";

interface ProductTileProps {
  product: Product;
  /**
   * Wide tiles use the landscape crop of the same garment. Passed by the grid
   * rather than read off the product, so a rail can render a wide piece narrow.
   */
  wide?: boolean;
  /** Only the first row of the first grid on a page should load eagerly. */
  priority?: boolean;
}

const SINGLE_SIZES =
  "(min-width: 80rem) 25vw, (min-width: 48rem) 33vw, 50vw";
const WIDE_SIZES = "(min-width: 80rem) 50vw, (min-width: 48rem) 66vw, 100vw";

export function ProductTile({
  product,
  wide = false,
  priority = false,
}: ProductTileProps) {
  const image = wide && product.wideImage ? product.wideImage : product.images[0];
  // Only pieces photographed more than once have something to cross-fade to.
  const second = wide ? undefined : product.images[1];

  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group block focus-visible:outline-offset-4"
    >
      {/* The photograph is the tile: no radius, no border, no shadow. */}
      <div className="relative overflow-hidden bg-stone-deep">
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes={wide ? WIDE_SIZES : SINGLE_SIZES}
          priority={priority}
          className="h-auto w-full"
        />
        {second ? (
          <Image
            src={second.src}
            alt=""
            aria-hidden
            width={second.width}
            height={second.height}
            sizes={SINGLE_SIZES}
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 ease-out-quiet group-hover:opacity-100 motion-reduce:transition-none"
          />
        ) : null}
      </div>

      <div className="mt-3 flex flex-col gap-0.5">
        <h3 className="text-meta text-ink">{product.name}</h3>
        <p className="text-meta text-ink" data-numeric>
          {formatPrice(product.price)}
        </p>
        <p className="text-micro text-mist">
          {formatColourCount(product.colours.length)}
        </p>
      </div>
    </Link>
  );
}
