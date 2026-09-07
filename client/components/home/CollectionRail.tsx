import Image from "next/image";
import Link from "next/link";
import { formatPieceCount } from "@/lib/format";
import type { Collection } from "@/lib/mock/types";

/**
 * The rail runs off the right edge of the page rather than stopping at the
 * container, which is how you say "this scrolls" without an arrow or a dot.
 */
export function CollectionRail({
  collections,
}: {
  collections: Collection[];
}) {
  return (
    <section className="mt-section">
      <div className="mx-auto max-w-[1600px] pad-x">
        <h2 className="font-display text-d2">Where to start</h2>
      </div>

      <div className="mt-8 overflow-x-auto overscroll-x-contain scroll-px-gutter snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] md:mt-10 [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-3 pad-x md:gap-5">
          {collections.map((collection) => (
            <li
              key={collection.id}
              className="w-[76%] shrink-0 snap-start sm:w-[52%] md:w-[38%] xl:w-[27%]"
            >
              <Link href="/shop" className="group block">
                <div className="bg-stone-deep">
                  <Image
                    src={collection.image.src}
                    alt={collection.image.alt}
                    width={collection.image.width}
                    height={collection.image.height}
                    sizes="(min-width: 80rem) 27vw, (min-width: 48rem) 38vw, 76vw"
                    className="h-auto w-full"
                  />
                </div>
                <div className="mt-4">
                  <h3 className="font-display text-d4">{collection.title}</h3>
                  <p className="mt-2 max-w-[34ch] text-meta text-mist">
                    {collection.blurb}
                  </p>
                  <p className="mt-2 text-micro text-mist" data-numeric>
                    {formatPieceCount(collection.pieceCount)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
