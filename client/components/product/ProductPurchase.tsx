"use client";

import { useEffect, useMemo, useState } from "react";
import { useBag } from "@/components/bag/BagProvider";
import { Button } from "@/components/ui/Button";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { ApiError, apiFetch } from "@/lib/api/client";
import { formatPrice } from "@/lib/format";
import type { Product, SizeCode } from "@/lib/mock/types";
import { ColourSwatches } from "./ColourSwatches";
import { SizePicker } from "./SizePicker";

/**
 * Real per-colour, per-size stock, from `product.variants` — the server
 * tracks a colour and a size as two separate axes of one sellable thing (see
 * server/src/models/variant.model.ts), which a flat "sizes for the product"
 * list cannot represent once two colourways sell through differently.
 */
export function ProductPurchase({ product }: { product: Product }) {
  const { addToBag } = useBag();
  const variants = product.variants ?? [];

  const [colourSlug, setColourSlug] = useState(product.colour.slug);
  const [size, setSize] = useState<SizeCode | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyState, setNotifyState] = useState<"idle" | "sending" | "done">("idle");

  const colour =
    product.colours.find((c) => c.slug === colourSlug) ?? product.colour;

  // The size run for whichever colour is currently selected, with real stock.
  const sizesForColour = useMemo(() => {
    if (variants.length === 0) return product.sizes;
    return variants
      .filter((variant) => variant.colour.slug === colourSlug)
      .map((variant) => ({ size: variant.size, inStock: variant.inStock }));
  }, [variants, colourSlug, product.sizes]);

  const chosenVariant = variants.find(
    (variant) => variant.colour.slug === colourSlug && variant.size === size,
  );
  const chosenFlat = product.sizes.find((s) => s.size === size);
  const soldOut = chosenVariant ? !chosenVariant.inStock : Boolean(chosenFlat && !chosenFlat.inStock);
  const displayPrice = chosenVariant?.price ?? product.price;

  // "Added" is a confirmation, not a state — it goes back to the verb.
  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 2400);
    return () => clearTimeout(timer);
  }, [added]);

  // Changing colour can leave a previously chosen size unavailable in stock
  // terms without being sold out — clear the error, not the size itself.
  useEffect(() => {
    setError(null);
    setNotifyState("idle");
  }, [colourSlug, size]);

  async function submit() {
    if (!size) {
      setError("Choose a size first.");
      return;
    }
    if (soldOut) return;

    if (!chosenVariant) {
      setError("That combination is not available.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await addToBag({ variantId: chosenVariant.id, quantity });
      setAdded(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not add that to your bag. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function notifyMe() {
    if (!chosenVariant || !notifyEmail.trim()) return;
    setNotifyState("sending");
    try {
      await apiFetch("/account/back-in-stock", {
        method: "POST",
        body: { variantId: chosenVariant.id, email: notifyEmail.trim() },
      });
      setNotifyState("done");
    } catch {
      setNotifyState("idle");
      setError("Could not save that. Check the email and try again.");
    }
  }

  const label = added ? "Added" : submitting ? "Adding" : "Add to bag";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-meta text-mist">Colour: {colour.name}</p>
        <div className="mt-2 -ml-2">
          <ColourSwatches
            colours={product.colours}
            value={colourSlug}
            onChange={(next) => {
              setColourSlug(next);
              setSize(null);
            }}
          />
        </div>
      </div>

      <div>
        <p className="text-meta text-mist">Size</p>
        <div className="mt-3">
          <SizePicker
            sizes={sizesForColour}
            value={size}
            onChange={(next) => {
              setSize(next);
              setError(null);
            }}
          />
        </div>

        {soldOut && size ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-meta">{size} is sold out.</p>
            {notifyState === "done" ? (
              <p className="text-meta text-brass">
                We will email you the moment it is back.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="email"
                  value={notifyEmail}
                  onChange={(event) => setNotifyEmail(event.target.value)}
                  placeholder="you@example.in"
                  className="min-h-11 min-w-0 flex-1 border border-rule bg-transparent px-3 text-meta text-ink placeholder:text-mist focus:border-ink focus:outline-none"
                />
                <button
                  type="button"
                  onClick={notifyMe}
                  disabled={notifyState === "sending" || !notifyEmail.trim()}
                  className="min-h-11 shrink-0 text-meta underline decoration-1 underline-offset-4 hover:decoration-2 disabled:opacity-50"
                >
                  Tell me when it is back
                </button>
              </div>
            )}
          </div>
        ) : null}

        <p className="mt-3 min-h-5 text-meta text-ink" aria-live="polite">
          {error}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <p className="text-meta text-mist">Quantity</p>
        <QuantityStepper
          value={quantity}
          onChange={setQuantity}
          label={product.name}
        />
      </div>

      {/* Desktop keeps the button in the panel; a phone gets it fixed to the
          bottom edge instead, so it is always under the thumb.

          The wrapper does the hiding rather than a `hidden md:inline-flex` on
          the button itself: both are display utilities, and which one wins is
          decided by their order in Tailwind's stylesheet, not by the order
          they are written in. */}
      <div className="hidden md:block">
        <Button onClick={submit} disabled={soldOut || submitting} fullWidth>
          {label}
        </Button>
      </div>

      <div className="safe-b fixed inset-x-0 bottom-0 z-30 flex items-center gap-4 border-t border-rule bg-stone px-5 pt-4 md:hidden">
        <p className="shrink-0 text-b1" data-numeric>
          {formatPrice(displayPrice)}
        </p>
        <Button onClick={submit} disabled={soldOut || submitting} fullWidth>
          {label}
        </Button>
      </div>
    </div>
  );
}
