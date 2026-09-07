"use client";

import { useState } from "react";
import { cx } from "@/lib/format";
import type { SizeCode } from "@/lib/mock/types";

const SIZES: SizeCode[] = ["XS", "S", "M", "L", "XL", "XXL"];

const CATEGORIES = [
  { value: "overshirts", label: "Overshirts" },
  { value: "trousers", label: "Trousers" },
  { value: "knitwear", label: "Knitwear" },
  { value: "tees", label: "Tees" },
];

/** Admin fields are their own thing — denser than the storefront's <Field>. */
function AdminField({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("flex flex-col gap-1.5", className)}>
      <span className="text-[0.75rem] text-tool-mist">{label}</span>
      {children}
      {hint ? (
        <span className="text-[0.6875rem] text-tool-mist">{hint}</span>
      ) : null}
    </label>
  );
}

const INPUT =
  "min-h-9 w-full border border-tool-rule bg-tool-bg px-2.5 text-[0.8125rem] text-tool-ink transition-colors duration-150 hover:border-tool-mist focus:border-tool-ink focus:outline-none motion-reduce:transition-none";

export function AddProductForm() {
  const [sizes, setSizes] = useState<SizeCode[]>(["S", "M", "L"]);
  const [dragging, setDragging] = useState(false);

  return (
    <form
      className="flex max-w-3xl flex-col gap-6"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AdminField label="Name" className="sm:col-span-2">
          <input className={INPUT} placeholder="Ecru Overshirt" />
        </AdminField>

        <AdminField label="Price in rupees">
          <input
            className={INPUT}
            inputMode="numeric"
            placeholder="4800"
            data-numeric
          />
        </AdminField>

        <AdminField label="Category">
          <select className={cx(INPUT, "appearance-none")} defaultValue="">
            <option value="" disabled>
              Choose one
            </option>
            {CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </AdminField>

        <AdminField label="Colour name">
          <input className={INPUT} placeholder="Ecru" />
        </AdminField>

        <AdminField label="Swatch" hint="Hex value used for the colour dot.">
          <input className={INPUT} placeholder="#E4DFD3" />
        </AdminField>

        <AdminField
          label="Summary"
          className="sm:col-span-2"
          hint="One or two sentences. This shows under the name on the product page."
        >
          <textarea
            rows={3}
            className={cx(INPUT, "min-h-20 py-2")}
            placeholder="A shirt cut with the ease of a jacket."
          />
        </AdminField>
      </div>

      <fieldset>
        <legend className="text-[0.75rem] text-tool-mist">Sizes made</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SIZES.map((size) => {
            const on = sizes.includes(size);
            return (
              <button
                key={size}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setSizes((current) =>
                    current.includes(size)
                      ? current.filter((s) => s !== size)
                      : [...current, size],
                  )
                }
                className={cx(
                  "min-h-9 min-w-11 border px-3 text-[0.8125rem] transition-colors duration-150 motion-reduce:transition-none",
                  on
                    ? "border-tool-ink bg-tool-ink text-white"
                    : "border-tool-rule text-tool-mist hover:border-tool-ink hover:text-tool-ink",
                )}
              >
                {size}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <p className="text-[0.75rem] text-tool-mist">Photographs</p>
        {/* Styled only. Nothing uploads in Phase 1. */}
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
          }}
          className={cx(
            "mt-2 flex flex-col items-center justify-center border border-dashed px-4 py-10 text-center transition-colors duration-150 motion-reduce:transition-none",
            dragging
              ? "border-tool-ink bg-tool-sunk"
              : "border-tool-rule bg-tool-sunk/50",
          )}
        >
          <p className="text-[0.8125rem]">
            Drop photographs here, or{" "}
            <button
              type="button"
              className="underline decoration-1 underline-offset-4"
            >
              choose files
            </button>
          </p>
          <p className="mt-1.5 text-[0.6875rem] text-tool-mist">
            Portrait, 3:4, at least 1400px wide. The first one becomes the grid
            tile.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-tool-rule pt-5">
        <button
          type="submit"
          className="inline-flex min-h-9 items-center bg-tool-ink px-4 text-[0.8125rem] text-white hover:bg-black"
        >
          Save product
        </button>
        <button
          type="button"
          className="inline-flex min-h-9 items-center border border-tool-rule px-4 text-[0.8125rem] hover:bg-tool-sunk"
        >
          Save as draft
        </button>
        <p className="text-[0.6875rem] text-tool-mist">
          Nothing is saved yet — the server arrives in Phase 2.
        </p>
      </div>
    </form>
  );
}
