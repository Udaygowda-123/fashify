# server — Phase 2

Nothing here yet. This directory is for the Express + MongoDB API that the
client will talk to over REST. It is deliberately empty so that Phase 1 stays
what it says it is.

`client/` must never import from this directory, and this directory must never
import from `client/`. The only contract between them is HTTP.

## What goes here

An Express app with Mongoose models, serving JSON that matches the types
already written in `client/lib/mock/types.ts`. Those types were written as API
response shapes for exactly this reason — ids, ISO 8601 date strings, nested
`images: ImageAsset[]`, `sizes: SizeAvailability[]` — so the endpoints below
can be built against them without renegotiating the shape.

## Endpoints the client already expects

Each function in `client/lib/mock/index.ts` becomes one call. The mapping is
one to one, and the client's function signatures should not have to change:

| Mock function | Endpoint |
| --- | --- |
| `getProducts()` | `GET /api/products` |
| `getProduct(slug)` | `GET /api/products/:slug` |
| `getProductsByCategory(c)` | `GET /api/products?category=:c` |
| `getRelatedProducts(slug)` | `GET /api/products/:slug/related` |
| `getNewArrivals(limit)` | `GET /api/products?sort=newest&limit=:n` |
| `getCollections()` | `GET /api/collections` |
| `getLookbook()` | `GET /api/lookbook` |
| `getFilterGroups()` | `GET /api/products/filters` |
| `getSortOptions()` | static, can stay client-side |
| `getInitialBag()` | `GET /api/bag` |
| `getOrders()` | `GET /api/admin/orders` |
| `getStockAlerts()` | `GET /api/admin/stock-alerts` |
| `getAdminFigures()` | `GET /api/admin/figures` |
| `getAdminProducts()` | `GET /api/admin/products` |

Writes that Phase 1 mocks in memory and will need real endpoints:

- `POST /api/bag`, `PATCH /api/bag/:lineId`, `DELETE /api/bag/:lineId`
- `POST /api/orders` — checkout
- `POST /api/auth/sign-up`, `POST /api/auth/sign-in`, `POST /api/auth/sign-out`
- `POST /api/admin/products`, `PATCH /api/admin/products/:id`
- `PATCH /api/admin/orders/:id` — status changes
- `POST /api/admin/uploads` — product photographs

## What Phase 1 left for the server on purpose

These are the places where the interface is finished but the behaviour is not,
so they are the first things to wire up:

- **Filtering and sorting the collection.** `ShopControls` keeps and clears the
  selection and shows real counts, but does not narrow the grid. Filtering
  belongs in a query, not in the browser. The no-matches empty state is already
  built and wired to `ProductGrid`'s empty branch — it is simply unreachable
  until a query can return nothing.
- **Form validation.** `Field` and `SelectField` already render error, focus and
  filled states from props; they need a real source of errors.
- **Cart persistence.** `BagProvider` is in-memory. Its interface —
  `addToBag`, `removeLine`, `setLineQuantity` — is what the endpoints should
  satisfy.
- **Colour switching on a product.** Choosing a colour updates the label but
  not the photographs, because Phase 1 has one photographed colourway per
  piece. Real variants need their own image sets.
- **Auth.** `/sign-in` and `/sign-up` post nowhere. There is no session, and
  `/admin` is not protected — it is a public route in Phase 1 and must not stay
  that way.
- **The newsletter field** in the footer swallows its submit and shows a
  confirmation without sending anything.

## Running it, once it exists

```bash
cd server
npm install
npm run dev
```

The client should reach it through a single base URL in one place, so that
swapping the mock bodies for `fetch` calls touches `client/lib/mock/` and
nothing else.
