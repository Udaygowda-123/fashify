"use client";

import { cx } from "@/lib/format";
import type { ColourOption } from "@/lib/mock/types";

interface ColourSwatchesProps {
  colours: ColourOption[];
  value: string;
  onChange: (slug: string) => void;
}

export function ColourSwatches({
  colours,
  value,
  onChange,
}: ColourSwatchesProps) {
  return (
    <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Colour">
      {colours.map((colour) => {
        const selected = value === colour.slug;
        return (
          <button
            key={colour.slug}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(colour.slug)}
            // 44px hit area around a smaller visible swatch.
            className="flex h-11 w-11 items-center justify-center"
          >
            <span className="sr-only">{colour.name}</span>
            <span
              aria-hidden
              style={{ backgroundColor: colour.hex }}
              // An outer ring, not an inset one — inset is invisible on ecru
              // and chalk, which is most of this palette.
              className={cx(
                "block h-7 w-7 transition-shadow duration-150 motion-reduce:transition-none",
                selected
                  ? "shadow-[0_0_0_1px_var(--color-stone),0_0_0_3px_var(--color-ink)]"
                  : "shadow-[0_0_0_1px_var(--color-rule)]",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
