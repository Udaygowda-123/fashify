import { describe, expect, it } from "vitest";
import { listProducts } from "../src/services/catalog.service.js";
import { makeProduct, makeVariant } from "./factories.js";

function countOf(
  facets: Awaited<ReturnType<typeof listProducts>>["facets"],
  group: string,
  value: string,
): number {
  return (
    facets.find((f) => f.id === group)?.options.find((o) => o.value === value)?.count ?? 0
  );
}

/**
 * A small, hand-built catalogue where every count can be worked out on paper:
 *
 *   overshirt-a  overshirts  ₹4,800  ecru M+L, slate M
 *   overshirt-b  overshirts  ₹5,200  slate L (only)
 *   knit-a       knitwear    ₹6,400  oat M, oat L
 *   tee-a        tees        ₹2,400  black M (sold out), black L
 */
async function buildCatalogue() {
  const overshirtA = await makeProduct({ slug: "overshirt-a", category: "overshirts" });
  await makeVariant({ productId: overshirtA._id, onHand: 5, size: "M", colourSlug: "ecru", priceRupees: 4800 });
  await makeVariant({ productId: overshirtA._id, onHand: 5, size: "L", colourSlug: "ecru", priceRupees: 4800 });
  await makeVariant({ productId: overshirtA._id, onHand: 5, size: "M", colourSlug: "slate", priceRupees: 4800 });

  const overshirtB = await makeProduct({ slug: "overshirt-b", category: "overshirts" });
  await makeVariant({ productId: overshirtB._id, onHand: 4, size: "L", colourSlug: "slate", priceRupees: 5200 });

  const knitA = await makeProduct({ slug: "knit-a", category: "knitwear" });
  await makeVariant({ productId: knitA._id, onHand: 3, size: "M", colourSlug: "oat", priceRupees: 6400 });
  await makeVariant({ productId: knitA._id, onHand: 3, size: "L", colourSlug: "oat", priceRupees: 6400 });

  const teeA = await makeProduct({ slug: "tee-a", category: "tees" });
  // Sold out in M, so M must not be offered for this piece.
  await makeVariant({ productId: teeA._id, onHand: 0, size: "M", colourSlug: "black", priceRupees: 2400 });
  await makeVariant({ productId: teeA._id, onHand: 6, size: "L", colourSlug: "black", priceRupees: 2400 });
}

describe("faceted search", () => {
  it("counts products, not variants, and excludes sold-out combinations", async () => {
    await buildCatalogue();
    const page = await listProducts({ limit: 20, sort: "featured" });

    expect(page.total).toBe(4);

    expect(countOf(page.facets, "category", "overshirts")).toBe(2);
    expect(countOf(page.facets, "category", "knitwear")).toBe(1);
    expect(countOf(page.facets, "category", "tees")).toBe(1);

    // M: overshirt-a, knit-a. Not overshirt-b (L only) and not tee-a (M is
    // sold out, so it is not a size you can actually pick).
    expect(countOf(page.facets, "size", "M")).toBe(2);
    // L: all four.
    expect(countOf(page.facets, "size", "L")).toBe(4);

    expect(countOf(page.facets, "colour", "slate")).toBe(2);
    expect(countOf(page.facets, "colour", "ecru")).toBe(1);
    expect(countOf(page.facets, "colour", "oat")).toBe(1);

    // Bands are on the product's lowest price.
    expect(countOf(page.facets, "price", "under-3000")).toBe(1);
    expect(countOf(page.facets, "price", "3000-5000")).toBe(1);
    expect(countOf(page.facets, "price", "5000-7000")).toBe(2);
  });

  it("keeps a facet's own counts open while narrowing the others", async () => {
    await buildCatalogue();
    const page = await listProducts({
      limit: 20,
      sort: "featured",
      category: ["overshirts"],
    });

    expect(page.total).toBe(2);
    expect(page.items.every((item) => item.category === "overshirts")).toBe(true);

    /**
     * The rule that makes faceted filtering usable: the category facet must
     * still show what is available in the OTHER categories, or selecting one
     * drops the rest to zero and the shopper can never switch.
     */
    expect(countOf(page.facets, "category", "knitwear")).toBe(1);
    expect(countOf(page.facets, "category", "tees")).toBe(1);

    // The other facets do narrow to overshirts.
    expect(countOf(page.facets, "size", "M")).toBe(1); // overshirt-a only
    expect(countOf(page.facets, "colour", "oat")).toBe(0); // knitwear's colour
    expect(countOf(page.facets, "colour", "slate")).toBe(2);
  });

  it("combines variant filters on a single variant, not across the product", async () => {
    await buildCatalogue();

    // overshirt-a has ecru in M and slate in M, but no slate in L.
    // overshirt-b has slate in L.
    const page = await listProducts({
      limit: 20,
      sort: "featured",
      size: ["L"],
      colour: ["slate"],
    });

    // Only overshirt-b actually exists as a slate L. Matching overshirt-a
    // because it has "some L" and "some slate" separately would offer a
    // combination that cannot be bought.
    expect(page.items.map((item) => item.slug)).toEqual(["overshirt-b"]);
    expect(page.total).toBe(1);
  });

  it("narrows the size facet by the active colour", async () => {
    await buildCatalogue();
    const page = await listProducts({ limit: 20, sort: "featured", colour: ["slate"] });

    // Slate exists in M (overshirt-a) and L (overshirt-b).
    expect(countOf(page.facets, "size", "M")).toBe(1);
    expect(countOf(page.facets, "size", "L")).toBe(1);
    // The colour facet stays open so slate can be swapped for ecru.
    expect(countOf(page.facets, "colour", "ecru")).toBe(1);
  });

  it("returns no matches, with the facets still usable, for an empty combination", async () => {
    await buildCatalogue();
    const page = await listProducts({
      limit: 20,
      sort: "featured",
      colour: ["oat"],
      category: ["tees"],
    });

    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
    // The shopper can still see where to go from here.
    expect(countOf(page.facets, "category", "knitwear")).toBe(1);
  });

  it("sorts by price in both directions", async () => {
    await buildCatalogue();

    const cheap = await listProducts({ limit: 20, sort: "price-asc" });
    expect(cheap.items[0]?.slug).toBe("tee-a");

    const dear = await listProducts({ limit: 20, sort: "price-desc" });
    expect(dear.items[0]?.slug).toBe("knit-a");
  });

  it("pages with a cursor without repeating or skipping a row", async () => {
    await buildCatalogue();

    const seen: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 5; page += 1) {
      const result = await listProducts({
        limit: 2,
        sort: "newest",
        cursor: cursor ?? undefined,
      });
      seen.push(...result.items.map((item) => item.slug));
      cursor = result.nextCursor;
      if (!cursor) break;
    }

    expect(seen).toHaveLength(4);
    expect(new Set(seen).size).toBe(4);
  });
});
