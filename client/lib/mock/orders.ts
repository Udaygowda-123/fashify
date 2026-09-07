import type { AdminFigure, Order, StockAlert } from "./types";

/** Fixed timestamps, so the admin tables do not reshuffle between renders. */
export const ORDERS: Order[] = [
  {
    id: "o-1042",
    reference: "FSH-1042",
    customerName: "Ananya Rao",
    customerEmail: "ananya.rao@example.in",
    city: "Bengaluru",
    placedAt: "2026-09-07T09:12:00+05:30",
    status: "new",
    total: 10600,
    lines: [
      { name: "Ecru Overshirt", size: "M", colourName: "Ecru", quantity: 1, price: 4800 },
      { name: "Wide-Leg Trouser in Slate", size: "M", colourName: "Slate", quantity: 1, price: 5800 },
    ],
  },
  {
    id: "o-1041",
    reference: "FSH-1041",
    customerName: "Kabir Menon",
    customerEmail: "kabir.menon@example.in",
    city: "Mumbai",
    placedAt: "2026-09-07T08:04:00+05:30",
    status: "new",
    total: 2400,
    lines: [
      { name: "Heavy Tee in Charcoal", size: "L", colourName: "Charcoal", quantity: 1, price: 2400 },
    ],
  },
  {
    id: "o-1040",
    reference: "FSH-1040",
    customerName: "Ishita Bose",
    customerEmail: "ishita.bose@example.in",
    city: "Kolkata",
    placedAt: "2026-09-06T19:38:00+05:30",
    status: "packing",
    total: 13600,
    lines: [
      { name: "Chunky Knit in Sand", size: "L", colourName: "Sand", quantity: 1, price: 7200 },
      { name: "Merino Crew in Oat", size: "M", colourName: "Oat", quantity: 1, price: 6400 },
    ],
  },
  {
    id: "o-1039",
    reference: "FSH-1039",
    customerName: "Rehan Qureshi",
    customerEmail: "rehan.q@example.in",
    city: "Delhi",
    placedAt: "2026-09-06T16:11:00+05:30",
    status: "packing",
    total: 5600,
    lines: [
      { name: "Tapered Trouser in Black", size: "S", colourName: "Black", quantity: 1, price: 5600 },
    ],
  },
  {
    id: "o-1038",
    reference: "FSH-1038",
    customerName: "Meera Krishnan",
    customerEmail: "meera.k@example.in",
    city: "Chennai",
    placedAt: "2026-09-05T13:27:00+05:30",
    status: "shipped",
    total: 9400,
    lines: [
      { name: "Linen Overshirt in Bone", size: "S", colourName: "Bone", quantity: 1, price: 5200 },
      { name: "Linen Trouser in Chalk", size: "S", colourName: "Chalk", quantity: 1, price: 4600 },
    ],
  },
  {
    id: "o-1037",
    reference: "FSH-1037",
    customerName: "Devika Sharma",
    customerEmail: "devika.sharma@example.in",
    city: "Pune",
    placedAt: "2026-09-05T10:02:00+05:30",
    status: "shipped",
    total: 4800,
    lines: [
      { name: "Long-Sleeve Tee in Black", size: "M", colourName: "Black", quantity: 2, price: 2200 },
    ],
  },
  {
    id: "o-1036",
    reference: "FSH-1036",
    customerName: "Aditya Nair",
    customerEmail: "aditya.nair@example.in",
    city: "Kochi",
    placedAt: "2026-09-04T17:45:00+05:30",
    status: "delivered",
    total: 6800,
    lines: [
      { name: "Ribbed Knit in Ash", size: "L", colourName: "Ash", quantity: 1, price: 6800 },
    ],
  },
  {
    id: "o-1035",
    reference: "FSH-1035",
    customerName: "Sana Kapoor",
    customerEmail: "sana.kapoor@example.in",
    city: "Hyderabad",
    placedAt: "2026-09-04T11:19:00+05:30",
    status: "delivered",
    total: 9100,
    lines: [
      { name: "Cotton Overshirt in Stone", size: "M", colourName: "Stone", quantity: 1, price: 4900 },
      { name: "Heavy Tee in Grey Marl", size: "M", colourName: "Ash", quantity: 1, price: 2400 },
      { name: "Long-Sleeve Tee in Black", size: "M", colourName: "Black", quantity: 1, price: 2200 },
    ],
  },
  {
    id: "o-1034",
    reference: "FSH-1034",
    customerName: "Vikram Shetty",
    customerEmail: "vikram.shetty@example.in",
    city: "Bengaluru",
    placedAt: "2026-09-03T15:52:00+05:30",
    status: "cancelled",
    total: 5400,
    lines: [
      { name: "Lambswool Crew in Oat", size: "XL", colourName: "Oat", quantity: 1, price: 5400 },
    ],
  },
];

export const STOCK_ALERTS: StockAlert[] = [
  { productId: "p-001", slug: "ecru-overshirt", name: "Ecru Overshirt", size: "L", remaining: 0 },
  { productId: "p-013", slug: "linen-trouser-chalk", name: "Linen Trouser in Chalk", size: "L", remaining: 0 },
  { productId: "p-008", slug: "chunky-knit-sand", name: "Chunky Knit in Sand", size: "M", remaining: 2 },
  { productId: "p-010", slug: "wide-leg-trouser-slate", name: "Wide-Leg Trouser in Slate", size: "L", remaining: 3 },
  { productId: "p-007", slug: "merino-crew-oat", name: "Merino Crew in Oat", size: "M", remaining: 4 },
  { productId: "p-012", slug: "linen-overshirt-bone", name: "Linen Overshirt in Bone", size: "M", remaining: 5 },
];

export const ADMIN_FIGURES: AdminFigure[] = [
  {
    id: "f-revenue",
    label: "Revenue, last 7 days",
    value: "₹1,84,200",
    note: "Up from ₹1,62,900 the week before.",
  },
  {
    id: "f-orders",
    label: "Orders, last 7 days",
    value: "34",
    note: "Two are waiting to be packed.",
  },
  {
    id: "f-basket",
    label: "Average order",
    value: "₹5,418",
    note: "Overshirts are usually bought with a trouser.",
  },
  {
    id: "f-returns",
    label: "Returns rate",
    value: "6.4%",
    note: "Mostly size exchanges on the wide-leg trouser.",
  },
];
