"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { cx, formatPrice } from "@/lib/format";
import type { AdminProductRow } from "@/lib/mock/types";
import { StockTag } from "./StatusTag";

type SortKey = "name" | "category" | "price" | "stock";
type Direction = "asc" | "desc";

const COLUMNS: Array<{ key: SortKey; label: string; numeric?: boolean }> = [
  { key: "name", label: "Piece" },
  { key: "category", label: "Category" },
  { key: "price", label: "Price", numeric: true },
  { key: "stock", label: "Stock", numeric: true },
];

export function ProductsTable({ rows }: { rows: AdminProductRow[] }) {
  const [sort, setSort] = useState<SortKey>("name");
  const [direction, setDirection] = useState<Direction>("asc");
  const [openRow, setOpenRow] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const factor = direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = a[sort];
      const right = b[sort];
      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * factor;
      }
      return String(left).localeCompare(String(right)) * factor;
    });
  }, [rows, sort, direction]);

  function onSort(key: SortKey) {
    if (key === sort) {
      setDirection(direction === "asc" ? "desc" : "asc");
      return;
    }
    setSort(key);
    setDirection("asc");
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        tone="tool"
        title="No pieces yet"
        body="Add the first one and it will show up here with its stock per size."
      />
    );
  }

  // `relative` on the scroller matters: sr-only text is position:absolute,
  // and with no positioned ancestor it escapes the scroll container and
  // stretches the whole page sideways on a phone.
  return (
    <div className="relative overflow-x-auto border border-tool-rule">
      <table className="w-full min-w-[44rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-tool-rule bg-tool-sunk">
            <th scope="col" className="w-12 px-3 py-2">
              <span className="sr-only">Photograph</span>
            </th>
            {COLUMNS.map((column) => {
              const active = sort === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    active
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className={cx(
                    "px-3 py-2 font-normal",
                    column.numeric && "text-right",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    className={cx(
                      // Caps only here: in a tool, a table header in caps is
                      // a density signal, not an editorial flourish.
                      "inline-flex min-h-8 items-center gap-1.5 text-[0.6875rem] tracking-wide uppercase",
                      active ? "text-tool-ink" : "text-tool-mist",
                    )}
                  >
                    {column.label}
                    <span aria-hidden className="text-[0.625rem]">
                      {active ? (direction === "asc" ? "↑" : "↓") : ""}
                    </span>
                  </button>
                </th>
              );
            })}
            <th scope="col" className="px-3 py-2 text-right font-normal">
              <span className="text-[0.6875rem] tracking-wide text-tool-mist uppercase">
                Actions
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.id}
              className="border-b border-tool-rule last:border-0 hover:bg-tool-sunk"
            >
              <td className="px-3 py-2">
                <div className="w-8 bg-tool-sunk">
                  <Image
                    src={row.image.src}
                    alt=""
                    width={row.image.width}
                    height={row.image.height}
                    sizes="2rem"
                    className="h-auto w-full"
                  />
                </div>
              </td>
              <td className="px-3 py-2">
                <span className="block">{row.name}</span>
                <span className="block text-[0.75rem] text-tool-mist">
                  {row.colourName}
                  {row.sizesOutOfStock.length > 0
                    ? `, sold out in ${row.sizesOutOfStock.join(", ")}`
                    : ""}
                </span>
              </td>
              <td className="px-3 py-2 text-tool-mist capitalize">
                {row.category}
              </td>
              <td className="px-3 py-2 text-right" data-numeric>
                {formatPrice(row.price)}
              </td>
              <td className="px-3 py-2 text-right">
                <span className="inline-flex justify-end">
                  <StockTag stock={row.stock} />
                </span>
              </td>
              <td className="relative px-3 py-2 text-right">
                <button
                  type="button"
                  aria-expanded={openRow === row.id}
                  onClick={() =>
                    setOpenRow(openRow === row.id ? null : row.id)
                  }
                  className="inline-flex min-h-8 items-center px-2 text-[0.8125rem] text-tool-mist hover:text-tool-ink"
                >
                  <span className="sr-only">Actions for {row.name}</span>
                  <span aria-hidden>···</span>
                </button>
                {openRow === row.id ? (
                  <div className="absolute right-3 z-10 mt-1 w-40 border border-tool-rule bg-tool-bg text-left shadow-none">
                    {["Edit piece", "Adjust stock", "Duplicate", "Archive"].map(
                      (action) => (
                        <button
                          key={action}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-[0.8125rem] hover:bg-tool-sunk"
                        >
                          {action}
                        </button>
                      ),
                    )}
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
