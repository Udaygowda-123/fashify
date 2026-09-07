import Image from "next/image";
import Link from "next/link";
import type { ImageAsset } from "@/lib/mock/types";

/**
 * The one place the site raises its voice, and it does it with scale contrast
 * rather than size: a photograph at nearly full viewport height, with the type
 * kept small and low in the left corner.
 *
 * This is also the only orchestrated motion in the site — the frame settles,
 * the scrim comes up, the two display lines rise into place, then the tail.
 * All of it is cancelled by prefers-reduced-motion.
 */
export function Hero({ image }: { image: ImageAsset }) {
  return (
    <section
      // Pulled up under the transparent header so the photograph runs to the
      // very top of the page.
      className="relative -mt-16 flex min-h-[88svh] flex-col justify-end overflow-hidden bg-bottle md:-mt-20 md:min-h-[92svh]"
    >
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes="100vw"
        priority
        className="hero-image object-cover object-[62%_center]"
      />

      {/* Legibility, concentrated where type actually sits — the bottom-left
          corner and the strip the header occupies — rather than a wash over
          the whole frame. The top band is what carries the header to AA over a
          white plaster wall; measured at 5.2:1 for stone on the blend. */}
      <div
        aria-hidden
        className="hero-scrim absolute inset-0 bg-[linear-gradient(to_bottom,rgba(16,28,22,0.68)_0,rgba(16,28,22,0.62)_72px,transparent_200px),linear-gradient(to_top,rgba(16,28,22,0.78),rgba(16,28,22,0.32)_34%,transparent_58%),linear-gradient(to_right,rgba(16,28,22,0.5),transparent_48%)]"
      />

      <div className="relative mx-auto w-full max-w-[1600px] pad-x pb-14 md:pb-20">
        <h1 className="max-w-[16ch] font-display text-d2 text-stone">
          <span className="hero-line hero-line-1 block overflow-hidden">
            <span>The overshirt,</span>
          </span>
          <span className="hero-line hero-line-2 block overflow-hidden">
            <span>cut wider</span>
          </span>
        </h1>

        <div className="hero-tail mt-6 max-w-[42ch]">
          <p className="text-b2 text-stone/85 md:text-b1">
            Sixteen pieces in cotton twill, linen and merino, made for the
            months either side of winter.
          </p>
          <Link
            href="/shop"
            className="mt-5 inline-flex min-h-11 items-center text-meta text-stone underline decoration-1 underline-offset-4 hover:decoration-2"
          >
            See the collection
          </Link>
        </div>
      </div>
    </section>
  );
}
