import Image from "next/image";
import Link from "next/link";
import type { ImageAsset } from "@/lib/mock/types";

/**
 * Both auth pages sit in the label's world rather than on a bare white form:
 * the bottle-green panel carries a photograph and one display line, and the
 * form takes the stone side. On a phone the panel becomes a shallow band.
 */
export function AuthShell({
  image,
  panelLine,
  title,
  intro,
  children,
  footer,
}: {
  image: ImageAsset;
  panelLine: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="lg:grid lg:min-h-[calc(100svh-5rem)] lg:grid-cols-2">
      <div className="relative h-44 overflow-hidden bg-bottle sm:h-56 lg:h-auto">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="(min-width: 64rem) 50vw, 100vw"
          className="object-cover object-[50%_35%] opacity-90"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_top,rgba(16,28,22,0.85),rgba(16,28,22,0.3)_55%,rgba(16,28,22,0.15))]"
        />
        <p className="absolute bottom-6 left-5 max-w-[22ch] font-display text-d4 text-stone md:bottom-10 md:left-8 md:text-d3 lg:max-w-[18ch]">
          {panelLine}
        </p>
      </div>

      <div className="flex items-center justify-center pad-x py-14 md:py-20">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="font-display text-d4 lg:hidden"
            aria-label="Fashify, home"
          >
            Fashify
          </Link>
          <h1 className="mt-6 font-display text-d3 lg:mt-0">{title}</h1>
          {intro ? (
            <p className="mt-3 text-b2 text-mist">{intro}</p>
          ) : null}
          <div className="mt-8">{children}</div>
          <div className="mt-8 border-t border-rule pt-6 text-meta text-mist">
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}
