"use client";

import Link from "next/link";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { StockTag } from "@/components/admin/StatusTag";
import { fetchAdminDashboard, fetchAdminOrders, fetchLowStock } from "@/lib/api/admin";
import { useAdminQuery } from "@/lib/api/useAdminQuery";

/**
 * Metadata can't be exported from a client component, so the title here is
 * just set with document semantics via the layout's default template — the
 * browser tab still reads "Overview — Fashify" from the root layout's
 * template, this page just doesn't add its own override.
 */
export default function AdminOverviewPage() {
  const figures = useAdminQuery(fetchAdminDashboard);
  const orders = useAdminQuery(fetchAdminOrders);
  const alerts = useAdminQuery(fetchLowStock);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[1.125rem]">Overview</h1>
        <p className="mt-1 text-tool-mist">Real figures from the API, refreshed on load.</p>
      </div>

      <section aria-labelledby="figures">
        <h2 id="figures" className="sr-only">
          Figures
        </h2>
        {figures.loading ? (
          <p className="text-tool-mist">Loading…</p>
        ) : figures.error ? (
          <p className="text-tool-alert">{figures.error}</p>
        ) : (
          <dl className="grid grid-cols-1 border border-tool-rule sm:grid-cols-2 xl:grid-cols-4">
            {figures.data?.map((figure) => (
              <div
                key={figure.id}
                className="border-tool-rule px-4 py-4 not-last:border-b sm:not-last:border-b-0 sm:not-nth-[2n]:border-r xl:not-last:border-r"
              >
                <dt className="text-[0.75rem] text-tool-mist">{figure.label}</dt>
                <dd className="mt-1 text-[1.25rem]" data-numeric>
                  {figure.value}
                </dd>
                <dd className="mt-1 text-[0.75rem] text-tool-mist">{figure.note}</dd>
              </div>
            ))}
          </dl>
        )}
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
        {alerts.loading ? (
          <p className="mt-3 text-tool-mist">Loading…</p>
        ) : alerts.error ? (
          <p className="mt-3 text-tool-alert">{alerts.error}</p>
        ) : alerts.data?.length === 0 ? (
          <p className="mt-3 text-tool-mist">Nothing is close to selling out.</p>
        ) : (
          <ul className="mt-3 border border-tool-rule">
            {alerts.data?.map((alert) => (
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
        )}
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
          {orders.loading ? (
            <p className="text-tool-mist">Loading…</p>
          ) : orders.error ? (
            <p className="text-tool-alert">{orders.error}</p>
          ) : (
            <OrdersTable orders={(orders.data ?? []).slice(0, 5)} />
          )}
        </div>
      </section>
    </div>
  );
}
