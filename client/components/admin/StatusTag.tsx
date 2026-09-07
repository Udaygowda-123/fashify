import { cx } from "@/lib/format";
import type { OrderStatus } from "@/lib/mock/types";

/**
 * Square, not a pill — nothing in this project has a corner radius. The colour
 * lives in the dot so the label itself stays at full contrast.
 */
const DOTS: Record<OrderStatus, string> = {
  new: "bg-brass",
  packing: "bg-bottle",
  shipped: "bg-bottle",
  delivered: "bg-tool-mist",
  cancelled: "bg-tool-alert",
};

const LABELS: Record<OrderStatus, string> = {
  new: "New",
  packing: "Packing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function StatusTag({ status }: { status: OrderStatus }) {
  return (
    <span className="inline-flex items-center gap-2 border border-tool-rule px-2 py-1 text-[0.75rem] whitespace-nowrap">
      <span aria-hidden className={cx("h-1.5 w-1.5 shrink-0", DOTS[status])} />
      {LABELS[status]}
    </span>
  );
}

export function StockTag({ stock }: { stock: number }) {
  const level = stock === 0 ? "out" : stock <= 12 ? "low" : "ok";
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-[0.75rem]">
      <span
        aria-hidden
        className={cx(
          "h-1.5 w-1.5 shrink-0",
          level === "out"
            ? "bg-tool-alert"
            : level === "low"
              ? "bg-brass"
              : "bg-tool-mist",
        )}
      />
      <span data-numeric>{stock}</span>
      <span className="text-tool-mist">
        {level === "out" ? "out of stock" : level === "low" ? "low" : "in stock"}
      </span>
    </span>
  );
}
