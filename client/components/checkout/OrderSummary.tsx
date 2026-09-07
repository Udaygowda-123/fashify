"use client";

import Image from "next/image";
import { useState } from "react";
import { useBag } from "@/components/bag/BagProvider";
import { cx, formatPrice } from "@/lib/format";

/** Pinned alongside on a desktop, folded away behind a summary line on a phone. */
export function OrderSummary() {
  const { lines, itemCount, subtotal } = useBag();
  const [open, setOpen] = useState(false);

  const body = (
    <>
      <ul className="flex flex-col divide-y divide-rule">
        {lines.map((line) => (
          <li key={line.id} className="flex gap-4 py-4 first:pt-0">
            <div className="w-16 shrink-0 bg-stone-deep">
              <Image
                src={line.image.src}
                alt={line.image.alt}
                width={line.image.width}
                height={line.image.height}
                sizes="4rem"
                className="h-auto w-full"
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-meta">{line.name}</p>
              <p className="text-micro text-mist">Size {line.size}</p>
              <p className="text-micro text-mist">{line.colourName}</p>
              <p className="text-micro text-mist" data-numeric>
                Quantity {line.quantity}
              </p>
            </div>
            <p className="shrink-0 text-meta" data-numeric>
              {formatPrice(line.price * line.quantity)}
            </p>
          </li>
        ))}
      </ul>

      <dl className="mt-5 flex flex-col gap-2 border-t border-rule pt-5 text-meta">
        <div className="flex justify-between">
          <dt className="text-mist">Subtotal</dt>
          <dd data-numeric>{formatPrice(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-mist">Delivery</dt>
          <dd>Free</dd>
        </div>
        <div className="mt-2 flex justify-between border-t border-rule pt-3 text-b1">
          <dt>Total</dt>
          <dd data-numeric>{formatPrice(subtotal)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-micro text-mist">
        GST is included in the prices shown.
      </p>
    </>
  );

  return (
    <>
      {/* Phone: a line you can open, so the form is the first thing you see. */}
      <div className="border-y border-rule lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="order-summary-mobile"
          onClick={() => setOpen(!open)}
          className="flex min-h-14 w-full items-center justify-between gap-4 text-meta"
        >
          <span>
            {open ? "Hide order" : "Show order"}
            <span className="text-mist" data-numeric>
              {" "}
              ({itemCount})
            </span>
          </span>
          <span className="flex items-center gap-3">
            <span data-numeric>{formatPrice(subtotal)}</span>
            <span
              aria-hidden
              className="relative flex h-4 w-4 items-center justify-center"
            >
              <span className="absolute h-px w-4 bg-ink" />
              <span
                className={cx(
                  "absolute h-4 w-px bg-ink transition-transform duration-200 ease-out-quiet motion-reduce:transition-none",
                  open && "scale-y-0",
                )}
              />
            </span>
          </span>
        </button>
        <div id="order-summary-mobile" hidden={!open} className="pb-6">
          {body}
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="lg:sticky lg:top-28">
          <h2 className="text-meta text-mist">Your order</h2>
          <div className="mt-5">{body}</div>
        </div>
      </aside>
    </>
  );
}
