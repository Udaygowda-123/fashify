"use client";

import { useId } from "react";
import { cx } from "@/lib/format";

interface BaseProps {
  label: string;
  /** Quiet guidance under the control, always present. */
  hint?: string;
  /**
   * What went wrong and what to do about it. Phase 1 renders these from props
   * so the error state is real markup rather than a mockup; nothing validates.
   */
  error?: string;
  className?: string;
}

const CONTROL =
  "min-h-12 w-full border bg-transparent px-3 text-b2 text-ink transition-colors duration-150 placeholder:text-mist/70 motion-reduce:transition-none";

function frame(error?: string) {
  return cx(
    CONTROL,
    error
      ? "border-alert focus:border-alert"
      : "border-rule hover:border-mist focus:border-ink",
  );
}

type FieldProps = BaseProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "className" | "id">;

export function Field({
  label,
  hint,
  error,
  className,
  ...rest
}: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-meta text-mist">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(hint && hintId, error && errorId) || undefined}
        className={frame(error)}
        {...rest}
      />
      {hint && !error ? (
        <p id={hintId} className="text-micro text-mist">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-micro text-alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type SelectFieldProps = BaseProps &
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className" | "id"> & {
    options: Array<{ value: string; label: string }>;
  };

export function SelectField({
  label,
  hint,
  error,
  className,
  options,
  ...rest
}: SelectFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-meta text-mist">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(hint && hintId, error && errorId) || undefined}
        className={cx(frame(error), "appearance-none pr-9")}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && !error ? (
        <p id={hintId} className="text-micro text-mist">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-micro text-alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
