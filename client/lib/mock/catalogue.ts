import { IMAGE_SIZES, type ImageName } from "./imageSizes";
import type {
  Collection,
  ColourOption,
  ImageAsset,
  LookbookImage,
  Product,
  SizeAvailability,
  SizeCode,
} from "./types";

/** Pairs a file in public/images with a real description of it. */
function img(name: ImageName, alt: string): ImageAsset {
  const { width, height } = IMAGE_SIZES[name];
  return { src: `/images/${name}.jpg`, alt, width, height };
}

const COLOURS = {
  ecru: { slug: "ecru", name: "Ecru", hex: "#E4DFD3" },
  bone: { slug: "bone", name: "Bone", hex: "#EAE6DC" },
  chalk: { slug: "chalk", name: "Chalk", hex: "#F1F0EB" },
  oat: { slug: "oat", name: "Oat", hex: "#D6C9B4" },
  sand: { slug: "sand", name: "Sand", hex: "#CBBDA6" },
  stone: { slug: "stone", name: "Stone", hex: "#D3D1C8" },
  ash: { slug: "ash", name: "Ash", hex: "#B7B8B2" },
  slate: { slug: "slate", name: "Slate", hex: "#6C716E" },
  charcoal: { slug: "charcoal", name: "Charcoal", hex: "#3B3E3C" },
  black: { slug: "black", name: "Black", hex: "#1B1C1B" },
  bottle: { slug: "bottle", name: "Bottle", hex: "#16261E" },
} satisfies Record<string, ColourOption>;

const ALL_SIZES: SizeCode[] = ["XS", "S", "M", "L", "XL", "XXL"];

/** Every size in stock except the ones named. */
function sizes(...soldOut: SizeCode[]): SizeAvailability[] {
  return ALL_SIZES.map((size) => ({
    size,
    inStock: !soldOut.includes(size),
  }));
}

const DELIVERY =
  "Free delivery across India, two to four working days. Returns are free for 30 days, unworn and with tags on.";

export const PRODUCTS: Product[] = [
  {
    id: "p-001",
    slug: "ecru-overshirt",
    name: "Ecru Overshirt",
    category: "overshirts",
    price: 4800,
    colour: COLOURS.ecru,
    colours: [COLOURS.ecru, COLOURS.slate, COLOURS.bottle],
    images: [
      img(
        "product-ecru-overshirt-01",
        "The ecru overshirt on a wooden hanger, one sleeve falling open against a dark wall",
      ),
      img(
        "product-ecru-overshirt-02",
        "Close view of the placket, showing the topstitching and the open weave of the twill",
      ),
      img(
        "product-ecru-overshirt-03",
        "The side seam, flat-felled and pressed, with a single line of stitching",
      ),
      img(
        "product-ecru-overshirt-04",
        "The overshirt folded, collar and chest pocket uppermost",
      ),
      img(
        "product-ecru-overshirt-05",
        "The cloth in loose folds, showing how the twill falls when it is not pressed",
      ),
    ],
    sizes: sizes("L"),
    span: "single",
    summary:
      "A shirt cut with the ease of a jacket. Wear it open over a tee in October, buttoned under a coat in January.",
    composition:
      "100% cotton twill, 320gsm, woven in Erode and washed twice before it is cut. It softens for about six wears and then stops changing.",
    fitNotes:
      "Relaxed through the chest and shoulder, straight at the hem. Our fit model is 5'11\" and wears a M. If you are between sizes, take the smaller one — this is already cut wide.",
    delivery: DELIVERY,
    isNew: true,
    goesWith: ["wide-leg-trouser-slate", "long-sleeve-tee-black", "merino-crew-oat"],
  },
  {
    id: "p-002",
    slug: "long-sleeve-tee-black",
    name: "Long-Sleeve Tee in Black",
    category: "tees",
    price: 2200,
    colour: COLOURS.black,
    colours: [COLOURS.black, COLOURS.chalk, COLOURS.slate],
    images: [
      img(
        "product-heavy-tee-black-01",
        "A black long-sleeve tee on a wooden hanger against a white wall",
      ),
    ],
    sizes: sizes("XXL"),
    span: "single",
    summary:
      "Heavy enough to wear on its own. The neck is bound rather than ribbed, so it keeps its shape.",
    composition: "100% combed cotton, 240gsm, garment dyed.",
    fitNotes: "Straight, with a slightly dropped shoulder. True to size.",
    delivery: DELIVERY,
    isNew: false,
    goesWith: ["tapered-trouser-black", "ecru-overshirt", "merino-crew-charcoal"],
  },
  {
    id: "p-003",
    slug: "heavy-tee-grey-marl",
    name: "Heavy Tee in Grey Marl",
    category: "tees",
    price: 2400,
    colour: COLOURS.ash,
    colours: [COLOURS.ash, COLOURS.chalk, COLOURS.charcoal],
    images: [
      img(
        "product-heavy-tee-grey-marl-01",
        "A grey marl tee on a wooden hanger, lit from the left against a pale wall",
      ),
    ],
    sizes: sizes(),
    span: "single",
    summary:
      "The marl is spun from two greys rather than printed, so it does not go flat after washing.",
    composition: "85% cotton, 15% viscose, 220gsm.",
    fitNotes: "Straight body, set-in sleeve. True to size.",
    delivery: DELIVERY,
    isNew: false,
    goesWith: ["wide-leg-trouser-slate", "linen-overshirt-bone", "chunky-knit-sand"],
  },
  {
    id: "p-004",
    slug: "heavy-tee-charcoal",
    name: "Heavy Tee in Charcoal",
    category: "tees",
    price: 2400,
    colour: COLOURS.charcoal,
    colours: [COLOURS.charcoal, COLOURS.chalk, COLOURS.black],
    images: [
      img(
        "product-heavy-tee-charcoal-01",
        "A charcoal tee laid flat on a white surface, sleeves folded back",
      ),
    ],
    sizes: sizes("XS", "S"),
    span: "single",
    summary: "The same cut as the grey marl, dyed a charcoal that stays cold rather than fading brown.",
    composition: "100% combed cotton, 220gsm, reactive dyed.",
    fitNotes: "Straight body, set-in sleeve. True to size.",
    delivery: DELIVERY,
    isNew: false,
    goesWith: ["tapered-trouser-black", "ecru-overshirt", "ribbed-knit-ash"],
  },
  {
    id: "p-005",
    slug: "tapered-trouser-black",
    name: "Tapered Trouser in Black",
    category: "trousers",
    price: 5600,
    colour: COLOURS.black,
    colours: [COLOURS.black, COLOURS.slate],
    images: [
      img(
        "product-tapered-trouser-black-01",
        "Black tapered trousers folded once on a white surface, showing the leg line and hem",
      ),
    ],
    sizes: sizes("XL"),
    span: "single",
    summary:
      "Cut close through the leg without gripping it. The waistband sits on the hip, not above it.",
    composition: "98% cotton, 2% elastane, 11oz denim-weight twill.",
    fitNotes:
      "Mid rise, tapered from the knee. Inseam 30\" on XS–M and 32\" on L–XXL, unfinished if you want them shorter.",
    delivery: DELIVERY,
    isNew: false,
    goesWith: ["long-sleeve-tee-black", "merino-crew-charcoal", "ecru-overshirt"],
  },
  {
    id: "p-006",
    slug: "loopback-sweatshirt-chalk",
    name: "Loopback Sweatshirt in Chalk",
    category: "knitwear",
    price: 4200,
    colour: COLOURS.chalk,
    colours: [COLOURS.chalk, COLOURS.slate, COLOURS.bottle],
    images: [
      img(
        "product-loopback-chalk-01",
        "A chalk loopback sweatshirt laid flat beside a pair of white leather trainers and a sprig of eucalyptus",
      ),
    ],
    sizes: sizes(),
    span: "single",
    summary:
      "Loopback rather than brushed fleece, so it breathes indoors and does not pill at the cuff.",
    composition: "100% cotton loopback, 380gsm, undyed.",
    fitNotes: "Boxy, with a ribbed hem that sits at the hip. Size down for a closer fit.",
    delivery: DELIVERY,
    isNew: true,
    goesWith: ["wide-leg-trouser-slate", "heavy-tee-grey-marl", "linen-trouser-chalk"],
  },
  {
    id: "p-007",
    slug: "merino-crew-oat",
    name: "Merino Crew in Oat",
    category: "knitwear",
    price: 6400,
    colour: COLOURS.oat,
    colours: [COLOURS.oat, COLOURS.charcoal, COLOURS.bottle],
    images: [
      img(
        "product-merino-crew-oat-01",
        "Oat and brown merino knits folded in a stack, the top one with a cable panel",
      ),
    ],
    sizes: sizes("S"),
    span: "single",
    summary: "Fine-gauge merino that goes under an overshirt without adding bulk at the shoulder.",
    composition: "100% extra-fine merino wool, 19.5 micron, 12 gauge.",
    fitNotes: "Slim through the body, ribbed at the cuff and hem. True to size.",
    delivery: DELIVERY,
    isNew: false,
    goesWith: ["ecru-overshirt", "linen-trouser-chalk", "washed-twill-trouser-slate"],
  },
  {
    id: "p-008",
    slug: "chunky-knit-sand",
    name: "Chunky Knit in Sand",
    category: "knitwear",
    price: 7200,
    colour: COLOURS.sand,
    colours: [COLOURS.sand, COLOURS.charcoal],
    images: [
      img(
        "product-chunky-knit-sand-01",
        "A sand-coloured chunky rib knit gathered loosely, showing the depth of the stitch",
      ),
    ],
    sizes: sizes("XS", "XXL"),
    span: "single",
    summary: "A three-gauge rib with real weight to it. This is the outer layer on most days.",
    composition: "70% lambswool, 30% alpaca, 3 gauge.",
    fitNotes: "Oversized by design, dropped shoulder. Take your usual size.",
    delivery: DELIVERY,
    isNew: true,
    goesWith: ["wide-leg-trouser-slate", "heavy-tee-grey-marl", "tapered-trouser-black"],
  },
  {
    id: "p-009",
    slug: "merino-crew-charcoal",
    name: "Merino Crew in Charcoal",
    category: "knitwear",
    price: 6400,
    colour: COLOURS.charcoal,
    colours: [COLOURS.charcoal, COLOURS.oat, COLOURS.bottle],
    images: [
      img(
        "product-merino-crew-charcoal-01",
        "Charcoal, chalk and oat merino crews folded in a stack on a dark surface",
      ),
    ],
    wideImage: img(
      "product-merino-crew-charcoal-wide",
      "The charcoal merino crew folded, photographed close and wide on a dark surface",
    ),
    sizes: sizes(),
    span: "wide",
    summary: "The oat crew in a charcoal that reads almost black indoors and grey in daylight.",
    composition: "100% extra-fine merino wool, 19.5 micron, 12 gauge.",
    fitNotes: "Slim through the body, ribbed at the cuff and hem. True to size.",
    delivery: DELIVERY,
    isNew: false,
    goesWith: ["tapered-trouser-black", "ecru-overshirt", "long-sleeve-tee-black"],
  },
  {
    id: "p-010",
    slug: "wide-leg-trouser-slate",
    name: "Wide-Leg Trouser in Slate",
    category: "trousers",
    price: 5800,
    colour: COLOURS.slate,
    colours: [COLOURS.slate, COLOURS.black, COLOURS.stone],
    images: [
      img(
        "product-wide-leg-trouser-slate-01",
        "Slate and charcoal trousers folded on a white chair, showing the width of the leg",
      ),
    ],
    sizes: sizes("XXL"),
    span: "single",
    summary:
      "Full through the leg with a single pleat, so the width falls from the hip rather than the knee.",
    composition: "100% cotton twill, 280gsm, washed.",
    fitNotes:
      "High rise, single forward pleat, 22cm leg opening. Sits long on purpose — hem them if you are under 5'8\".",
    delivery: DELIVERY,
    isNew: true,
    goesWith: ["ecru-overshirt", "loopback-sweatshirt-chalk", "chunky-knit-sand"],
  },
  {
    id: "p-011",
    slug: "lambswool-crew-oat",
    name: "Lambswool Crew in Oat",
    category: "knitwear",
    price: 5400,
    colour: COLOURS.oat,
    colours: [COLOURS.oat, COLOURS.ash],
    images: [
      img(
        "product-lambswool-crew-oat-01",
        "Charcoal, chalk and oat lambswool crews folded in a stack against a dark ground",
      ),
    ],
    sizes: sizes("M"),
    span: "single",
    summary: "Lambswool at seven gauge — warmer than the merino and a little more rustic in the hand.",
    composition: "100% lambswool, 7 gauge, spun in Ludhiana.",
    fitNotes: "Regular through the body. True to size.",
    delivery: DELIVERY,
    isNew: false,
    goesWith: ["washed-twill-trouser-slate", "linen-overshirt-bone", "heavy-tee-charcoal"],
  },
  {
    id: "p-012",
    slug: "linen-overshirt-bone",
    name: "Linen Overshirt in Bone",
    category: "overshirts",
    price: 5200,
    colour: COLOURS.bone,
    colours: [COLOURS.bone, COLOURS.slate, COLOURS.bottle],
    images: [
      img(
        "product-linen-overshirt-bone-01",
        "The bone linen overshirt folded on a dark surface, showing the slub in the weave",
      ),
    ],
    wideImage: img(
      "product-linen-overshirt-bone-wide",
      "The bone linen overshirt folded and photographed wide, the weave catching side light",
    ),
    sizes: sizes("XS"),
    span: "wide",
    summary:
      "The overshirt pattern cut in a heavy Belgian linen. It creases, and it is meant to.",
    composition: "100% linen, 260gsm, woven in Belgium and cut in Bengaluru.",
    fitNotes: "Relaxed, straight hem, same block as the cotton overshirt. Take the smaller size between two.",
    delivery: DELIVERY,
    isNew: true,
    goesWith: ["linen-trouser-chalk", "heavy-tee-grey-marl", "merino-crew-oat"],
  },
  {
    id: "p-013",
    slug: "linen-trouser-chalk",
    name: "Linen Trouser in Chalk",
    category: "trousers",
    price: 4600,
    colour: COLOURS.chalk,
    colours: [COLOURS.chalk, COLOURS.stone, COLOURS.slate],
    images: [
      img(
        "product-linen-trouser-chalk-01",
        "Chalk and stone linen trousers folded in a stack on a wooden bench, fringed edges showing",
      ),
    ],
    sizes: sizes("L", "XXL"),
    span: "single",
    summary: "A drawstring trouser in washed linen. The only piece here that is genuinely for the heat.",
    composition: "100% washed linen, 190gsm.",
    fitNotes: "Elasticated back with a drawstring front, straight leg. True to size.",
    delivery: DELIVERY,
    isNew: false,
    goesWith: ["linen-overshirt-bone", "loopback-sweatshirt-chalk", "heavy-tee-grey-marl"],
  },
  {
    id: "p-014",
    slug: "cotton-overshirt-stone",
    name: "Cotton Overshirt in Stone",
    category: "overshirts",
    price: 4900,
    colour: COLOURS.stone,
    colours: [COLOURS.stone, COLOURS.ecru, COLOURS.charcoal],
    images: [
      img(
        "product-cotton-overshirt-stone-01",
        "Stone and chalk cotton overshirts folded in a stack on a wooden bench",
      ),
    ],
    sizes: sizes(),
    span: "single",
    summary: "The ecru overshirt in a colder, greyer stone. Easier to wear with black than the ecru is.",
    composition: "100% cotton twill, 320gsm, washed twice.",
    fitNotes: "Relaxed through the chest and shoulder, straight at the hem. Take the smaller size between two.",
    delivery: DELIVERY,
    isNew: false,
    goesWith: ["tapered-trouser-black", "merino-crew-charcoal", "heavy-tee-charcoal"],
  },
  {
    id: "p-015",
    slug: "ribbed-knit-ash",
    name: "Ribbed Knit in Ash",
    category: "knitwear",
    price: 6800,
    colour: COLOURS.ash,
    colours: [COLOURS.ash, COLOURS.bottle],
    images: [
      img(
        "product-ribbed-knit-ash-01",
        "An ash-grey ribbed knit in soft folds, the rib running the length of the cloth",
      ),
    ],
    wideImage: img(
      "product-ribbed-knit-ash-wide",
      "The ash ribbed knit photographed wide and close, showing the rib and the weight of the yarn",
    ),
    sizes: sizes("S", "XXL"),
    span: "wide",
    summary: "A five-gauge rib that holds a shape through the body without being tight.",
    composition: "60% merino wool, 40% cotton, 5 gauge.",
    fitNotes: "Regular through the body, long in the sleeve. True to size.",
    delivery: DELIVERY,
    isNew: false,
    goesWith: ["wide-leg-trouser-slate", "tapered-trouser-black", "linen-overshirt-bone"],
  },
  {
    id: "p-016",
    slug: "washed-twill-trouser-slate",
    name: "Washed Twill Trouser in Slate",
    category: "trousers",
    price: 5200,
    colour: COLOURS.slate,
    colours: [COLOURS.slate, COLOURS.stone],
    images: [
      img(
        "product-washed-twill-trouser-slate-01",
        "Slate washed-twill cloth in loose folds, showing the grain of the weave",
      ),
    ],
    sizes: sizes("XS", "XL"),
    span: "single",
    summary: "A straight trouser in twill that has been washed soft. The one to wear when denim is too much.",
    composition: "100% cotton twill, 300gsm, garment washed.",
    fitNotes: "Mid rise, straight leg, no pleat. True to size.",
    delivery: DELIVERY,
    isNew: false,
    goesWith: ["lambswool-crew-oat", "cotton-overshirt-stone", "heavy-tee-grey-marl"],
  },
];

export const COLLECTIONS: Collection[] = [
  {
    id: "c-001",
    slug: "overshirts",
    title: "Overshirts",
    blurb: "Four cuts, one block. The layer that does most of the work.",
    image: img(
      "collection-overshirts",
      "Pale overshirts hanging on wooden hangers on a rail against a dark wall",
    ),
    pieceCount: 3,
  },
  {
    id: "c-002",
    slug: "trousers",
    title: "Trousers",
    blurb: "Wide, tapered and straight, in twill and washed linen.",
    image: img(
      "collection-trousers",
      "Black tapered trousers folded once on a white surface",
    ),
    pieceCount: 4,
  },
  {
    id: "c-003",
    slug: "knitwear",
    title: "Knitwear",
    blurb: "Merino at twelve gauge for under things, lambswool and alpaca for over them.",
    image: img(
      "collection-knitwear",
      "A sand-coloured chunky rib knit gathered loosely to show the stitch",
    ),
    pieceCount: 6,
  },
  {
    id: "c-004",
    slug: "tees",
    title: "Tees",
    blurb: "Two weights, bound necks, cut long enough to stay tucked.",
    image: img(
      "collection-tees",
      "A charcoal tee laid flat on a white surface with the sleeves folded back",
    ),
    pieceCount: 3,
  },
];

/** Calmest first — on the home page only the first one is reached. */
export const LOOKBOOK: LookbookImage[] = [
  {
    id: "l-001",
    image: img(
      "lookbook-02",
      "A clothing rail against a plain wall with a potted plant beside it",
    ),
  },
  {
    id: "l-002",
    image: img(
      "lookbook-03",
      "Folded knitwear stacked on a white moulded chair",
    ),
  },
  {
    id: "l-003",
    image: img(
      "lookbook-01",
      "A rail of pale overshirts and knitwear, hung close together",
    ),
  },
];

export const HERO_IMAGE = img(
  "hero-collection-01",
  "Someone standing at a white plaster wall in a cream overshirt, seen from behind",
);

export const EDITORIAL_IMAGE = img(
  "editorial-fabric-01",
  "Grey cotton twill in deep folds, photographed close in raking light",
);

export const AUTH_IMAGE = img(
  "auth-panel-01",
  "A long trench coat caught mid-movement against a plain grey wall",
);

export const EMPTY_RAIL_IMAGE = img(
  "state-empty-rail",
  "An empty clothing rail with four bare hangers against a pale wall",
);
