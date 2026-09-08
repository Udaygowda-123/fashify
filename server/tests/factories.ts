import { Types } from "mongoose";
import {
  Cart,
  InventoryItem,
  Product,
  StockMovement,
  User,
  Variant,
  type ProductDoc,
  type VariantDoc,
} from "../src/models/index.js";
import { rupeesToPaise } from "../src/models/types.js";
import { ensureInventoryItem, receive } from "../src/services/inventory.service.js";

let counter = 0;
const next = () => (counter += 1);

export async function makeProduct(
  overrides: Partial<ProductDoc> = {},
): Promise<ProductDoc> {
  const n = next();
  return Product.create({
    slug: `test-piece-${n}`,
    name: `Test Piece ${n}`,
    summary: "A piece that exists so a test has something to buy.",
    description: "Longer copy for the product page.",
    category: "overshirts",
    fabric: "100% cotton twill, 320gsm.",
    careInstructions: "Cold wash, dry flat.",
    fitNotes: "Relaxed. True to size.",
    images: [
      {
        url: "/images/product-ecru-overshirt-01.jpg",
        alt: "The piece on a wooden hanger against a dark wall",
        width: 1400,
        height: 1867,
        position: 0,
      },
    ],
    status: "active",
    basePrice: rupeesToPaise(4800),
    publishedAt: new Date(),
    ...overrides,
  });
}

/**
 * A variant plus its inventory row.
 *
 * Stock is added through `receive()` rather than written straight onto the
 * document, so the ledger and the counters agree from the very first test
 * assertion. Setting `onHand` directly would leave every variant permanently
 * failing reconciliation — and would quietly mean the reconciliation tests
 * were only ever proving that the factory cheats.
 */
export async function makeVariant(args: {
  productId?: Types.ObjectId;
  onHand?: number;
  reserved?: number;
  size?: VariantDoc["size"];
  priceRupees?: number;
  lowStockThreshold?: number;
  colourSlug?: string;
}): Promise<{ variant: VariantDoc; productId: Types.ObjectId }> {
  const n = next();
  const productId = args.productId ?? (await makeProduct())._id;

  const variant = await Variant.create({
    productId,
    sku: `TEST-SKU-${n}`,
    colour: { name: "Ecru", slug: args.colourSlug ?? "ecru", hex: "#E4DFD3" },
    size: args.size ?? "M",
    price: rupeesToPaise(args.priceRupees ?? 4800),
    weightGrams: 480,
    isActive: true,
  });

  await ensureInventoryItem(variant._id, args.lowStockThreshold ?? 3);

  if (args.onHand && args.onHand > 0) {
    await receive({
      variantId: variant._id,
      quantity: args.onHand,
      reason: "opening stock for a test",
      refType: "manual",
    });
  }

  // A pre-held quantity has to look like a real hold: bump the counter and
  // record the matching ledger row, or reconciliation would flag it.
  if (args.reserved && args.reserved > 0) {
    await InventoryItem.updateOne(
      { variantId: variant._id },
      { $inc: { reserved: args.reserved } },
    );
    await StockMovement.create({
      variantId: variant._id,
      type: "reserve",
      quantity: args.reserved,
      reason: "pre-held stock for a test",
      refType: "manual",
    });
  }

  return { variant, productId };
}

export async function makeCart(args: { userId?: Types.ObjectId; guestToken?: string } = {}) {
  const n = next();
  const hasUser = Boolean(args.userId);
  return Cart.create({
    userId: args.userId ?? null,
    guestToken: hasUser ? null : (args.guestToken ?? `guest-token-${n}`),
    items: [],
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
  });
}

export async function makeUser(overrides: Record<string, unknown> = {}) {
  const n = next();
  return User.create({
    firebaseUid: `uid-${n}`,
    email: `shopper${n}@example.in`,
    name: `Shopper ${n}`,
    role: "customer",
    ...overrides,
  });
}
