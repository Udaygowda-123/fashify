"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { BagLine, Product, SizeCode } from "@/lib/mock/types";

/**
 * The one piece of shared client state in Phase 1. The header count and the
 * drawer contents have to agree, which local component state cannot do.
 * In memory only — nothing is persisted, and Phase 2 replaces this with real
 * server-backed cart calls.
 */
interface AddToBagInput {
  product: Product;
  size: SizeCode;
  colourName: string;
  quantity: number;
}

interface BagContextValue {
  lines: BagLine[];
  itemCount: number;
  subtotal: number;
  isOpen: boolean;
  openBag: () => void;
  closeBag: () => void;
  addToBag: (input: AddToBagInput) => void;
  removeLine: (lineId: string) => void;
  setLineQuantity: (lineId: string, quantity: number) => void;
}

const BagContext = createContext<BagContextValue | null>(null);

export function BagProvider({
  initialLines,
  children,
}: {
  initialLines: BagLine[];
  children: React.ReactNode;
}) {
  const [lines, setLines] = useState<BagLine[]>(initialLines);
  const [isOpen, setIsOpen] = useState(false);

  const openBag = useCallback(() => setIsOpen(true), []);
  const closeBag = useCallback(() => setIsOpen(false), []);

  const addToBag = useCallback(
    ({ product, size, colourName, quantity }: AddToBagInput) => {
      setLines((current) => {
        // Same piece in the same size and colour is one line, not two.
        const match = current.find(
          (line) =>
            line.productId === product.id &&
            line.size === size &&
            line.colourName === colourName,
        );
        if (match) {
          return current.map((line) =>
            line.id === match.id
              ? { ...line, quantity: line.quantity + quantity }
              : line,
          );
        }
        const line: BagLine = {
          id: `bl-${product.id}-${size}-${colourName}`,
          productId: product.id,
          slug: product.slug,
          name: product.name,
          price: product.price,
          size,
          colourName,
          quantity,
          image: product.images[0],
        };
        return [...current, line];
      });
      setIsOpen(true);
    },
    [],
  );

  const removeLine = useCallback((lineId: string) => {
    setLines((current) => current.filter((line) => line.id !== lineId));
  }, []);

  const setLineQuantity = useCallback((lineId: string, quantity: number) => {
    if (quantity < 1) return;
    setLines((current) =>
      current.map((line) =>
        line.id === lineId ? { ...line, quantity } : line,
      ),
    );
  }, []);

  const value = useMemo<BagContextValue>(() => {
    const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = lines.reduce(
      (sum, line) => sum + line.price * line.quantity,
      0,
    );
    return {
      lines,
      itemCount,
      subtotal,
      isOpen,
      openBag,
      closeBag,
      addToBag,
      removeLine,
      setLineQuantity,
    };
  }, [lines, isOpen, openBag, closeBag, addToBag, removeLine, setLineQuantity]);

  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
}

export function useBag(): BagContextValue {
  const context = useContext(BagContext);
  if (!context) {
    throw new Error("useBag must be used inside a BagProvider");
  }
  return context;
}
