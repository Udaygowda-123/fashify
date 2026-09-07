"use client";

import { useCallback, useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/lib/format";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Right for the bag, bottom for the filter sheet on phones. */
  side?: "right" | "bottom";
  title: string;
  /** Hide the heading visually where the panel already reads as titled. */
  hideTitle?: boolean;
  children: React.ReactNode;
  /** Rendered against the bottom edge, above the safe area. */
  footer?: React.ReactNode;
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const subscribe = () => () => {};

/**
 * The panel stays mounted and `open` drives its classes, so it animates in
 * both directions without any enter/exit state of its own. While closed it is
 * `inert`, which takes it out of the tab order and the accessibility tree —
 * the thing a bare `opacity-0` would get wrong.
 */
export function Drawer({
  open,
  onClose,
  side = "right",
  title,
  hideTitle = false,
  children,
  footer,
}: DrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  // False on the server, true in the browser, without an effect that would
  // have to setState to say so.
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  // Remember where focus came from, move it in, and put it back on the way out.
  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel) {
      const target =
        panel.querySelector<HTMLElement>("[data-autofocus]") ??
        panel.querySelector<HTMLElement>(FOCUSABLE) ??
        panel;
      target.focus();
    }
    return () => {
      restoreTo.current?.focus?.();
    };
  }, [open]);

  // The page behind must not scroll while a panel is over it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      // Wrap at both ends so focus cannot leave the panel.
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (!isClient) return null;

  const closed = side === "right" ? "translate-x-full" : "translate-y-full";

  return createPortal(
    <div
      inert={!open}
      onKeyDown={onKeyDown}
      className={cx(
        "fixed inset-0 z-50",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-label={`Close ${title.toLowerCase()}`}
        onClick={onClose}
        className={cx(
          "absolute inset-0 bg-bottle/40 transition-opacity duration-300 ease-out-quiet motion-reduce:transition-none",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        ref={panelRef}
        // A closed panel is not a dialog. It stays in the DOM so it can
        // animate out, but it carries no role until it is actually open —
        // otherwise every page reports two or three open dialogs.
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-labelledby={open ? titleId : undefined}
        tabIndex={-1}
        className={cx(
          "absolute flex flex-col bg-stone transition-transform duration-300 ease-out-quiet motion-reduce:transition-none",
          side === "right"
            ? "inset-y-0 right-0 w-full max-w-[26rem]"
            : "inset-x-0 bottom-0 max-h-[85dvh]",
          open ? "translate-x-0 translate-y-0" : closed,
        )}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-rule px-5 pt-5 pb-4 md:px-6">
          <h2 id={titleId} className={cx("font-display text-d4", hideTitle && "sr-only")}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 flex h-11 w-11 items-center justify-center text-meta text-mist hover:text-ink"
          >
            <span className="sr-only">Close {title.toLowerCase()}</span>
            <svg
              viewBox="0 0 16 16"
              aria-hidden
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
            >
              <path d="M2 2l12 12M14 2L2 14" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-6">
          {children}
        </div>

        {footer ? (
          <div className="safe-b shrink-0 border-t border-rule px-5 pt-5 md:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
