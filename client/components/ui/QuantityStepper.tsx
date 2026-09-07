"use client";

import { cx } from "@/lib/format";

interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  /** Announced to screen readers, since the buttons are only symbols. */
  label: string;
  min?: number;
  max?: number;
  size?: "default" | "compact";
}

export function QuantityStepper({
  value,
  onChange,
  label,
  min = 1,
  max = 10,
  size = "default",
}: QuantityStepperProps) {
  const box = size === "compact" ? "h-9 w-9" : "h-11 w-11";

  return (
    <div
      className="inline-flex items-center border border-rule"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        className={cx(
          box,
          "flex items-center justify-center text-ink transition-colors duration-150 hover:bg-stone-deep disabled:opacity-35 disabled:hover:bg-transparent motion-reduce:transition-none",
        )}
      >
        <span className="sr-only">Reduce quantity of {label}</span>
        <svg viewBox="0 0 12 2" aria-hidden className="w-3" fill="currentColor">
          <rect width="12" height="1.2" y="0.4" />
        </svg>
      </button>
      <span
        className={cx(
          "min-w-8 text-center text-meta",
          size === "compact" && "min-w-7",
        )}
        data-numeric
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        className={cx(
          box,
          "flex items-center justify-center text-ink transition-colors duration-150 hover:bg-stone-deep disabled:opacity-35 disabled:hover:bg-transparent motion-reduce:transition-none",
        )}
      >
        <span className="sr-only">Increase quantity of {label}</span>
        <svg
          viewBox="0 0 12 12"
          aria-hidden
          className="w-3"
          fill="currentColor"
        >
          <rect width="12" height="1.2" y="5.4" />
          <rect width="1.2" height="12" x="5.4" />
        </svg>
      </button>
    </div>
  );
}
