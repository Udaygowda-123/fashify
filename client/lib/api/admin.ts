import { apiFetch } from "./client";
import type {
  AdminFigure,
  AdminProductRow,
  Order,
  OrderLine,
  OrderStatus,
  StockAlert,
} from "@/lib/mock/types";

const toRupees = (paise: number) => Math.round(paise / 100);

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

interface DashboardResponse {
  figures: AdminFigure[];
  statusCounts: Record<string, number>;
}

export async function fetchAdminDashboard(idToken: string): Promise<AdminFigure[]> {
  const data = await apiFetch<DashboardResponse>("/admin/dashboard", { idToken });
  return data.figures;
}

export async function fetchLowStock(idToken: string): Promise<StockAlert[]> {
  const data = await apiFetch<{
    items: {
      variantId: string;
      sku: string;
      productName: string;
      slug: string;
      size: string;
      colour: string;
      available: number;
    }[];
  }>("/admin/stock/low", { idToken });

  return data.items.map((row) => ({
    productId: row.variantId,
    slug: row.slug,
    name: row.productName,
    size: row.size as StockAlert["size"],
    remaining: row.available,
  }));
}

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

interface AdminProductsResponse {
  items: {
    id: string;
    slug: string;
    name: string;
    category: AdminProductRow["category"];
    basePrice: number;
    image: string | null;
    totalOnHand: number;
    soldOutSizes: string[];
    variants: { colour: { name: string; slug: string } }[];
  }[];
  nextCursor: string | null;
}

export async function fetchAdminProducts(idToken: string): Promise<AdminProductRow[]> {
  const data = await apiFetch<AdminProductsResponse>("/admin/products?limit=100", { idToken });

  return data.items.map((row) => {
    const colourSlugs = new Set(row.variants.map((v) => v.colour.slug));
    const colourName =
      colourSlugs.size <= 1
        ? (row.variants[0]?.colour.name ?? "—")
        : `${colourSlugs.size} colours`;

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      category: row.category,
      price: toRupees(row.basePrice),
      colourName,
      stock: row.totalOnHand,
      sizesOutOfStock: row.soldOutSizes as AdminProductRow["sizesOutOfStock"],
      image: row.image
        ? { src: row.image, alt: row.name, width: 1400, height: 1867 }
        : { src: "", alt: row.name, width: 1400, height: 1867 },
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                     */
/* -------------------------------------------------------------------------- */

interface AdminOrderSummary {
  orderNumber: string;
  status: OrderStatus;
  email: string;
  customerName: string;
  city: string;
  total: number;
  placedAt: string;
}

interface AdminOrderDetail {
  orderNumber: string;
  status: OrderStatus;
  email: string;
  placedAt: string;
  pricing: { total: number };
  shippingAddress: { fullName: string; city: string };
  items: {
    nameSnapshot: string;
    sizeSnapshot: string;
    colourSnapshot: string;
    quantity: number;
    unitPrice: number;
  }[];
}

/**
 * The admin list endpoint returns summaries; OrdersTable's detail drawer
 * wants each order's line items. For the seed's scale (a few dozen orders)
 * fetching every detail up front is simpler and fast enough; a busier admin
 * would want the drawer to fetch its one order lazily on open instead.
 */
export async function fetchAdminOrders(idToken: string): Promise<Order[]> {
  const list = await apiFetch<{ items: AdminOrderSummary[] }>("/admin/orders?limit=100", {
    idToken,
  });

  const details = await Promise.all(
    list.items.map((row) =>
      apiFetch<AdminOrderDetail>(`/admin/orders/${row.orderNumber}`, { idToken }),
    ),
  );

  return details.map((order) => ({
    id: order.orderNumber,
    reference: order.orderNumber,
    customerName: order.shippingAddress.fullName,
    customerEmail: order.email,
    city: order.shippingAddress.city,
    placedAt: order.placedAt,
    status: order.status,
    total: toRupees(order.pricing.total),
    lines: order.items.map(
      (item): OrderLine => ({
        name: item.nameSnapshot,
        size: item.sizeSnapshot as OrderLine["size"],
        colourName: item.colourSnapshot,
        quantity: item.quantity,
        price: toRupees(item.unitPrice),
      }),
    ),
  }));
}
