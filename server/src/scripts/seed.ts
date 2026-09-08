/**
 * Seeds a shop that looks like it has been trading for a month: thirty pieces,
 * a size run per colour, stock in every state an admin has to deal with, a few
 * coupons, and past orders spread across the status machine so the dashboard
 * has something real in it.
 *
 *   npm run seed          # wipes the commerce collections and rebuilds
 *   npm run seed -- --keep-orders
 *
 * Stock is added through the inventory service rather than written onto the
 * documents, so the ledger reconciles from the first second. A seed that
 * bypassed it would leave every variant permanently failing the
 * reconciliation check.
 */
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { connectMongo, disconnectMongo } from "../lib/mongo.js";
import {
  BackInStockRequest,
  Cart,
  Coupon,
  InventoryItem,
  Order,
  Payment,
  Product,
  Reservation,
  Return,
  StockMovement,
  User,
  Variant,
  WebhookEvent,
  syncIndexes,
  type Size,
} from "../models/index.js";
import { rupeesToPaise } from "../models/types.js";
import { ensureInventoryItem, receive } from "../services/inventory.service.js";
import { PRODUCT_IMAGES } from "./seed-images.js";
import { SEED_CATALOGUE, type StockShape } from "./seed-catalogue.js";

const ALL_SIZES: Size[] = ["XS", "S", "M", "L", "XL", "XXL"];

/** Deterministic pseudo-randomness, so two seeds produce the same shop. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) & 0x7fff_ffff;
    return state / 0x7fff_ffff;
  };
}
const random = makeRandom(20260908);

const pick = <T>(items: readonly T[]): T =>
  items[Math.floor(random() * items.length)] as T;

const between = (min: number, max: number): number =>
  min + Math.floor(random() * (max - min + 1));

/** How many units a size gets, given the shape the piece is meant to be in. */
function unitsFor(shape: StockShape, index: number, total: number): number {
  switch (shape) {
    case "soldout":
      return 0;
    case "full":
      return between(8, 24);
    case "thin":
      // The middle sizes sell first, so those are the ones running low.
      return index === Math.floor(total / 2) || index === Math.floor(total / 2) + 1
        ? between(1, 3)
        : between(6, 18);
    case "holes":
      return index === Math.floor(total / 2) ? 0 : between(4, 20);
  }
}

/**
 * Full slugs rather than truncated ones. Abbreviating looked tidier and
 * collided immediately: "chalk" and "charcoal" both shorten to CHA, so two
 * colourways of the same tee generated the same SKU and the unique index
 * rejected the seed.
 */
function skuFor(slug: string, colourSlug: string, size: Size): string {
  return `FSH-${slug.toUpperCase()}-${colourSlug.toUpperCase()}-${size}`;
}

async function wipe(keepOrders: boolean): Promise<void> {
  // A seed that can run against a production database is a loaded gun. The
  // URI is checked rather than trusted, and NODE_ENV is not enough on its own.
  if (env.NODE_ENV === "production") {
    throw new Error("refusing to seed with NODE_ENV=production");
  }

  // Typed loosely on purpose: this is a heterogeneous list of models and the
  // only thing being called on them is deleteMany.
  const collections: { deleteMany: (filter: Record<string, never>) => unknown }[] = [
    Product,
    Variant,
    InventoryItem,
    StockMovement,
    Reservation,
    Cart,
    Coupon,
    BackInStockRequest,
  ];
  if (!keepOrders) {
    collections.push(Order, Payment, WebhookEvent, Return);
  }

  for (const model of collections) {
    await model.deleteMany({});
  }
  logger.info({ collections: collections.length }, "collections cleared");
}

async function seedCatalogue(): Promise<{ variantCount: number }> {
  let imageCursor = 0;
  const nextImages = (count: number) => {
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const image = PRODUCT_IMAGES[imageCursor % PRODUCT_IMAGES.length]!;
      imageCursor += 1;
      out.push({ ...image, position: i });
    }
    return out;
  };

  let variantCount = 0;
  const now = Date.now();

  for (const [index, piece] of SEED_CATALOGUE.entries()) {
    const product = await Product.create({
      slug: piece.slug,
      name: piece.name,
      summary: piece.summary,
      description: `${piece.summary} ${piece.fabric} ${piece.fitNotes}`,
      category: piece.category,
      fabric: piece.fabric,
      careInstructions: piece.care,
      fitNotes: piece.fitNotes,
      images: nextImages(piece.slug === "ecru-overshirt" ? 5 : 2),
      status: "active",
      basePrice: rupeesToPaise(piece.price),
      goesWith: piece.goesWith ?? [],
      // Spread over the last few weeks so "newest first" has a real order.
      publishedAt: new Date(now - index * 36 * 3600 * 1000),
    });

    const sizes = piece.sizes ?? ALL_SIZES;

    for (const [colourIndex, colour] of piece.colours.entries()) {
      for (const [sizeIndex, size] of sizes.entries()) {
        const variant = await Variant.create({
          productId: product._id,
          sku: skuFor(piece.slug, colour.slug, size),
          colour,
          size,
          // XXL costs a little more cloth. Only the first colour carries the
          // compareAtPrice, so a few pieces look reduced and most do not.
          price: rupeesToPaise(piece.price + (size === "XXL" ? 200 : 0)),
          compareAtPrice:
            colourIndex === 0 && index % 7 === 3
              ? rupeesToPaise(piece.price + 900)
              : null,
          weightGrams: piece.category === "knitwear" ? 620 : 460,
          isActive: true,
        });
        variantCount += 1;

        await ensureInventoryItem(variant._id, piece.category === "tees" ? 6 : 3);

        // Only the first colour follows the intended shape; the others are
        // stocked normally, so a "sold out" piece is sold out in one colourway
        // rather than everywhere.
        const shape: StockShape = colourIndex === 0 ? piece.stock : "full";
        const units = unitsFor(shape, sizeIndex, sizes.length);
        if (units > 0) {
          await receive({
            variantId: variant._id,
            quantity: units,
            reason: "opening stock",
            refType: "manual",
          });
        }
      }
    }
  }

  logger.info(
    { products: SEED_CATALOGUE.length, variants: variantCount },
    "catalogue seeded",
  );
  return { variantCount };
}

async function seedCoupons(): Promise<void> {
  await Coupon.create([
    {
      code: "WELCOME10",
      description: "10% off a first order",
      type: "percent",
      // Basis points: 1000 = 10%.
      value: 1000,
      minSubtotal: rupeesToPaise(3000),
      usageLimit: null,
      perUserLimit: 1,
      isActive: true,
    },
    {
      code: "LINEN500",
      description: "₹500 off when you spend ₹5,000",
      type: "fixed",
      value: rupeesToPaise(500),
      minSubtotal: rupeesToPaise(5000),
      usageLimit: 200,
      perUserLimit: 2,
      isActive: true,
    },
    {
      code: "EXPIRED20",
      description: "20% off, ended last month — kept so the expiry path is testable",
      type: "percent",
      value: 2000,
      minSubtotal: 0,
      validFrom: new Date(Date.now() - 60 * 24 * 3600 * 1000),
      validUntil: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      isActive: true,
    },
    {
      code: "ONEUSE",
      description: "A code with a single use left, for testing the limit",
      type: "fixed",
      value: rupeesToPaise(300),
      minSubtotal: 0,
      usageLimit: 1,
      usedCount: 0,
      isActive: true,
    },
  ]);
  logger.info("coupons seeded");
}

const SHOPPERS = [
  { name: "Ananya Rao", email: "ananya.rao@example.in", city: "Bengaluru", state: "Karnataka", pincode: "560001" },
  { name: "Kabir Menon", email: "kabir.menon@example.in", city: "Mumbai", state: "Maharashtra", pincode: "400001" },
  { name: "Ishita Bose", email: "ishita.bose@example.in", city: "Kolkata", state: "West Bengal", pincode: "700016" },
  { name: "Rehan Qureshi", email: "rehan.q@example.in", city: "Delhi", state: "Delhi", pincode: "110001" },
  { name: "Meera Krishnan", email: "meera.k@example.in", city: "Chennai", state: "Tamil Nadu", pincode: "600004" },
  { name: "Devika Sharma", email: "devika.sharma@example.in", city: "Pune", state: "Maharashtra", pincode: "411001" },
  { name: "Aditya Nair", email: "aditya.nair@example.in", city: "Kochi", state: "Kerala", pincode: "682001" },
  { name: "Sana Kapoor", email: "sana.kapoor@example.in", city: "Hyderabad", state: "Telangana", pincode: "500001" },
];

async function seedUsers(): Promise<mongoose.Types.ObjectId[]> {
  const ids: mongoose.Types.ObjectId[] = [];

  const admin = await User.create({
    // The seeded admin exists so the admin screens have an actor to attribute
    // changes to. It grants nothing: authorisation reads the Firebase claim,
    // and this row has no Firebase account behind it until you create one and
    // run `npm run grant-admin`.
    firebaseUid: "seed-admin-no-firebase-account",
    email: "admin@fashify.example.in",
    name: "Fashify Studio",
    role: "admin",
  });
  ids.push(admin._id);

  for (const shopper of SHOPPERS) {
    const user = await User.create({
      firebaseUid: `seed-${shopper.email}`,
      email: shopper.email,
      name: shopper.name,
      phone: `9${between(100000000, 999999999)}`,
      role: "customer",
      addresses: [
        {
          label: "Home",
          fullName: shopper.name,
          phone: `9${between(100000000, 999999999)}`,
          line1: `${between(1, 400)} ${pick(["Palm Grove", "Rose Lane", "Hill Road", "Mill Street"])}`,
          line2: null,
          city: shopper.city,
          state: shopper.state,
          pincode: shopper.pincode,
          country: "IN",
        },
      ],
    });
    ids.push(user._id);
  }

  logger.info({ users: ids.length }, "users seeded");
  return ids;
}

function orderNumber(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(random() * alphabet.length)];
  }
  return `FSH-${out}`;
}

/**
 * Past orders across the whole status machine, so the admin queue, the
 * dashboard figures and the returns list all have something in them.
 *
 * Paid orders commit their stock through `fulfil`, exactly as a real payment
 * would, so the ledger and the counters still agree afterwards.
 */
async function seedOrders(userIds: mongoose.Types.ObjectId[]): Promise<void> {
  const shape: { status: string; count: number }[] = [
    { status: "pending_payment", count: 3 },
    { status: "paid", count: 4 },
    { status: "processing", count: 5 },
    { status: "shipped", count: 6 },
    { status: "delivered", count: 8 },
    { status: "cancelled", count: 2 },
    { status: "payment_failed", count: 2 },
    { status: "return_requested", count: 2 },
  ];

  const variants = await Variant.aggregate<{
    _id: mongoose.Types.ObjectId;
    productId: mongoose.Types.ObjectId;
    sku: string;
    price: number;
    size: string;
    colour: { name: string };
  }>([{ $sample: { size: 120 } }]);

  const products = await Product.find().select("name images").lean();
  const productById = new Map(products.map((p) => [String(p._id), p]));

  const customers = userIds.slice(1);
  let dayOffset = 30;

  for (const bucket of shape) {
    for (let i = 0; i < bucket.count; i += 1) {
      const userId = pick(customers);
      const user = await User.findById(userId).lean();
      const address = user?.addresses[0];
      if (!user || !address) continue;

      const lineCount = between(1, 3);
      const items = [];
      let subtotal = 0;

      for (let line = 0; line < lineCount; line += 1) {
        const variant = pick(variants);
        const product = productById.get(String(variant.productId));
        if (!product) continue;
        const quantity = between(1, 2);
        subtotal += variant.price * quantity;
        items.push({
          variantId: variant._id,
          productId: variant.productId,
          sku: variant.sku,
          nameSnapshot: product.name,
          colourSnapshot: variant.colour.name,
          sizeSnapshot: variant.size,
          imageSnapshot: product.images[0]?.url ?? "",
          unitPrice: variant.price,
          quantity,
        });
      }
      if (items.length === 0) continue;

      // Free delivery over ₹2,500, matching the pricing service.
      const shipping = subtotal >= rupeesToPaise(2500) ? 0 : rupeesToPaise(120);
      const total = subtotal + shipping;

      dayOffset -= 0.7;
      const placedAt = new Date(Date.now() - dayOffset * 24 * 3600 * 1000);

      const snapshot = {
        fullName: address.fullName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2 ?? null,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: "IN",
      };

      const order = await Order.create({
        orderNumber: orderNumber(),
        userId,
        email: user.email,
        items,
        pricing: { subtotal, discount: 0, shipping, tax: 0, total },
        currency: "INR",
        shippingAddress: snapshot,
        billingAddress: snapshot,
        status: bucket.status,
        statusHistory: [{ status: bucket.status, at: placedAt, actorId: null, note: "seeded" }],
        idempotencyKey: randomUUID(),
        placedAt,
      });

      // Anything that got past payment took its units off the shelf.
      const committed = ["paid", "processing", "shipped", "delivered", "return_requested"];
      if (committed.includes(bucket.status)) {
        for (const item of items) {
          const inventory = await InventoryItem.findOne({ variantId: item.variantId });
          if (!inventory) continue;
          // Reserve then fulfil, which is the real sequence — a bag held it,
          // then payment committed it.
          await InventoryItem.updateOne(
            { variantId: item.variantId, $expr: { $gte: [{ $subtract: ["$onHand", "$reserved"] }, item.quantity] } },
            { $inc: { reserved: item.quantity } },
          );
          await StockMovement.create({
            variantId: item.variantId,
            type: "reserve",
            quantity: item.quantity,
            reason: `held for order ${order.orderNumber}`,
            refType: "order",
            refId: order._id,
          });
          const ok = await InventoryItem.findOneAndUpdate(
            {
              variantId: item.variantId,
              onHand: { $gte: item.quantity },
              reserved: { $gte: item.quantity },
            },
            { $inc: { onHand: -item.quantity, reserved: -item.quantity } },
          );
          if (ok) {
            await StockMovement.create({
              variantId: item.variantId,
              type: "fulfil",
              quantity: -item.quantity,
              reason: `committed to order ${order.orderNumber}`,
              refType: "order",
              refId: order._id,
            });
          } else {
            // Not enough stock to have sold it; undo the hold so the ledger
            // stays honest rather than leaving a dangling reserve.
            await InventoryItem.updateOne(
              { variantId: item.variantId, reserved: { $gte: item.quantity } },
              { $inc: { reserved: -item.quantity } },
            );
            await StockMovement.create({
              variantId: item.variantId,
              type: "release",
              quantity: -item.quantity,
              reason: "seed could not commit this line",
              refType: "order",
              refId: order._id,
            });
          }
        }
      }
    }
  }

  const count = await Order.countDocuments();
  logger.info({ orders: count }, "orders seeded");
}

async function seedBackInStock(): Promise<void> {
  // Queue a few people against variants that are actually sold out, so the
  // restock notifier has real work to do.
  const soldOut = await InventoryItem.aggregate<{ variantId: mongoose.Types.ObjectId }>([
    { $match: { $expr: { $lte: [{ $subtract: ["$onHand", "$reserved"] }, 0] } } },
    { $limit: 6 },
    { $project: { variantId: 1 } },
  ]);

  const rows = soldOut.flatMap((item, index) =>
    SHOPPERS.slice(0, 2 + (index % 3)).map((shopper) => ({
      variantId: item.variantId,
      email: shopper.email,
    })),
  );

  if (rows.length > 0) {
    await BackInStockRequest.insertMany(rows, { ordered: false }).catch(() => undefined);
  }
  logger.info({ requests: rows.length }, "back-in-stock queue seeded");
}

async function main(): Promise<void> {
  const keepOrders = process.argv.includes("--keep-orders");

  await connectMongo();
  await syncIndexes();
  await wipe(keepOrders);

  await seedCatalogue();
  await seedCoupons();
  const userIds = await seedUsers();
  if (!keepOrders) await seedOrders(userIds);
  await seedBackInStock();

  const [products, variants, inStock] = await Promise.all([
    Product.countDocuments(),
    Variant.countDocuments(),
    InventoryItem.countDocuments({ $expr: { $gt: [{ $subtract: ["$onHand", "$reserved"] }, 0] } }),
  ]);

  logger.info(
    { products, variants, variantsInStock: inStock },
    "seed complete",
  );
  await disconnectMongo();
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, "seed failed");
  process.exit(1);
});
