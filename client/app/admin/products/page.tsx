"use client";

import Link from "next/link";
import { ProductsTable } from "@/components/admin/ProductsTable";
import { fetchAdminProducts } from "@/lib/api/admin";
import { useAdminQuery } from "@/lib/api/useAdminQuery";

export default function AdminProductsPage() {
  const { data: rows, loading, error } = useAdminQuery(fetchAdminProducts);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.125rem]">Products</h1>
          <p className="mt-1 text-tool-mist" data-numeric>
            {loading ? "Loading…" : `${rows?.length ?? 0} pieces. Sort by any column.`}
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex min-h-9 items-center border border-tool-ink px-4 text-[0.8125rem] hover:bg-tool-sunk"
        >
          Add product
        </Link>
      </div>

      {error ? (
        <p className="text-tool-alert">{error}</p>
      ) : loading ? (
        <p className="text-tool-mist">Loading…</p>
      ) : (
        <ProductsTable rows={rows ?? []} />
      )}
    </div>
  );
}
