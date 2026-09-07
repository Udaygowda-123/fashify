import type { Metadata } from "next";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { getOrders } from "@/lib/mock";

export const metadata: Metadata = { title: "Orders" };

export default async function AdminOrdersPage() {
  const orders = await getOrders();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[1.125rem]">Orders</h1>
        <p className="mt-1 text-tool-mist" data-numeric>
          {orders.length} orders. Open one to see what is in it.
        </p>
      </div>

      <OrdersTable orders={orders} />
    </div>
  );
}
