import type { Metadata } from "next";
import Link from "next/link";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { StockTag } from "@/components/admin/StatusTag";
import { getAdminFigures, getOrders, getStockAlerts } from "@/lib/mock";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const [figures, orders, alerts] = await Promise.all([
    getAdminFigures(),
    getOrders(),
    getStockAlerts(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[1.125rem]">Overview</h1>
        <p className="mt-1 text-tool-mist">
          The week to 7 September. Two orders are waiting to be packed.
        </p>
      </div>

      <section aria-labelledby="figures">
        <h2 id="figures" className="sr-only">
          Figures
        </h2>
        <dl className="grid grid-cols-1 border border-tool-rule sm:grid-cols-2 xl:grid-cols-4">
          {figures.map((figure) => (
            <div
              key={figure.id}
              className="border-tool-rule px-4 py-4 not-last:border-b sm:not-last:border-b-0 sm:[&:not(:nth-child(2n))]:border-r xl:[&:not(:last-child)]:border-r"
            >
              <dt className="text-[0.75rem] text-tool-mist">{figure.label}</dt>
              <dd className="mt-1 text-[1.25rem]" data-numeric>
                {figure.value}
              </dd>
              <dd className="mt-1 text-[0.75rem] text-tool-mist">
                {figure.note}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="low-stock">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="low-stock" className="text-[0.9375rem]">
            Running low
          </h2>
          <Link
            href="/admin/products"
            className="text-[0.8125rem] text-tool-mist underline decoration-1 underline-offset-4 hover:text-tool-ink"
          >
            All products
          </Link>
        </div>
        <ul className="mt-3 border border-tool-rule">
          {alerts.map((alert) => (
            <li
              key={`${alert.productId}-${alert.size}`}
              className="flex items-center justify-between gap-4 border-b border-tool-rule px-4 py-2.5 last:border-0"
            >
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span>{alert.name}</span>
                <span className="text-tool-mist">size {alert.size}</span>
              </span>
              <StockTag stock={alert.remaining} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="recent-orders">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="recent-orders" className="text-[0.9375rem]">
            Recent orders
          </h2>
          <Link
            href="/admin/orders"
            className="text-[0.8125rem] text-tool-mist underline decoration-1 underline-offset-4 hover:text-tool-ink"
          >
            All orders
          </Link>
        </div>
        <div className="mt-3">
          <OrdersTable orders={orders.slice(0, 5)} />
        </div>
      </section>
    </div>
  );
}
