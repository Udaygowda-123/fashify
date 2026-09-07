"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatOrderDate, formatPrice } from "@/lib/format";
import type { Order } from "@/lib/mock/types";
import { StatusTag } from "./StatusTag";

export function OrdersTable({ orders }: { orders: Order[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const order = orders.find((o) => o.id === openId) ?? null;

  if (orders.length === 0) {
    return (
      <EmptyState
        tone="tool"
        title="No orders yet"
        body="They arrive here as they come in, newest first."
      />
    );
  }

  // `relative` on the scroller matters: sr-only text is position:absolute,
  // and with no positioned ancestor it escapes the scroll container and
  // stretches the whole page sideways on a phone.
  return (
    <>
      <div className="relative overflow-x-auto border border-tool-rule">
        <table className="w-full min-w-[44rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-tool-rule bg-tool-sunk">
              {["Order", "Customer", "Placed", "Status", "Total", ""].map(
                (label, index) => (
                  <th
                    key={label || index}
                    scope="col"
                    className={
                      index === 4 || index === 5
                        ? "px-3 py-2 text-right font-normal"
                        : "px-3 py-2 font-normal"
                    }
                  >
                    <span className="text-[0.6875rem] tracking-wide text-tool-mist uppercase">
                      {label}
                    </span>
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {orders.map((row) => (
              <tr
                key={row.id}
                className="border-b border-tool-rule last:border-0 hover:bg-tool-sunk"
              >
                <td className="px-3 py-2" data-numeric>
                  {row.reference}
                </td>
                <td className="px-3 py-2">
                  <span className="block">{row.customerName}</span>
                  <span className="block text-[0.75rem] text-tool-mist">
                    {row.city}
                  </span>
                </td>
                <td className="px-3 py-2 text-tool-mist">
                  {formatOrderDate(row.placedAt)}
                </td>
                <td className="px-3 py-2">
                  <StatusTag status={row.status} />
                </td>
                <td className="px-3 py-2 text-right" data-numeric>
                  {formatPrice(row.total)}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setOpenId(row.id)}
                    className="inline-flex min-h-8 items-center text-[0.8125rem] underline decoration-1 underline-offset-4 hover:text-tool-ink"
                  >
                    Open
                    <span className="sr-only"> order {row.reference}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer
        open={Boolean(order)}
        onClose={() => setOpenId(null)}
        side="right"
        tone="tool"
        title={order ? `Order ${order.reference}` : "Order"}
      >
        {order ? (
          <div className="flex flex-col gap-6 text-[0.8125rem]">
            <div className="flex items-center justify-between gap-4">
              <StatusTag status={order.status} />
              <span className="text-tool-mist">
                {formatOrderDate(order.placedAt)}
              </span>
            </div>

            <div>
              <h3 className="text-tool-mist">Customer</h3>
              <p className="mt-1">{order.customerName}</p>
              <p className="text-tool-mist">{order.customerEmail}</p>
              <p className="text-tool-mist">{order.city}</p>
            </div>

            <div>
              <h3 className="text-tool-mist">Pieces</h3>
              <ul className="mt-2 flex flex-col divide-y divide-tool-rule">
                {order.lines.map((line) => (
                  <li
                    key={`${line.name}-${line.size}`}
                    className="flex justify-between gap-4 py-3 first:pt-0"
                  >
                    <span>
                      <span className="block">{line.name}</span>
                      <span className="block text-tool-mist">
                        Size {line.size}
                      </span>
                      <span className="block text-tool-mist">
                        {line.colourName}
                      </span>
                      <span className="block text-tool-mist" data-numeric>
                        Quantity {line.quantity}
                      </span>
                    </span>
                    <span data-numeric>
                      {formatPrice(line.price * line.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-between border-t border-tool-rule pt-4 text-[0.9375rem]">
              <span>Total</span>
              <span data-numeric>{formatPrice(order.total)}</span>
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
