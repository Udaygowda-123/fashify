"use client";

import { useEffect, useState } from "react";
import { useBag } from "@/components/bag/BagProvider";
import { Button } from "@/components/ui/Button";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { formatPrice } from "@/lib/format";
import type { Product, SizeCode } from "@/lib/mock/types";
import { ColourSwatches } from "./ColourSwatches";
import { SizePicker } from "./SizePicker";

export function ProductPurchase({ product }: { product: Product }) {
  const { addToBag } = useBag();
  const [colourSlug, setColourSlug] = useState(product.colour.slug);
  const [size, setSize] = useState<SizeCode | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const colour =
    product.colours.find((c) => c.slug === colourSlug) ?? product.colour;
  const chosen = product.sizes.find((s) => s.size === size);
  const soldOut = Boolean(chosen && !chosen.inStock);

  // "Added" is a confirmation, not a state — it goes back to the verb.
  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 2400);
    return () => clearTimeout(timer);
  }, [added]);

  function submit() {
    if (!size) {
      setError("Choose a size first.");
      return;
    }
    if (soldOut) return;
    setError(null);
    addToBag({ product, size, colourName: colour.name, quantity });
    setAdded(true);
  }

  const label = added ? "Added" : "Add to bag";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-meta text-mist">Colour: {colour.name}</p>
        <div className="mt-2 -ml-2">
          <ColourSwatches
            colours={product.colours}
            value={colourSlug}
            onChange={setColourSlug}
          />
        </div>
      </div>

      <div>
        <p className="text-meta text-mist">Size</p>
        <div className="mt-3">
          <SizePicker
            sizes={product.sizes}
            value={size}
            onChange={(next) => {
              setSize(next);
              setError(null);
            }}
          />
        </div>

        {soldOut && size ? (
          <p className="mt-3 text-meta">
            {size} is sold out.{" "}
            <button
              type="button"
              className="underline decoration-1 underline-offset-4 hover:decoration-2"
            >
              Tell me when it is back
            </button>
          </p>
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
        <Button onClick={submit} disabled={soldOut} fullWidth>
          {label}
        </Button>
      </div>

      <div className="safe-b fixed inset-x-0 bottom-0 z-30 flex items-center gap-4 border-t border-rule bg-stone px-5 pt-4 md:hidden">
        <p className="shrink-0 text-b1" data-numeric>
          {formatPrice(product.price)}
        </p>
        <Button onClick={submit} disabled={soldOut} fullWidth>
          {label}
        </Button>
      </div>
    </div>
  );
}
