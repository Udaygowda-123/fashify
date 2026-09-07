"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Drawer } from "@/components/ui/Drawer";
import { cx, formatPieceCount } from "@/lib/format";
import type { FilterGroup, SortOption } from "@/lib/mock/types";

/**
 * The filters respond, remember what you picked and can be cleared. They do
 * not narrow the grid — Phase 2 does the filtering on the server, and faking
 * it client-side now would mean throwing that away.
 */
type Selection = Record<string, string[]>;

function toggle(selection: Selection, groupId: string, value: string): Selection {
  const current = selection[groupId] ?? [];
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
  return { ...selection, [groupId]: next };
}

function countSelected(selection: Selection): number {
  return Object.values(selection).reduce((sum, list) => sum + list.length, 0);
}

function FilterGroups({
  groups,
  selection,
  onToggle,
}: {
  groups: FilterGroup[];
  selection: Selection;
  onToggle: (groupId: string, value: string) => void;
}) {
  return (
    <div className="flex flex-col">
      {groups.map((group) => (
        <fieldset key={group.id} className="border-t border-rule py-5">
          <legend className="mb-1 text-meta text-mist">{group.label}</legend>
          <div className="flex flex-col">
            {group.options.map((option) => (
              <Checkbox
                key={option.value}
                label={option.label}
                count={option.count}
                hex={option.hex}
                checked={(selection[group.id] ?? []).includes(option.value)}
                onChange={() => onToggle(group.id, option.value)}
              />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export function ShopControls({
  groups,
  sortOptions,
  resultCount,
  children,
}: {
  groups: FilterGroup[];
  sortOptions: SortOption[];
  resultCount: number;
  /** The grid. Rendered on the server and passed through. */
  children: React.ReactNode;
}) {
  const [selection, setSelection] = useState<Selection>({});
  const [sort, setSort] = useState(sortOptions[0]?.value ?? "featured");
  const [sheetOpen, setSheetOpen] = useState(false);

  const selected = countSelected(selection);
  const onToggle = (groupId: string, value: string) =>
    setSelection((current) => toggle(current, groupId, value));

  const sortControl = (
    <label className="flex items-center gap-2 text-meta">
      <span className="text-mist">Sort</span>
      <select
        value={sort}
        onChange={(event) => setSort(event.target.value)}
        className="min-h-11 border-0 bg-transparent pr-6 text-meta text-ink focus:outline-none"
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      {/* Phone: a bar under the header, opening a bottom sheet. */}
      <div className="flex items-center justify-between gap-4 border-y border-rule py-2 md:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex min-h-11 items-center gap-2 text-meta"
        >
          Filter
          {selected > 0 ? (
            <span className="text-meta text-mist" data-numeric>
              ({selected})
            </span>
          ) : null}
        </button>
        <span aria-hidden className="h-5 w-px bg-rule" />
        {sortControl}
      </div>

      <p className="mt-5 text-meta text-mist md:hidden" data-numeric>
        {formatPieceCount(resultCount)}
      </p>

      <div className="md:grid md:grid-cols-12 md:gap-x-10 xl:gap-x-16">
        {/* Desktop: a column that stays put while the grid scrolls. */}
        <aside className="hidden md:col-span-3 md:block">
          <div className="md:sticky md:top-28">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-meta text-mist" data-numeric>
                {formatPieceCount(resultCount)}
              </h2>
              {selected > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelection({})}
                  className="text-micro text-mist underline decoration-1 underline-offset-4 hover:text-ink"
                >
                  Clear all
                </button>
              ) : null}
            </div>
            <div className="mt-4">
              <FilterGroups
                groups={groups}
                selection={selection}
                onToggle={onToggle}
              />
            </div>
          </div>
        </aside>

        <div className="md:col-span-9">
          <div className="mb-8 hidden items-center justify-end md:flex">
            {sortControl}
          </div>
          {children}
        </div>
      </div>

      <Drawer
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        side="bottom"
        title="Filter"
        footer={
          <div className={cx("flex gap-3 pb-1")}>
            {selected > 0 ? (
              <Button
                variant="outline"
                onClick={() => setSelection({})}
                className="flex-1"
              >
                Clear all
              </Button>
            ) : null}
            <Button onClick={() => setSheetOpen(false)} className="flex-1">
              Show {formatPieceCount(resultCount)}
            </Button>
          </div>
        }
      >
        <FilterGroups
          groups={groups}
          selection={selection}
          onToggle={onToggle}
        />
      </Drawer>
    </>
  );
}
