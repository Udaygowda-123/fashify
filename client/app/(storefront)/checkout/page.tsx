import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { OrderSummary } from "@/components/checkout/OrderSummary";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-[1400px] pad-x pb-section">
      <header className="pt-8 md:pt-14">
        <h1 className="font-display text-d2">Checkout</h1>
        <Link
          href="/shop"
          className="mt-3 inline-flex min-h-11 items-center text-meta text-mist underline decoration-1 underline-offset-4 hover:text-ink"
        >
          Keep looking
        </Link>
      </header>

      {/* One summary, placed once. It folds itself away on a phone, where it
          sits above the form; on a desktop it pins to the right column. */}
      <div className="mt-6 flex flex-col lg:mt-12 lg:grid lg:grid-cols-12 lg:gap-x-16">
        <div className="order-1 lg:col-span-5 lg:col-start-8 lg:row-start-1">
          <OrderSummary />
        </div>
        <div className="order-2 mt-8 lg:col-span-7 lg:col-start-1 lg:row-start-1 lg:mt-0">
          <CheckoutFlow />
        </div>
      </div>
    </div>
  );
}
