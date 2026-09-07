"use client";

import { cx } from "@/lib/format";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Shown to the right, dimmed. */
  count?: number;
  /** Colour swatch shown before the label. */
  hex?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  count,
  hex,
}: CheckboxProps) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-meta">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cx(
          "flex h-4 w-4 shrink-0 items-center justify-center border transition-colors duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brass motion-reduce:transition-none",
          checked ? "border-ink bg-ink" : "border-rule bg-transparent",
        )}
      >
        {checked ? (
          <svg
            viewBox="0 0 10 8"
            className="w-2.5 text-stone"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M1 4l2.5 2.5L9 1" />
          </svg>
        ) : null}
      </span>

      {hex ? (
        <span
          aria-hidden
          style={{ backgroundColor: hex }}
          className="h-4 w-4 shrink-0 shadow-[0_0_0_1px_var(--color-rule)]"
        />
      ) : null}

      <span className="flex-1">{label}</span>
      {typeof count === "number" ? (
        <span className="text-micro text-mist" data-numeric>
          {count}
        </span>
      ) : null}
    </label>
  );
}
