import Image from "next/image";
import { EmptyState } from "@/components/ui/EmptyState";
import { cx } from "@/lib/format";
import type { ImageAsset, LookbookImage, Product } from "@/lib/mock/types";
import { ProductTile } from "./ProductTile";

interface ProductGridProps {
  products: Product[];
  /** Dropped in full width every `interruptEvery` pieces, to break the rhythm. */
  lookbook?: LookbookImage[];
  interruptEvery?: number;
  /** How many tiles load eagerly. Only above-the-fold ones should. */
  priorityCount?: number;
  /**
   * Shown with the no-matches state. Reached once Phase 2 filters on the
   * server; nothing in Phase 1 can empty the grid.
   */
  emptyImage?: ImageAsset;
  /**
   * Let the lookbook photographs run to the edges of the page.
   *
   * Only safe when the grid is a direct child of the padded page container,
   * as it is on the home page. Inside a narrower column — the nine of twelve
   * the shop grid sits in, beside the filters — the negative margin reaches
   * into the filter gutter on the left and past the container on the right,
   * so the row lines up with nothing. Off by default for that reason.
   */
  bleed?: boolean;
  className?: string;
}

type Slot =
  | {
      kind: "product";
      product: Product;
      wide: boolean;
      index: number;
      offset: boolean;
    }
  | { kind: "lookbook"; image: LookbookImage };

/** The widest layout, and the only one that gets vertical offsets. */
const COLUMNS = 4;

/**
 * Deliberately uneven: most pieces take one column, some take two, and a
 * lookbook photograph takes the full width roughly every sixth piece. An even
 * grid of identical cards is the tell.
 *
 * Columns are tracked rather than inferred from the index, for two reasons.
 * Offsetting by index alone drops a tile next to a wide neighbour and reads as
 * broken rather than composed; and a full-width break landing mid-row leaves a
 * ragged empty column, so breaks wait for the start of a row.
 */
function buildSlots(
  products: Product[],
  lookbook: LookbookImage[],
  interruptEvery: number,
): Slot[] {
  const slots: Slot[] = [];
  let used = 0;
  let column = 0;
  let sinceBreak = 0;
  let breakPending = false;

  products.forEach((product, index) => {
    const wide = product.span === "wide" && Boolean(product.wideImage);
    const span = wide ? 2 : 1;

    // Wrap before placing, so `column` is where this tile actually lands.
    if (column + span > COLUMNS) column = 0;

    if (breakPending && column === 0 && used < lookbook.length) {
      slots.push({ kind: "lookbook", image: lookbook[used] });
      used += 1;
      breakPending = false;
      sinceBreak = 0;
    }

    // Second column only, never a wide tile, never beside one.
    const previous = slots[slots.length - 1];
    const afterWide = previous?.kind === "product" && previous.wide;
    const offset = !wide && column === 1 && !afterWide;

    slots.push({ kind: "product", product, wide, index, offset });

    column = (column + span) % COLUMNS;
    sinceBreak += 1;
    if (sinceBreak >= interruptEvery && index + 1 < products.length) {
      breakPending = true;
    }
  });

  return slots;
}

export function ProductGrid({
  products,
  lookbook = [],
  interruptEvery = 6,
  priorityCount = 0,
  emptyImage,
  bleed = false,
  className,
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <EmptyState
        image={emptyImage}
        title="Nothing matches all of that"
        body="Try taking one filter off — the collection is sixteen pieces, so narrow choices run out quickly. Colour and size together is usually the pair that empties the rail."
        className={className}
      />
    );
  }

  const slots = buildSlots(products, lookbook, interruptEvery);

  return (
    <div
      className={cx(
        "grid grid-cols-2 items-start gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-5 md:gap-y-14 xl:grid-cols-4 xl:gap-x-7 xl:gap-y-20",
        className,
      )}
    >
      {slots.map((slot) => {
        if (slot.kind === "lookbook") {
          const { image } = slot.image;
          return (
            <div
              key={`look-${slot.image.id}`}
              className={cx(
                "col-span-full py-4 md:py-8",
                bleed &&
                  "-mx-gutter w-[calc(100%+2*var(--spacing-gutter))]",
              )}
            >
              <Image
                src={image.src}
                alt={image.alt}
                width={image.width}
                height={image.height}
                sizes={bleed ? "100vw" : "(min-width: 48rem) 75vw, 100vw"}
                className="h-auto w-full"
              />
            </div>
          );
        }

        const { product, wide, index, offset } = slot;

        return (
          <div
            key={product.id}
            className={cx(
              wide && "col-span-2",
              // broken baseline, wide screens only, where there is room for it
              offset && "xl:mt-16",
            )}
          >
            <ProductTile
              product={product}
              wide={wide}
              priority={index < priorityCount}
            />
          </div>
        );
      })}
    </div>
  );
}
