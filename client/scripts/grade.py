#!/usr/bin/env python3
"""Impose one look on images from many sources.

Grey-world white balance, heavy desaturation, luminance match to a common
target, and a shared contrast curve. The point is that the set agrees with
itself, not that any single frame is improved.
"""
import sys, os
from PIL import Image
import numpy as np

WB = 0.75          # how far to push toward neutral grey
SAT = 0.40         # saturation retained
TARGET_L = 0.50    # mean luminance every frame is pulled toward
L_PULL = 0.60      # how far toward TARGET_L
CONTRAST = 1.10    # shared S-curve strength
BLACK_PCT = 0.4    # percentile re-anchored to black, so blacks stay black
TINT = np.array([0.994, 1.000, 1.004])  # a whisper cool, to sit on stone

def srgb_to_lin(x):
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)

def lin_to_srgb(x):
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * x ** (1 / 2.4) - 0.055)

def grade(path, out):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.float64) / 255.0
    lin = srgb_to_lin(a)

    # 1. grey-world white balance
    means = lin.reshape(-1, 3).mean(axis=0)
    grey = means.mean()
    gain = (grey / np.maximum(means, 1e-6)) ** WB
    lin *= gain

    # 2. desaturate toward luminance
    lum = (lin * [0.2126, 0.7152, 0.0722]).sum(axis=2, keepdims=True)
    lin = lum + (lin - lum) * SAT

    # 3. pull mean luminance to the common target
    cur = float(np.clip(lum, 0, 1).mean())
    if cur > 1e-6:
        lin *= (TARGET_L / cur) ** L_PULL

    # 4. re-anchor the black point — the luminance gain above lifts shadows
    #    and leaves everything hazy, which flattens a black garment to grey
    lin = np.clip(lin, 0, 1)
    floor = np.percentile(lin, BLACK_PCT)
    lin = np.clip((lin - floor) / max(1.0 - floor, 1e-6), 0, 1)

    # 5. shared contrast curve around mid grey, then a cool whisper
    lin = 0.18 * (lin / 0.18) ** CONTRAST
    lin *= TINT

    Image.fromarray((lin_to_srgb(lin) * 255).round().astype(np.uint8)).save(
        out, "JPEG", quality=88, optimize=True, progressive=True
    )

if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    os.makedirs(dst, exist_ok=True)
    keep = sys.argv[3:] or None
    for f in sorted(os.listdir(src)):
        if not f.endswith(".jpg"):
            continue
        if keep and os.path.splitext(f)[0] not in keep:
            continue
        grade(os.path.join(src, f), os.path.join(dst, f))
    print("graded ->", dst, len(os.listdir(dst)))
