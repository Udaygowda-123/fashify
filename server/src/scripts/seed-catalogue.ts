import type { Category, Size } from "../models/types.js";

/**
 * The catalogue the seed builds: thirty pieces across four categories, in a
 * palette that matches the photography.
 *
 * `stock` describes the shape of the size run rather than exact numbers, so
 * the seeded shop has the situations an admin actually deals with:
 *   full     — every size available
 *   thin     — a couple of sizes low enough to trigger the digest
 *   holes    — one or two sizes sold out
 *   soldout  — nothing available at all, so the notify-me path is reachable
 */
export type StockShape = "full" | "thin" | "holes" | "soldout";

export interface SeedColour {
  name: string;
  slug: string;
  hex: string;
}

export interface SeedPiece {
  slug: string;
  name: string;
  category: Category;
  /** Rupees. Converted to paise on the way in. */
  price: number;
  colours: SeedColour[];
  fabric: string;
  summary: string;
  fitNotes: string;
  care: string;
  stock: StockShape;
  sizes?: Size[];
  goesWith?: string[];
}

const ECRU: SeedColour = { name: "Ecru", slug: "ecru", hex: "#E4DFD3" };
const BONE: SeedColour = { name: "Bone", slug: "bone", hex: "#EAE6DC" };
const CHALK: SeedColour = { name: "Chalk", slug: "chalk", hex: "#F1F0EB" };
const OAT: SeedColour = { name: "Oat", slug: "oat", hex: "#D6C9B4" };
const SAND: SeedColour = { name: "Sand", slug: "sand", hex: "#CBBDA6" };
const STONE: SeedColour = { name: "Stone", slug: "stone", hex: "#D3D1C8" };
const ASH: SeedColour = { name: "Ash", slug: "ash", hex: "#B7B8B2" };
const SLATE: SeedColour = { name: "Slate", slug: "slate", hex: "#6C716E" };
const CHARCOAL: SeedColour = { name: "Charcoal", slug: "charcoal", hex: "#3B3E3C" };
const BLACK: SeedColour = { name: "Black", slug: "black", hex: "#1B1C1B" };
const BOTTLE: SeedColour = { name: "Bottle", slug: "bottle", hex: "#16261E" };

const TWILL = "100% cotton twill, 320gsm, woven in Erode and washed twice before it is cut.";
const LINEN = "100% linen, 260gsm, woven in Belgium and cut in Bengaluru.";
const MERINO = "100% extra-fine merino wool, 19.5 micron, 12 gauge.";
const LAMBSWOOL = "100% lambswool, 7 gauge, spun in Ludhiana.";
const JERSEY = "100% combed cotton, 240gsm, garment dyed.";
const LOOPBACK = "100% cotton loopback, 380gsm, undyed.";

const RELAXED =
  "Relaxed through the chest and shoulder, straight at the hem. If you are between sizes, take the smaller one — this is already cut wide.";
const STRAIGHT = "Straight body, set-in sleeve. True to size.";
const SLIM = "Slim through the body, ribbed at the cuff and hem. True to size.";
const HIGH_RISE =
  "High rise, single forward pleat, 22cm leg opening. Sits long on purpose — hem them if you are under 5'8\".";
const MID_RISE = "Mid rise, straight leg, no pleat. True to size.";

const CARE_WOOL = "Hand wash cool or dry clean. Dry flat, never on a hanger.";
const CARE_COTTON = "Machine wash cold, tumble dry low. It will soften and then stop changing.";
const CARE_LINEN = "Machine wash cold, dry flat. It creases, and it is meant to.";

export const SEED_CATALOGUE: SeedPiece[] = [
  /* ---- overshirts ---- */
  {
    slug: "ecru-overshirt",
    name: "Ecru Overshirt",
    category: "overshirts",
    price: 4800,
    colours: [ECRU, SLATE, BOTTLE],
    fabric: TWILL,
    summary:
      "A shirt cut with the ease of a jacket. Wear it open over a tee in October, buttoned under a coat in January.",
    fitNotes: RELAXED,
    care: CARE_COTTON,
    stock: "holes",
    goesWith: ["wide-leg-trouser-slate", "long-sleeve-tee-black", "merino-crew-oat"],
  },
  {
    slug: "cotton-overshirt-stone",
    name: "Cotton Overshirt in Stone",
    category: "overshirts",
    price: 4900,
    colours: [STONE, ECRU, CHARCOAL],
    fabric: TWILL,
    summary:
      "The ecru overshirt in a colder, greyer stone. Easier to wear with black than the ecru is.",
    fitNotes: RELAXED,
    care: CARE_COTTON,
    stock: "full",
    goesWith: ["tapered-trouser-black", "merino-crew-charcoal", "heavy-tee-charcoal"],
  },
  {
    slug: "linen-overshirt-bone",
    name: "Linen Overshirt in Bone",
    category: "overshirts",
    price: 5200,
    colours: [BONE, SLATE, BOTTLE],
    fabric: LINEN,
    summary: "The overshirt pattern cut in a heavy Belgian linen. It creases, and it is meant to.",
    fitNotes: RELAXED,
    care: CARE_LINEN,
    stock: "thin",
    goesWith: ["linen-trouser-chalk", "heavy-tee-grey-marl", "merino-crew-oat"],
  },
  {
    slug: "twill-overshirt-bottle",
    name: "Twill Overshirt in Bottle",
    category: "overshirts",
    price: 5000,
    colours: [BOTTLE, CHARCOAL],
    fabric: TWILL,
    summary: "A deep green that reads black at night and green in daylight.",
    fitNotes: RELAXED,
    care: CARE_COTTON,
    stock: "full",
  },
  {
    slug: "quilted-overshirt-charcoal",
    name: "Quilted Overshirt in Charcoal",
    category: "overshirts",
    price: 6900,
    colours: [CHARCOAL, BOTTLE],
    fabric: "Cotton twill shell, 320gsm, with a recycled wool wadding.",
    summary: "The overshirt block with a thin wadding through the body. The one for December.",
    fitNotes: RELAXED,
    care: CARE_COTTON,
    stock: "thin",
  },
  {
    slug: "camp-collar-shirt-chalk",
    name: "Camp-Collar Shirt in Chalk",
    category: "overshirts",
    price: 3900,
    colours: [CHALK, BONE, SLATE],
    fabric: LINEN,
    summary: "An open collar and a boxy body. The lightest layer here.",
    fitNotes: "Boxy, dropped shoulder. Size down for a closer fit.",
    care: CARE_LINEN,
    stock: "full",
  },
  {
    slug: "work-jacket-slate",
    name: "Work Jacket in Slate",
    category: "overshirts",
    price: 7200,
    colours: [SLATE, ECRU],
    fabric: "100% cotton canvas, 380gsm, garment washed.",
    summary: "Four pockets and a straight hem, in a canvas that softens with wear.",
    fitNotes: RELAXED,
    care: CARE_COTTON,
    stock: "soldout",
  },

  /* ---- trousers ---- */
  {
    slug: "wide-leg-trouser-slate",
    name: "Wide-Leg Trouser in Slate",
    category: "trousers",
    price: 5800,
    colours: [SLATE, BLACK, STONE],
    fabric: "100% cotton twill, 280gsm, washed.",
    summary:
      "Full through the leg with a single pleat, so the width falls from the hip rather than the knee.",
    fitNotes: HIGH_RISE,
    care: CARE_COTTON,
    stock: "holes",
    goesWith: ["ecru-overshirt", "loopback-sweatshirt-chalk", "chunky-knit-sand"],
  },
  {
    slug: "tapered-trouser-black",
    name: "Tapered Trouser in Black",
    category: "trousers",
    price: 5600,
    colours: [BLACK, SLATE],
    fabric: "98% cotton, 2% elastane, 11oz denim-weight twill.",
    summary: "Cut close through the leg without gripping it. The waistband sits on the hip.",
    fitNotes: "Mid rise, tapered from the knee. Inseam 30\" on XS–M and 32\" on L–XXL.",
    care: CARE_COTTON,
    stock: "thin",
    goesWith: ["long-sleeve-tee-black", "merino-crew-charcoal", "ecru-overshirt"],
  },
  {
    slug: "linen-trouser-chalk",
    name: "Linen Trouser in Chalk",
    category: "trousers",
    price: 4600,
    colours: [CHALK, STONE, SLATE],
    fabric: "100% washed linen, 190gsm.",
    summary: "A drawstring trouser in washed linen. The only piece here that is really for the heat.",
    fitNotes: "Elasticated back with a drawstring front, straight leg. True to size.",
    care: CARE_LINEN,
    stock: "holes",
  },
  {
    slug: "washed-twill-trouser-slate",
    name: "Washed Twill Trouser in Slate",
    category: "trousers",
    price: 5200,
    colours: [SLATE, STONE],
    fabric: "100% cotton twill, 300gsm, garment washed.",
    summary: "A straight trouser in twill washed soft. The one to wear when denim is too much.",
    fitNotes: MID_RISE,
    care: CARE_COTTON,
    stock: "holes",
  },
  {
    slug: "pleated-trouser-oat",
    name: "Pleated Trouser in Oat",
    category: "trousers",
    price: 6100,
    colours: [OAT, CHARCOAL],
    fabric: "62% wool, 38% cotton, 290gsm.",
    summary: "Two pleats and a turned hem. Smarter than the rest of the collection, on purpose.",
    fitNotes: HIGH_RISE,
    care: CARE_WOOL,
    stock: "full",
  },
  {
    slug: "carpenter-trouser-ecru",
    name: "Carpenter Trouser in Ecru",
    category: "trousers",
    price: 5400,
    colours: [ECRU, SLATE],
    fabric: "100% cotton canvas, 340gsm.",
    summary: "A loose leg with a hammer loop, in a canvas that goes soft at the knee.",
    fitNotes: MID_RISE,
    care: CARE_COTTON,
    stock: "full",
  },
  {
    slug: "track-trouser-charcoal",
    name: "Track Trouser in Charcoal",
    category: "trousers",
    price: 4400,
    colours: [CHARCOAL, BLACK],
    fabric: LOOPBACK,
    summary: "Loopback cotton with a tapered leg. Not for the gym.",
    fitNotes: "Elasticated waist and cuff. True to size.",
    care: CARE_COTTON,
    stock: "thin",
  },
  {
    slug: "wool-trouser-bottle",
    name: "Wool Trouser in Bottle",
    category: "trousers",
    price: 7400,
    colours: [BOTTLE, CHARCOAL],
    fabric: "100% merino wool, 320gsm, woven in Biella.",
    summary: "A flat-front trouser in a wool heavy enough to hold a crease.",
    fitNotes: MID_RISE,
    care: CARE_WOOL,
    stock: "soldout",
  },

  /* ---- knitwear ---- */
  {
    slug: "merino-crew-oat",
    name: "Merino Crew in Oat",
    category: "knitwear",
    price: 6400,
    colours: [OAT, CHARCOAL, BOTTLE],
    fabric: MERINO,
    summary: "Fine-gauge merino that goes under an overshirt without adding bulk at the shoulder.",
    fitNotes: SLIM,
    care: CARE_WOOL,
    stock: "thin",
    goesWith: ["ecru-overshirt", "linen-trouser-chalk", "washed-twill-trouser-slate"],
  },
  {
    slug: "merino-crew-charcoal",
    name: "Merino Crew in Charcoal",
    category: "knitwear",
    price: 6400,
    colours: [CHARCOAL, OAT, BOTTLE],
    fabric: MERINO,
    summary: "The oat crew in a charcoal that reads almost black indoors and grey in daylight.",
    fitNotes: SLIM,
    care: CARE_WOOL,
    stock: "full",
  },
  {
    slug: "chunky-knit-sand",
    name: "Chunky Knit in Sand",
    category: "knitwear",
    price: 7200,
    colours: [SAND, CHARCOAL],
    fabric: "70% lambswool, 30% alpaca, 3 gauge.",
    summary: "A three-gauge rib with real weight to it. This is the outer layer on most days.",
    fitNotes: "Oversized by design, dropped shoulder. Take your usual size.",
    care: CARE_WOOL,
    stock: "holes",
  },
  {
    slug: "ribbed-knit-ash",
    name: "Ribbed Knit in Ash",
    category: "knitwear",
    price: 6800,
    colours: [ASH, BOTTLE],
    fabric: "60% merino wool, 40% cotton, 5 gauge.",
    summary: "A five-gauge rib that holds a shape through the body without being tight.",
    fitNotes: "Regular through the body, long in the sleeve. True to size.",
    care: CARE_WOOL,
    stock: "holes",
  },
  {
    slug: "lambswool-crew-oat",
    name: "Lambswool Crew in Oat",
    category: "knitwear",
    price: 5400,
    colours: [OAT, ASH],
    fabric: LAMBSWOOL,
    summary: "Lambswool at seven gauge — warmer than the merino and a little more rustic.",
    fitNotes: "Regular through the body. True to size.",
    care: CARE_WOOL,
    stock: "thin",
  },
  {
    slug: "loopback-sweatshirt-chalk",
    name: "Loopback Sweatshirt in Chalk",
    category: "knitwear",
    price: 4200,
    colours: [CHALK, SLATE, BOTTLE],
    fabric: LOOPBACK,
    summary: "Loopback rather than brushed fleece, so it breathes indoors and does not pill.",
    fitNotes: "Boxy, with a ribbed hem that sits at the hip. Size down for a closer fit.",
    care: CARE_COTTON,
    stock: "full",
  },
  {
    slug: "half-zip-knit-slate",
    name: "Half-Zip Knit in Slate",
    category: "knitwear",
    price: 6600,
    colours: [SLATE, OAT],
    fabric: MERINO,
    summary: "A short zip and a standing collar. Wears like a shirt under a jacket.",
    fitNotes: SLIM,
    care: CARE_WOOL,
    stock: "full",
  },
  {
    slug: "cardigan-bottle",
    name: "Cardigan in Bottle",
    category: "knitwear",
    price: 7600,
    colours: [BOTTLE, OAT],
    fabric: LAMBSWOOL,
    summary: "Five buttons, patch pockets, and a hem that sits below the waistband.",
    fitNotes: "Relaxed. Take your usual size.",
    care: CARE_WOOL,
    stock: "thin",
  },
  {
    slug: "alpaca-scarf-oat",
    name: "Alpaca Scarf in Oat",
    category: "knitwear",
    price: 2800,
    colours: [OAT, CHARCOAL, BOTTLE],
    fabric: "70% alpaca, 30% merino wool.",
    summary: "Two metres of it, so it can go round twice.",
    fitNotes: "One size, 200cm by 30cm.",
    care: CARE_WOOL,
    stock: "full",
    sizes: ["M"],
  },

  /* ---- tees ---- */
  {
    slug: "heavy-tee-grey-marl",
    name: "Heavy Tee in Grey Marl",
    category: "tees",
    price: 2400,
    colours: [ASH, CHALK, CHARCOAL],
    fabric: "85% cotton, 15% viscose, 220gsm.",
    summary: "The marl is spun from two greys rather than printed, so it does not go flat.",
    fitNotes: STRAIGHT,
    care: CARE_COTTON,
    stock: "full",
    goesWith: ["wide-leg-trouser-slate", "linen-overshirt-bone", "chunky-knit-sand"],
  },
  {
    slug: "heavy-tee-charcoal",
    name: "Heavy Tee in Charcoal",
    category: "tees",
    price: 2400,
    colours: [CHARCOAL, CHALK, BLACK],
    fabric: "100% combed cotton, 220gsm, reactive dyed.",
    summary: "The same cut as the grey marl, in a charcoal that stays cold rather than fading brown.",
    fitNotes: STRAIGHT,
    care: CARE_COTTON,
    stock: "holes",
  },
  {
    slug: "long-sleeve-tee-black",
    name: "Long-Sleeve Tee in Black",
    category: "tees",
    price: 2200,
    colours: [BLACK, CHALK, SLATE],
    fabric: JERSEY,
    summary: "Heavy enough to wear on its own. The neck is bound rather than ribbed.",
    fitNotes: "Straight, with a slightly dropped shoulder. True to size.",
    care: CARE_COTTON,
    stock: "thin",
    goesWith: ["tapered-trouser-black", "ecru-overshirt", "merino-crew-charcoal"],
  },
  {
    slug: "pocket-tee-ecru",
    name: "Pocket Tee in Ecru",
    category: "tees",
    price: 2300,
    colours: [ECRU, SLATE],
    fabric: JERSEY,
    summary: "One chest pocket, set slightly high so it does not sag.",
    fitNotes: STRAIGHT,
    care: CARE_COTTON,
    stock: "full",
  },
  {
    slug: "boxy-tee-bone",
    name: "Boxy Tee in Bone",
    category: "tees",
    price: 2500,
    colours: [BONE, CHARCOAL, BOTTLE],
    fabric: "100% combed cotton, 260gsm.",
    summary: "Wide through the body and short in the sleeve. Wears well under an overshirt.",
    fitNotes: "Boxy. Size down if you want it closer.",
    care: CARE_COTTON,
    stock: "full",
  },
  {
    slug: "striped-tee-stone",
    name: "Striped Tee in Stone",
    category: "tees",
    price: 2600,
    colours: [STONE, BOTTLE],
    fabric: "100% combed cotton, 220gsm, yarn dyed.",
    summary: "A fine stripe, woven rather than printed, so it will not crack at the shoulder.",
    fitNotes: STRAIGHT,
    care: CARE_COTTON,
    stock: "soldout",
  },
];
