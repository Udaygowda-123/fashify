import type { Metadata } from "next";
import Link from "next/link";
import { AddProductForm } from "@/components/admin/AddProductForm";

export const metadata: Metadata = { title: "Add product" };

export default function AdminAddProductPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/products"
          className="text-[0.8125rem] text-tool-mist underline decoration-1 underline-offset-4 hover:text-tool-ink"
        >
          Products
        </Link>
        <h1 className="mt-3 text-[1.125rem]">Add a product</h1>
        <p className="mt-1 text-tool-mist">
          Stock per size is set after saving, on the product itself.
        </p>
      </div>

      <AddProductForm />
    </div>
  );
}
