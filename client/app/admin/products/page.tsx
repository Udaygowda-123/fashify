import type { Metadata } from "next";
import Link from "next/link";
import { ProductsTable } from "@/components/admin/ProductsTable";
import { getAdminProducts } from "@/lib/mock";

export const metadata: Metadata = { title: "Products" };

export default async function AdminProductsPage() {
  const rows = await getAdminProducts();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.125rem]">Products</h1>
          <p className="mt-1 text-tool-mist" data-numeric>
            {rows.length} pieces. Sort by any column.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex min-h-9 items-center border border-tool-ink px-4 text-[0.8125rem] hover:bg-tool-sunk"
        >
          Add product
        </Link>
      </div>

      <ProductsTable rows={rows} />
    </div>
  );
}
