"use client";

import { useState } from "react";
import { cx } from "@/lib/format";

export interface AccordionItem {
  id: string;
  title: string;
  body: string;
}

/** One panel open at a time, and none open to begin with. */
export function Accordion({ items }: { items: AccordionItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="border-t border-rule">
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <div key={item.id} className="border-b border-rule">
            <h3>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`panel-${item.id}`}
                onClick={() => setOpenId(open ? null : item.id)}
                className="flex min-h-14 w-full items-center justify-between gap-4 text-left text-meta"
              >
                {item.title}
                <span
                  aria-hidden
                  className="relative flex h-4 w-4 shrink-0 items-center justify-center"
                >
                  <span className="absolute h-px w-4 bg-ink" />
                  <span
                    className={cx(
                      "absolute h-4 w-px bg-ink transition-transform duration-200 ease-out-quiet motion-reduce:transition-none",
                      open && "scale-y-0",
                    )}
                  />
                </span>
              </button>
            </h3>
            <div
              id={`panel-${item.id}`}
              hidden={!open}
              className="pb-6 text-b2 text-mist"
            >
              {item.body}
            </div>
          </div>
        );
      })}
    </div>
  );
}
