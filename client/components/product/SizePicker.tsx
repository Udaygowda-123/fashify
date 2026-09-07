"use client";

import { cx } from "@/lib/format";
import type { SizeAvailability, SizeCode } from "@/lib/mock/types";

interface SizePickerProps {
  sizes: SizeAvailability[];
  value: SizeCode | null;
  onChange: (size: SizeCode) => void;
}

/**
 * Sold-out sizes stay selectable. Hiding them makes the size run look wrong,
 * and disabling them outright gives you nowhere to say when it is coming back.
 */
export function SizePicker({ sizes, value, onChange }: SizePickerProps) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Size">
      {sizes.map(({ size, inStock }) => {
        const selected = value === size;
        return (
          <button
            key={size}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(size)}
            className={cx(
              "relative flex h-11 min-w-14 items-center justify-center border px-3 text-meta transition-colors duration-150 ease-out-quiet motion-reduce:transition-none",
              selected
                ? "border-ink bg-ink text-stone"
                : "border-rule text-ink hover:border-ink",
              !inStock && !selected && "text-mist",
            )}
          >
            <span className={cx(!inStock && "line-through decoration-1")}>
              {size}
            </span>
            {!inStock ? (
              <span className="sr-only">, sold out</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
