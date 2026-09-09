"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiError, apiFetch } from "@/lib/api/client";
import { useAuth } from "@/lib/firebase/AuthProvider";
import type { BagLine } from "@/lib/mock/types";

/**
 * The real bag, backed by the server's cart. The guest identity is a signed
 * httpOnly cookie Express sets on the first request — which is why this
 * fetches from the browser rather than being seeded from a server component:
 * a server-to-server fetch would receive that Set-Cookie itself and never
 * pass it on to the visitor, and the client's own next fetch would silently
 * start a second, empty cart.
 *
 * Quantity changes are optimistic: the UI updates immediately, and if the
 * server rejects the change (stock ran out under someone's thumb) the
 * previous line is restored and the server's own message is surfaced.
 */
interface CartLineFromServer {
  variantId: string;
  slug: string;
  name: string;
  size: string;
  colour: { name: string };
  image: { url: string; alt: string; width: number; height: number } | null;
  unitPrice: number;
  quantity: number;
  available: number;
  overAvailable: boolean;
}

interface CartViewFromServer {
  lines: CartLineFromServer[];
  itemCount: number;
  pricing: { subtotal: number; discount: number; shipping: number; total: number };
  couponCode: string | null;
  notices: string[];
  holdsExpireAt: string | null;
}

/** Rupees, since every price the client displays is in rupees, not paise. */
const toRupees = (paise: number) => Math.round(paise / 100);

function toBagLine(line: CartLineFromServer): BagLine & { available: number; overAvailable: boolean } {
  return {
    id: line.variantId,
    productId: line.variantId,
    slug: line.slug,
    name: line.name,
    price: toRupees(line.unitPrice),
    size: line.size as BagLine["size"],
    colourName: line.colour.name,
    quantity: line.quantity,
    image: line.image
      ? { src: line.image.url, alt: line.image.alt, width: line.image.width, height: line.image.height }
      : { src: "", alt: "", width: 1, height: 1 },
    available: line.available,
    overAvailable: line.overAvailable,
  };
}

interface BagContextValue {
  lines: (BagLine & { available: number; overAvailable: boolean })[];
  itemCount: number;
  subtotal: number;
  discount: number;
  total: number;
  couponCode: string | null;
  /** Plain sentences from the server: price changes, sold-out sizes, expired codes. */
  notices: string[];
  /** Set while a request is in flight, so double-clicks are visibly ignored. */
  loading: boolean;
  /** The last thing that went wrong, cleared on the next successful change. */
  error: string | null;
  isOpen: boolean;
  openBag: () => void;
  closeBag: () => void;
  addToBag: (input: { variantId: string; quantity: number }) => Promise<void>;
  removeLine: (variantId: string) => Promise<void>;
  setLineQuantity: (variantId: string, quantity: number) => Promise<void>;
  applyCoupon: (code: string | null) => Promise<void>;
  refresh: () => Promise<void>;
}

const BagContext = createContext<BagContextValue | null>(null);

const EMPTY_VIEW: CartViewFromServer = {
  lines: [],
  itemCount: 0,
  pricing: { subtotal: 0, discount: 0, shipping: 0, total: 0 },
  couponCode: null,
  notices: [],
  holdsExpireAt: null,
};

export function BagProvider({ children }: { children: React.ReactNode }) {
  const { getIdToken } = useAuth();
  const [view, setView] = useState<CartViewFromServer>(EMPTY_VIEW);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against a slow first load overwriting a change made in the meantime.
  const loaded = useRef(false);

  const openBag = useCallback(() => setIsOpen(true), []);
  const closeBag = useCallback(() => setIsOpen(false), []);

  const refresh = useCallback(async () => {
    const idToken = await getIdToken();
    const fresh = await apiFetch<CartViewFromServer>("/cart", { idToken });
    setView(fresh);
  }, [getIdToken]);

  useEffect(() => {
    let cancelled = false;
    refresh()
      .catch(() => {
        // A visitor with no bag yet, or the API being unreachable, both look
        // like an empty bag rather than an error banner on first paint.
      })
      .finally(() => {
        if (!cancelled) loaded.current = true;
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addToBag = useCallback(
    async (input: { variantId: string; quantity: number }) => {
      setLoading(true);
      setError(null);
      try {
        const idToken = await getIdToken();
        const fresh = await apiFetch<CartViewFromServer>("/cart/items", {
          method: "POST",
          body: input,
          idToken,
        });
        setView(fresh);
        setIsOpen(true);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : "Could not add that. Try again.");
        throw caught;
      } finally {
        setLoading(false);
      }
    },
    [getIdToken],
  );

  const setLineQuantity = useCallback(
    async (variantId: string, quantity: number) => {
      const previous = view;
      // Optimistic: the stepper responds instantly, and only rolls back if the
      // server actually refuses the change.
      setView((current) => ({
        ...current,
        lines: current.lines
          .map((line) => (line.variantId === variantId ? { ...line, quantity } : line))
          .filter((line) => line.quantity > 0),
        itemCount: current.lines.reduce(
          (sum, line) => sum + (line.variantId === variantId ? quantity : line.quantity),
          0,
        ),
      }));
      setError(null);
      try {
        const idToken = await getIdToken();
        const fresh = await apiFetch<CartViewFromServer>(`/cart/items/${variantId}`, {
          method: "PATCH",
          body: { quantity },
          idToken,
        });
        setView(fresh);
      } catch (caught) {
        setView(previous);
        setError(
          caught instanceof ApiError
            ? caught.message
            : "Could not change that quantity. Try again.",
        );
      }
    },
    [view, getIdToken],
  );

  const removeLine = useCallback(
    async (variantId: string) => {
      const previous = view;
      setView((current) => ({
        ...current,
        lines: current.lines.filter((line) => line.variantId !== variantId),
      }));
      try {
        const idToken = await getIdToken();
        const fresh = await apiFetch<CartViewFromServer>(`/cart/items/${variantId}`, {
          method: "DELETE",
          idToken,
        });
        setView(fresh);
      } catch (caught) {
        setView(previous);
        setError(caught instanceof ApiError ? caught.message : "Could not remove that.");
      }
    },
    [view, getIdToken],
  );

  const applyCoupon = useCallback(
    async (code: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const idToken = await getIdToken();
        const fresh = await apiFetch<CartViewFromServer>("/cart/coupon", {
          method: "POST",
          body: { code },
          idToken,
        });
        setView(fresh);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : "That code did not work.");
        throw caught;
      } finally {
        setLoading(false);
      }
    },
    [getIdToken],
  );

  const value = useMemo<BagContextValue>(
    () => ({
      lines: view.lines.map(toBagLine),
      itemCount: view.itemCount,
      subtotal: toRupees(view.pricing.subtotal),
      discount: toRupees(view.pricing.discount),
      total: toRupees(view.pricing.total),
      couponCode: view.couponCode,
      notices: view.notices,
      loading,
      error,
      isOpen,
      openBag,
      closeBag,
      addToBag,
      removeLine,
      setLineQuantity,
      applyCoupon,
      refresh,
    }),
    [view, loading, error, isOpen, openBag, closeBag, addToBag, removeLine, setLineQuantity, applyCoupon, refresh],
  );

  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
}

export function useBag(): BagContextValue {
  const context = useContext(BagContext);
  if (!context) {
    throw new Error("useBag must be used inside a BagProvider");
  }
  return context;
}
