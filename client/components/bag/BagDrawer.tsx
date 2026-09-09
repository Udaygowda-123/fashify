"use client";

import Image from "next/image";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { formatPrice } from "@/lib/format";
import type { ImageAsset } from "@/lib/mock/types";
import { useBag } from "./BagProvider";

export function BagDrawer({ emptyImage }: { emptyImage: ImageAsset }) {
  const {
    lines,
    itemCount,
    subtotal,
    notices,
    isOpen,
    closeBag,
    removeLine,
    setLineQuantity,
  } = useBag();

  const empty = lines.length === 0;

  return (
    <Drawer
      open={isOpen}
      onClose={closeBag}
      side="right"
      title={empty ? "Your bag" : `Your bag (${itemCount})`}
      footer={
        empty ? undefined : (
          <div className="flex flex-col gap-4 pb-1">
            <div className="flex items-baseline justify-between">
              <span className="text-meta text-mist">Subtotal</span>
              <span className="text-b1" data-numeric>
                {formatPrice(subtotal)}
              </span>
            </div>
            <p className="text-micro text-mist">
              Delivery is free, and calculated at the next step along with tax.
            </p>
            <ButtonLink href="/checkout" fullWidth onClick={closeBag}>
              Checkout
            </ButtonLink>
          </div>
        )
      }
    >
      {empty ? (
        <EmptyState
          image={emptyImage}
          title="Nothing in it yet"
          body="Most people start with an overshirt. It is the piece the rest of the collection is cut around, and it goes over everything else here."
          actions={
            <>
              <ButtonLink href="/shop/ecru-overshirt" onClick={closeBag}>
                See the Ecru Overshirt
              </ButtonLink>
              <ButtonLink href="/shop" variant="outline" onClick={closeBag}>
                Look at everything
              </ButtonLink>
            </>
          }
        />
      ) : (
        <>
          {notices.length > 0 ? (
            <ul className="mb-4 flex flex-col gap-1.5 border border-brass/40 bg-brass/6 px-3 py-2.5">
              {notices.map((notice) => (
                <li key={notice} className="text-micro text-ink">
                  {notice}
                </li>
              ))}
            </ul>
          ) : null}
          <ul className="flex flex-col divide-y divide-rule">
            {lines.map((line) => (
              <li key={line.id} className="flex gap-4 py-5 first:pt-0">
                <Link
                  href={`/shop/${line.slug}`}
                  onClick={closeBag}
                  className="block w-20 shrink-0 bg-stone-deep"
                >
                  <Image
                    src={line.image.src}
                    alt={line.image.alt}
                    width={line.image.width}
                    height={line.image.height}
                    sizes="5rem"
                    className="h-auto w-full"
                  />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/shop/${line.slug}`}
                      onClick={closeBag}
                      className="text-meta text-ink hover:underline hover:decoration-1 hover:underline-offset-4"
                    >
                      {line.name}
                    </Link>
                    <span className="text-meta shrink-0" data-numeric>
                      {formatPrice(line.price * line.quantity)}
                    </span>
                  </div>
                  <p className="text-micro text-mist">Size {line.size}</p>
                  <p className="text-micro text-mist">{line.colourName}</p>
                  {line.overAvailable ? (
                    <p className="text-micro text-brass">
                      {line.available === 0
                        ? "Sold out since you added it"
                        : `Only ${line.available} left — reduce the quantity`}
                    </p>
                  ) : null}

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <QuantityStepper
                      value={line.quantity}
                      onChange={(next) => setLineQuantity(line.id, next)}
                      label={`${line.name}, size ${line.size}`}
                      size="compact"
                    />
                    <Button
                      variant="quiet"
                      onClick={() => removeLine(line.id)}
                      className="min-h-9 text-micro text-mist hover:text-ink"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Drawer>
  );
}
