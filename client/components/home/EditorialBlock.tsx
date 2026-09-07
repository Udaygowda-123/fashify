import Image from "next/image";
import type { ImageAsset } from "@/lib/mock/types";

/**
 * Asymmetric on purpose: the photograph takes five columns from the left edge
 * and the text sits in six, dropped down so the two do not share a baseline.
 */
export function EditorialBlock({ image }: { image: ImageAsset }) {
  return (
    <section className="mt-section bg-bottle text-stone">
      <div className="mx-auto grid max-w-[1600px] items-start gap-10 pad-x py-16 md:grid-cols-12 md:gap-x-12 md:py-24 lg:py-32">
        <div className="bg-bottle-deep md:col-span-5">
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            sizes="(min-width: 48rem) 42vw, 100vw"
            className="h-auto w-full"
          />
        </div>

        <div className="md:col-span-6 md:col-start-7 md:pt-20 lg:pt-28">
          <h2 className="max-w-[22ch] font-display text-d2">
            Cotton twill, washed twice
          </h2>
          <div className="mt-6 flex max-w-[46ch] flex-col gap-5 text-b1 text-mist-light">
            <p>
              The twill for the overshirts is woven in Erode, at 320 grams, on
              looms that have been running the same construction for thirty
              years. We buy it undyed and wash it twice before anything is cut.
            </p>
            <p>
              That second wash is the reason the shoulder sits the way it does.
              It takes the tension out of the cloth, so the piece you get has
              already done most of its moving. It will soften for about six
              wears, and then it stops changing.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
