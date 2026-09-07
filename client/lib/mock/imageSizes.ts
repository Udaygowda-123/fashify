/**
 * Generated from the files in public/images by scripts/image-sizes.py.
 * Every <Image> gets its real intrinsic size from here, so no tile can
 * ship without dimensions and the grid never shifts as photographs load.
 * Regenerate after adding or re-encoding an image.
 */

export interface IntrinsicSize {
  width: number;
  height: number;
}

export const IMAGE_SIZES = {
  "auth-panel-01": { width: 2400, height: 1350 },
  "collection-knitwear": { width: 1200, height: 1500 },
  "collection-overshirts": { width: 1200, height: 1500 },
  "collection-tees": { width: 1200, height: 1500 },
  "collection-trousers": { width: 1200, height: 1500 },
  "editorial-fabric-01": { width: 1760, height: 1100 },
  "hero-collection-01": { width: 2112, height: 1188 },
  "lookbook-01": { width: 2000, height: 860 },
  "lookbook-02": { width: 2000, height: 860 },
  "lookbook-03": { width: 2000, height: 860 },
  "product-chunky-knit-sand-01": { width: 1232, height: 1642 },
  "product-cotton-overshirt-stone-01": { width: 1400, height: 1867 },
  "product-ecru-overshirt-01": { width: 1400, height: 1867 },
  "product-ecru-overshirt-02": { width: 1400, height: 1867 },
  "product-ecru-overshirt-03": { width: 1232, height: 1642 },
  "product-ecru-overshirt-04": { width: 1400, height: 1867 },
  "product-ecru-overshirt-05": { width: 1400, height: 1867 },
  "product-heavy-tee-black-01": { width: 1400, height: 1867 },
  "product-heavy-tee-charcoal-01": { width: 1400, height: 1867 },
  "product-heavy-tee-grey-marl-01": { width: 1400, height: 1867 },
  "product-lambswool-crew-oat-01": { width: 1092, height: 1456 },
  "product-linen-overshirt-bone-01": { width: 1400, height: 1867 },
  "product-linen-overshirt-bone-wide": { width: 1600, height: 1067 },
  "product-linen-trouser-chalk-01": { width: 1400, height: 1867 },
  "product-loopback-chalk-01": { width: 1400, height: 1867 },
  "product-merino-crew-charcoal-01": { width: 1092, height: 1456 },
  "product-merino-crew-charcoal-wide": { width: 1600, height: 1067 },
  "product-merino-crew-oat-01": { width: 1400, height: 1867 },
  "product-ribbed-knit-ash-01": { width: 1400, height: 1867 },
  "product-ribbed-knit-ash-wide": { width: 1600, height: 1067 },
  "product-tapered-trouser-black-01": { width: 1400, height: 1867 },
  "product-washed-twill-trouser-slate-01": { width: 868, height: 1157 },
  "product-wide-leg-trouser-slate-01": { width: 1400, height: 1867 },
  "state-empty-rail": { width: 1200, height: 900 },
} as const satisfies Record<string, IntrinsicSize>;

export type ImageName = keyof typeof IMAGE_SIZES;
