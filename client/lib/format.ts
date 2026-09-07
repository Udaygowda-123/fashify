import type { Rupees } from "./mock/types";

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** ₹4,800 — Indian grouping, no paise, because nothing here has paise. */
export function formatPrice(value: Rupees): string {
  return rupees.format(value);
}

const orderDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

export function formatOrderDate(iso: string): string {
  return orderDate.format(new Date(iso));
}

/** "3 colours", "One colour" — never a bare numeral with no noun. */
export function formatColourCount(count: number): string {
  return count === 1 ? "One colour" : `${count} colours`;
}

export function formatPieceCount(count: number): string {
  return count === 1 ? "1 piece" : `${count} pieces`;
}

/** Joins class names. Falsy entries drop out, so conditionals stay readable. */
export function cx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
