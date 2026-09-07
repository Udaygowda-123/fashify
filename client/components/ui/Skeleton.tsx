import { cx } from "@/lib/format";

/**
 * Skeletons match the real layout's aspect ratios, so nothing moves when the
 * photographs arrive. The breathing stops under prefers-reduced-motion.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("skeleton", className)} />;
}

export function ProductTileSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div>
      <Skeleton className={wide ? "aspect-3/2 w-full" : "aspect-3/4 w-full"} />
      <div className="mt-3 flex flex-col gap-2">
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-2.5 w-1/5" />
      </div>
    </div>
  );
}

/** Mirrors ProductGrid: one wide tile, and a full-width break. */
export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading pieces"
      className="grid grid-cols-2 items-start gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-5 md:gap-y-14 xl:grid-cols-4 xl:gap-x-7 xl:gap-y-20"
    >
      {Array.from({ length: count }).map((_, index) => {
        if (index === 6) {
          return (
            <div
              key={index}
              className="col-span-full -mx-gutter w-[calc(100%+2*var(--spacing-gutter))] py-4 md:py-8"
            >
              <Skeleton className="aspect-[21/9] w-full" />
            </div>
          );
        }
        const wide = index === 4;
        return (
          <div key={index} className={wide ? "col-span-2" : undefined}>
            <ProductTileSkeleton wide={wide} />
          </div>
        );
      })}
    </div>
  );
}
