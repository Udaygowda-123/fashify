"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ImageAsset } from "@/lib/mock/types";

/**
 * One component, two behaviours from CSS alone: a full-bleed scroll-snap strip
 * on a phone, a stacked column on a desktop with the buying panel sticky
 * beside it. The only JavaScript is the counter, which has nothing to report
 * once the images are stacked.
 */
export function Gallery({ images }: { images: ImageAsset[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState(1);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      const width = track.clientWidth;
      if (width === 0) return;
      const index = Math.round(track.scrollLeft / width);
      setCurrent(Math.min(images.length, Math.max(1, index + 1)));
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [images.length]);

  return (
    <div className="relative">
      <ul
        ref={trackRef}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] md:block md:overflow-visible [&::-webkit-scrollbar]:hidden"
      >
        {images.map((image, index) => (
          <li
            key={image.src}
            className="w-full shrink-0 snap-start bg-stone-deep md:mb-5 md:w-auto"
          >
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes="(min-width: 48rem) 58vw, 100vw"
              priority={index === 0}
              className="h-auto w-full"
            />
          </li>
        ))}
      </ul>

      {images.length > 1 ? (
        <p
          className="absolute right-4 bottom-4 bg-bottle/70 px-2 py-1 text-micro text-stone md:hidden"
          data-numeric
          aria-live="polite"
        >
          <span className="sr-only">Image </span>
          {current} of {images.length}
        </p>
      ) : null}
    </div>
  );
}
