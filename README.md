# Fashify

A contemporary unisex clothing label — considered everyday pieces in cotton,
linen and merino. Overshirts, wide-leg trousers, knitwear and heavy tees, at
₹2,200 to ₹7,200 a piece, sold across India.

This repository holds two applications that never import from each other:

```
fashify/
├── client/     Next.js App Router + TypeScript + Tailwind. All of Phase 1.
└── server/     Express + MongoDB. Phase 2. See server/README.md.
```

## Phase 1 is the interface only

Every screen renders from local, typed mock data in `client/lib/mock/`. There
is no server, no database, no auth and no persistence. What that means in
practice:

- **Filters and sort respond but do not narrow the grid.** Selections are kept
  and can be cleared, and the counts beside each option are derived from the
  real catalogue. The filtering itself belongs on the server in Phase 2, and
  faking it client-side now would mean throwing that work away.
- **Forms have no validation logic.** The error, focus and filled states are
  real styled markup driven by props, so you can look at all three, but
  nothing is checked and nothing is submitted.
- **Payment is UI only.** No provider is connected and nothing is charged.
- **The bag lives in memory.** Adding, removing and changing quantities all
  work for the session and are gone on reload.
- **The admin saves nothing.** Sorting the products table is real; the forms,
  the image dropzone and the row actions are styled and inert.

## Running it

```bash
cd client
npm install
npm run dev          # http://localhost:3000
```

Other useful commands, all from `client/`:

```bash
npm run build        # production build; typechecks as it goes
npm run lint
npx tsc --noEmit
python3 scripts/image-sizes.py    # regenerate lib/mock/imageSizes.ts
```

To see the loading skeletons, give the mock data layer some latency. Without
it the local arrays resolve too fast for a suspense boundary to show:

```bash
MOCK_LATENCY_MS=1200 npm run dev
```

Note that `npm run build` prerenders every route, so `loading.tsx` only
appears in development — in production these pages are already static HTML.

## Screens

| Route | What it is |
| --- | --- |
| `/` | Hero, collection rail, the irregular grid, a bottle-green editorial block |
| `/shop` | The whole collection, filter column on desktop and a bottom sheet on phones |
| `/shop/[slug]` | Product detail. All sixteen exist; `ecru-overshirt` is the one built out with five photographs |
| `/checkout` | Contact, delivery and payment, with the order summary pinned alongside |
| `/sign-in`, `/sign-up` | Styled forms, no logic |
| `/admin` | Overview, products table, add product, orders |
| anything else | A real 404 |

The bag is a slide-over drawer rather than a page, reachable from the header on
any storefront screen.

## How the data layer is shaped

Everything in `client/lib/mock/` is an `async` function returning a typed
promise, and the types in `types.ts` are written as API response shapes rather
than as convenient view models:

```ts
export async function getProduct(slug: string): Promise<Product | null>
```

In Phase 2 each of those bodies becomes a `fetch` against `server/` and no
caller changes. Pages are server components that `await` these; only the
interactive leaves are client components.

The one piece of shared client state is `BagProvider` — the header count and
the drawer contents have to agree, which local component state cannot do. It
is a single React context, in memory, with no persistence.

## Design

Tokens live in `client/app/globals.css`, because Tailwind v4 takes its theme
from CSS rather than from a `tailwind.config` file.

- **Stone** `#E6E7E2` page base, a cool pale stone rather than a warm cream
- **Bottle** `#16261E` hero, footer, editorial blocks, 404
- **Ink** `#14201A` body text — a dark green from the bottle family, not a
  neutral near-black
- **Mist** `#5A625B` secondary text. Darker than a mid grey on purpose: the
  obvious choice reaches only 3.5:1 on stone and fails AA at body size
- **Brass** `#A87C32` the only accent, and never as text — it is 3.0:1 on
  stone and 4.2:1 on bottle, which passes for a mark and fails for a word. It
  appears five times: the focus ring, the dot beside the bag count, the current
  checkout step, the newsletter underline, and the low-stock dot in admin

Display type is **Bodoni Moda** with its optical size axis driven up, which is
the reason to choose a Didone over a generic serif. Body and UI type is
**Archivo**, with `tabular-nums` on every price, size and figure — that is the
only thing a monospace face would have been doing.

Nothing has a corner radius, a shadow or a border on a product tile: the
photograph is the tile. The grid is deliberately uneven — some pieces span two
columns, a lookbook photograph breaks the full width every six or seven, and on
wide screens every second column drops down so the baseline never settles.

Motion is one orchestrated sequence in the hero on load, and after that only in
answer to something you did: a drawer opening, a size being chosen, an image
changing. `prefers-reduced-motion` stops all of it.

## Photographs

The 35 images in `client/public/images/` are from Unsplash, downloaded rather
than hotlinked, cropped server-side to exact aspect ratios and then put through
one shared grade — neutral white balance, heavy desaturation, a common
luminance target and one contrast curve — so that a set shot by many different
photographers reads as a single shoot. Consistency across the set matters more
than any individual frame.

Every file is a progressive JPEG under 300KB, and `lib/mock/imageSizes.ts` is
generated from the files on disk so no `<Image>` can ship without dimensions.

See `IMAGE-CREDITS.md`.

## Quality floor

- Built phone-first and checked at 375, 390, 768, 1280 and 1600px; no screen
  scrolls sideways at any of them
- Bottom sheet for filters, scroll-snap gallery, 44px minimum tap targets,
  `env(safe-area-inset-bottom)` respected on the fixed buy bar and drawers
- The bag drawer and filter sheet trap focus, close on Escape and return focus
  where it came from; a closed panel carries no dialog role
- Visible keyboard focus on everything interactive
- Real alt text describing the photograph, not the product name repeated
- Semantic heading order, and colour contrast that passes AA for all text
- No layout shift: every image has real intrinsic dimensions

## Not in Phase 1

No Express, MongoDB, Mongoose, Firebase or JWT. No cart persistence, working
filters or search, no payment integration, no image uploads, no tests.
