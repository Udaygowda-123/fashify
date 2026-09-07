#!/usr/bin/env python3
"""Fetch, crop and grade every image the site needs.

Run from the client directory, with Pillow and numpy available:

    python3 scripts/build-images.py public/images

Then regenerate the size map:

    python3 scripts/image-sizes.py


The CDN does the crop server-side at the exact aspect we ask for, so the whole
set shares framing; grade.py then imposes one look on top. Output is
progressive JPEG stepped down in quality until it clears the size budget.
"""
import os, subprocess, sys
from PIL import Image
import grade as G  # scripts/grade.py

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
BUDGET = 300 * 1024

# name, unsplash id, width, height
# Only ids whose graded output has been reviewed on a contact sheet appear
# here. Anything with a colour cast the grade could not pull into line — a
# blush stack, a satin stack, a tee on pink graffiti — was cut rather than
# kept to hit a count.
MANIFEST = [
    # hero + editorial + lookbook
    ("hero-collection-01",        "photo-1597329298743-c10a9ddcdd45", 2400, 1350),
    ("hero-collection-02",        "photo-1591357037205-166318b51afd", 2400, 1350),
    ("editorial-fabric-01",       "photo-1518019671582-55004f1bc9ab", 2000, 1250),
    ("lookbook-01",               "photo-1445205170230-053b83016050", 2000,  860),
    ("lookbook-02",               "photo-1603400521630-9f2de124b33b", 2000,  860),
    ("lookbook-03",               "photo-1504198458649-3128b932f49e", 2000,  860),
    # collection rail (4:5)
    ("collection-overshirts",     "photo-1604506847073-4a8e18e07d92", 1200, 1500),
    ("collection-trousers",       "photo-1718252540511-e958742e4165", 1200, 1500),
    ("collection-knitwear",       "photo-1670080589800-6416c8ce8a14", 1200, 1500),
    ("collection-tees",           "photo-1737094540214-261561588b89", 1200, 1500),
    # auth panel + empty states
    ("auth-panel-01",             "photo-1668952135120-7d997b1b3778", 1200, 1600),
    ("state-empty-rail",          "photo-1612172382914-0732055246e7", 1200,  900),
    # wide grid tiles — a landscape crop of that product's own frame, so a
    # wide tile is the same garment, not a different photograph
    ("product-linen-overshirt-bone-wide",  "photo-1709626142596-f99fda8e68f1", 1600, 1067),
    ("product-merino-crew-charcoal-wide",  "photo-1548768041-2fceab4c0b85",    1600, 1067),
    ("product-ribbed-knit-ash-wide",       "photo-1599753931952-654e960af582", 1600, 1067),
    # products (3:4)
    ("product-ecru-overshirt-01",        "photo-1604506847073-4a8e18e07d92", 1400, 1867),
    ("product-heavy-tee-black-01",       "photo-1618354691551-44de113f0164", 1400, 1867),
    ("product-heavy-tee-grey-01",        "photo-1564584217132-2271feaeb3c5", 1400, 1867),
    ("product-heavy-tee-charcoal-01",    "photo-1737094540214-261561588b89", 1400, 1867),
    ("product-tapered-trouser-black-01", "photo-1718252540511-e958742e4165", 1400, 1867),
    ("product-loopback-chalk-01",        "photo-1620799140408-edc6dcb6d633", 1400, 1867),
    ("product-merino-crew-oat-01",       "photo-1571139627661-cf707929f465", 1400, 1867),
    ("product-chunky-knit-sand-01",      "photo-1670080589800-6416c8ce8a14", 1400, 1867),
    ("product-merino-crew-charcoal-01",  "photo-1548768041-2fceab4c0b85",    1400, 1867),
    ("product-wide-trouser-slate-01",    "photo-1504198458649-3128b932f49e", 1400, 1867),
    ("product-lambswool-crew-oat-01",    "photo-1542219550-2da790bf52e9",    1400, 1867),
    ("product-linen-overshirt-bone-01",  "photo-1709626142596-f99fda8e68f1", 1400, 1867),
    ("product-linen-trouser-chalk-01",   "photo-1591625591034-75d303d2e1a4", 1400, 1867),
    ("product-cotton-overshirt-stone-01","photo-1596433904500-97b901c5d274", 1400, 1867),
    ("product-ribbed-knit-ash-01",       "photo-1599753931952-654e960af582", 1400, 1867),
    ("product-twill-trouser-slate-01",   "photo-1715867125247-120c0fc4593b", 1400, 1867),
    # the one fully built product: four further angles
    ("product-ecru-overshirt-02",       "photo-1705290304455-35ffb433f560", 1400, 1867),
    ("product-ecru-overshirt-03",       "photo-1643209444864-de08a545289a", 1400, 1867),
    ("product-ecru-overshirt-04",       "photo-1523212727988-82c430c79c8e", 1400, 1867),
    ("product-ecru-overshirt-05",       "photo-1518019671582-55004f1bc9ab", 1400, 1867),
]


def fetch(uid, w, h, dest):
    url = (f"https://images.unsplash.com/{uid}"
           f"?w={w}&h={h}&fit=crop&crop=entropy&q=90&fm=jpg")
    r = subprocess.run(["curl", "-sSL", "--max-time", "90", url, "-o", dest,
                        "-w", "%{http_code}"], capture_output=True, text=True)
    return r.stdout.strip()


def save_within_budget(img, path):
    """Trade pixels before quality. Dropping below ~q68 bands a plain wall
    visibly, so once we hit that floor we shrink the image instead."""
    for scale in (1.0, 0.88, 0.78, 0.68):
        w, h = int(img.width * scale), int(img.height * scale)
        cand = img if scale == 1.0 else img.resize((w, h), Image.LANCZOS)
        for q in (86, 80, 74, 68):
            cand.save(path, "JPEG", quality=q, optimize=True, progressive=True)
            if os.path.getsize(path) <= BUDGET:
                return q, os.path.getsize(path), w, h
    return q, os.path.getsize(path), w, h


os.makedirs(OUT, exist_ok=True)
os.makedirs("raw", exist_ok=True)
rows = []
for name, uid, w, h in MANIFEST:
    raw = f"raw/{name}.jpg"
    if not os.path.exists(raw) or os.path.getsize(raw) < 1000:
        code = fetch(uid, w, h, raw)
        if code != "200":
            print("FAIL", name, code, uid)
            continue
    tmp = f"raw/{name}.graded.jpg"
    G.grade(raw, tmp)
    im = Image.open(tmp)
    q, sz, fw, fh = save_within_budget(im, os.path.join(OUT, f"{name}.jpg"))
    rows.append((name, fw, fh, q, sz, uid))
    print(f"{name:44s} {fw}x{fh:<5} q{q} {sz//1024}KB")

over = [r for r in rows if r[4] > BUDGET]
print(f"\n{len(rows)} images, {sum(r[4] for r in rows)//1024}KB total, "
      f"{len(over)} over budget")
with open("manifest.tsv", "w") as f:
    for r in rows:
        f.write("\t".join(str(x) for x in r) + "\n")
