#!/usr/bin/env python3
"""Regenerate lib/mock/imageSizes.ts from the files in public/images.

Run from the client directory after adding or re-encoding an image:

    python3 scripts/image-sizes.py

Reading the real intrinsic size off disk is what keeps every <Image> from
shipping without width and height, which is what causes layout shift.
"""
import os
from PIL import Image

SRC = "public/images"
DEST = "lib/mock/imageSizes.ts"

rows = []
for f in sorted(os.listdir(SRC)):
    if f.endswith(".jpg"):
        with Image.open(os.path.join(SRC, f)) as im:
            rows.append((os.path.splitext(f)[0], im.width, im.height))

with open(DEST, "w") as out:
    out.write(
        "/**\n"
        " * Generated from the files in public/images by scripts/image-sizes.py.\n"
        " * Every <Image> gets its real intrinsic size from here, so no tile can\n"
        " * ship without dimensions and the grid never shifts as photographs load.\n"
        " * Regenerate after adding or re-encoding an image.\n"
        " */\n\n"
        "export interface IntrinsicSize {\n  width: number;\n  height: number;\n}\n\n"
        "export const IMAGE_SIZES = {\n"
    )
    for name, w, h in rows:
        out.write(f'  "{name}": {{ width: {w}, height: {h} }},\n')
    out.write("} as const satisfies Record<string, IntrinsicSize>;\n\n")
    out.write("export type ImageName = keyof typeof IMAGE_SIZES;\n")

print(f"{len(rows)} sizes written to {DEST}")
