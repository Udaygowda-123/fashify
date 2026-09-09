"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch, uploadFile } from "@/lib/api/client";
import { useAuth } from "@/lib/firebase/AuthProvider";
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

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function AddProductForm() {
  const router = useRouter();
  const { getIdToken } = useAuth();

  const [sizes, setSizes] = useState<SizeCode[]>(["S", "M", "L"]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [colourName, setColourName] = useState("");
  const [colourHex, setColourHex] = useState("#E4DFD3");
  const [summary, setSummary] = useState("");
  const [fabric, setFabric] = useState("");
  const [fitNotes, setFitNotes] = useState("");
  const [careInstructions, setCareInstructions] = useState("");
  const [image, setImage] = useState<{ url: string; width: number; height: number } | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onFileSelected(file: File | null) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const idToken = await getIdToken();
      const result = await uploadFile("/admin/uploads", file, idToken);
      setImage(result);
    } catch (caught) {
      setUploadError(
        caught instanceof ApiError ? caught.message : "Could not upload that photograph.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const priceRupees = Number(price);
    if (!name.trim() || !category || !colourName.trim() || !priceRupees || sizes.length === 0) {
      setError("Fill in the name, price, category, colour and at least one size.");
      return;
    }

    setSubmitting(true);
    try {
      const idToken = await getIdToken();
      const slug = slugify(name);
      const colourSlug = slugify(colourName);
      const stem = slug.split("-").map((p) => p.slice(0, 3)).join("").toUpperCase();

      await apiFetch("/admin/products", {
        method: "POST",
        idToken,
        body: {
          slug,
          name: name.trim(),
          summary: summary.trim() || `${name.trim()}, cut for everyday wear.`,
          description: summary.trim() || `${name.trim()}, cut for everyday wear.`,
          category,
          fabric: fabric.trim() || "100% cotton.",
          careInstructions: careInstructions.trim() || "Machine wash cold.",
          fitNotes: fitNotes.trim() || "True to size.",
          basePrice: Math.round(priceRupees * 100),
          status: "draft",
          images: [
            {
              url: image?.url ?? "/images/product-ecru-overshirt-01.jpg",
              alt: `${name.trim()} in ${colourName.trim()}, photographed on a plain ground`,
              width: image?.width ?? 1400,
              height: image?.height ?? 1867,
            },
          ],
          variants: sizes.map((size) => ({
            sku: `FSH-${stem}-${colourSlug.slice(0, 3).toUpperCase()}-${size}`,
            size,
            colour: { name: colourName.trim(), slug: colourSlug, hex: colourHex },
            price: Math.round(priceRupees * 100),
            weightGrams: 460,
            onHand: 0,
          })),
        },
      });

      router.push("/admin/products");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save that product.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex max-w-3xl flex-col gap-6" onSubmit={onSubmit}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AdminField label="Name" className="sm:col-span-2">
          <input
            className={INPUT}
            placeholder="Ecru Overshirt"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </AdminField>

        <AdminField label="Price in rupees">
          <input
            className={INPUT}
            inputMode="numeric"
            placeholder="4800"
            data-numeric
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </AdminField>

        <AdminField label="Category">
          <select
            className={cx(INPUT, "appearance-none")}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="" disabled>
              Choose one
            </option>
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </AdminField>

        <AdminField label="Colour name">
          <input
            className={INPUT}
            placeholder="Ecru"
            value={colourName}
            onChange={(e) => setColourName(e.target.value)}
          />
        </AdminField>

        <AdminField label="Swatch" hint="Hex value used for the colour dot.">
          <input
            className={INPUT}
            placeholder="#E4DFD3"
            value={colourHex}
            onChange={(e) => setColourHex(e.target.value)}
          />
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
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </AdminField>

        <AdminField label="Fabric">
          <input
            className={INPUT}
            placeholder="100% cotton twill, 320gsm."
            value={fabric}
            onChange={(e) => setFabric(e.target.value)}
          />
        </AdminField>

        <AdminField label="Fit notes">
          <input
            className={INPUT}
            placeholder="Relaxed. True to size."
            value={fitNotes}
            onChange={(e) => setFitNotes(e.target.value)}
          />
        </AdminField>

        <AdminField label="Care" className="sm:col-span-2">
          <input
            className={INPUT}
            placeholder="Machine wash cold, tumble dry low."
            value={careInstructions}
            onChange={(e) => setCareInstructions(e.target.value)}
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
        <p className="text-[0.75rem] text-tool-mist">Photograph</p>
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void onFileSelected(event.dataTransfer.files[0] ?? null);
          }}
          className={cx(
            "mt-2 flex flex-col items-center gap-3 border border-dashed px-4 py-6 text-center transition-colors duration-150 motion-reduce:transition-none",
            dragging ? "border-tool-ink bg-tool-sunk" : "border-tool-rule bg-tool-sunk/50",
          )}
        >
          {image ? (
            <div className="flex items-center gap-3">
              <div className="h-20 w-16 shrink-0 overflow-hidden bg-tool-sunk">
                <Image
                  src={image.url}
                  alt=""
                  width={image.width}
                  height={image.height}
                  className="h-full w-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => setImage(null)}
                className="text-[0.8125rem] underline decoration-1 underline-offset-4"
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <p className="text-[0.8125rem]">
                {uploading ? (
                  "Uploading…"
                ) : (
                  <>
                    Drop a photograph here, or{" "}
                    <label className="cursor-pointer underline decoration-1 underline-offset-4">
                      choose a file
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => void onFileSelected(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </>
                )}
              </p>
              <p className="text-[0.6875rem] text-tool-mist">
                Portrait, 3:4, at least 1400px wide. Uploaded through Cloudinary; the first
                photograph becomes the grid tile.
              </p>
            </>
          )}
          {uploadError ? (
            <p className="text-[0.75rem] text-tool-alert">{uploadError}</p>
          ) : null}
        </div>
      </div>

      <p className="min-h-5 text-[0.8125rem] text-tool-alert" aria-live="polite">
        {error}
      </p>

      <div className="flex flex-wrap items-center gap-3 border-t border-tool-rule pt-5">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-9 items-center bg-tool-ink px-4 text-[0.8125rem] text-white hover:bg-black disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save as draft"}
        </button>
        <p className="text-[0.6875rem] text-tool-mist">
          Saves as a draft with zero stock — receive stock from the product's row in the
          table afterwards.
        </p>
      </div>
    </form>
  );
}
