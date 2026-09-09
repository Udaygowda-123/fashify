"use client";

import { OrdersTable } from "@/components/admin/OrdersTable";
import { fetchAdminOrders } from "@/lib/api/admin";
import { useAdminQuery } from "@/lib/api/useAdminQuery";

export default function AdminOrdersPage() {
  const { data: orders, loading, error } = useAdminQuery(fetchAdminOrders);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[1.125rem]">Orders</h1>
        <p className="mt-1 text-tool-mist" data-numeric>
          {loading ? "Loading…" : `${orders?.length ?? 0} orders. Open one to see what is in it.`}
        </p>
      </div>

      {error ? (
        <p className="text-tool-alert">{error}</p>
      ) : loading ? (
        <p className="text-tool-mist">Loading…</p>
      ) : (
        <OrdersTable orders={orders ?? []} />
      )}
    </div>
  );
}
