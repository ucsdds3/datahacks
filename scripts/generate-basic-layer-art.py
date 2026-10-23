"""
Basic stand-in backdrops for the two layers that have no art yet: Lush caves
(tracks) and the End city (speakers). Placeholders until the design team draws
the real ones, built to the same rules as the other reliefs in
public/images/minecraft/relief/README.md: flat front elevation, square
Minecraft-scale blocks, a quiet middle for text, material running off the top
and bottom edges, stepped edges only on the left and right.

    python3 scripts/generate-basic-layer-art.py

Writes 08-lush-caves.webp and 09-end-city.webp (1536x1024) next to the others.
"""

from __future__ import annotations

import random
from pathlib import Path

from PIL import Image

W, H = 1536, 1024
BLOCK = 48          # one Minecraft block
TEXEL = BLOCK // 16  # 16x16 texture per block, like vanilla
COLS, ROWS = W // BLOCK, -(-H // BLOCK)
OUT = Path(__file__).resolve().parent.parent / "public/images/minecraft/relief"


def shade(rgb, amount):
    return tuple(max(0, min(255, int(c * amount))) for c in rgb)


def paint_block(img, col, row, base, rng, variance=0.10, speckle=None):
    """A block's 16x16 texture: per-texel noise around a base colour, optional ore-like speckles."""
    px = img.load()
    x0, y0 = col * BLOCK, row * BLOCK
    for ty in range(16):
        for tx in range(16):
            c = shade(base, 1 + rng.uniform(-variance, variance))
            if speckle and rng.random() < speckle[1]:
                c = shade(speckle[0], 1 + rng.uniform(-0.08, 0.08))
            for dy in range(TEXEL):
                for dx in range(TEXEL):
                    x, y = x0 + tx * TEXEL + dx, y0 + ty * TEXEL + dy
                    if x < W and y < H:
                        px[x, y] = c


def edge_depth(rng):
    """How many blocks the decorated border reaches in from each side, per row: a stepped, uneven edge."""
    depths, d = [], rng.randint(3, 5)
    for _ in range(ROWS):
        d = max(2, min(7, d + rng.choice([-1, 0, 0, 1])))
        depths.append(d)
    return depths


def build(name, wall, border_blocks, accents, seed):
    rng = random.Random(seed)
    img = Image.new("RGB", (W, H))
    left, right = edge_depth(rng), edge_depth(rng)
    for row in range(ROWS):
        for col in range(COLS):
            in_border = col < left[row] or col >= COLS - right[row]
            if in_border:
                base, speckle = rng.choice(border_blocks)
                paint_block(img, col, row, base, rng, 0.12, speckle)
            else:
                # Quiet middle: one wall material, easing slightly darker toward the centre.
                centre = 1 - abs(col + 0.5 - COLS / 2) / (COLS / 2)
                paint_block(img, col, row, shade(wall, 1 - 0.08 * centre), rng, 0.06)
    for accent in accents:
        accent(img, rng, left, right)
    img.save(OUT / name, "WEBP", quality=88)
    print("wrote", OUT / name)


# --- Lush caves -------------------------------------------------------------

MOSS = (89, 109, 45)
CLAY = (160, 166, 179)
STONE = (112, 112, 108)
DEEP_MOSSY_STONE = (78, 86, 70)
GLOW_BERRY = (232, 162, 60)
AZALEA_PINK = (210, 120, 170)


def hanging_vines(img, rng, left, right):
    """Glow-berry vines hanging straight down along the inner edge of each side."""
    px = img.load()
    for side, depths in (("l", left), ("r", right)):
        for _ in range(4):
            row0 = rng.randint(0, ROWS - 6)
            col = depths[row0] if side == "l" else COLS - depths[row0] - 1
            x = col * BLOCK + rng.choice([1, 2, 3]) * BLOCK // 4
            for y in range(row0 * BLOCK, min(H, (row0 + rng.randint(3, 6)) * BLOCK)):
                for dx in range(TEXEL * 2):
                    px[x + dx, y] = shade((70, 120, 40), 1 + rng.uniform(-0.1, 0.1))
                if y % (TEXEL * 7) == 0:
                    for by in range(TEXEL * 2):
                        for bx in range(TEXEL * 3):
                            if 0 <= y + by < H:
                                px[x - TEXEL // 2 + bx, y + by] = GLOW_BERRY


LUSH_BORDER = [
    (MOSS, (AZALEA_PINK, 0.03)),
    (MOSS, None),
    (CLAY, None),
    (STONE, (MOSS, 0.25)),
]

# --- End city ---------------------------------------------------------------

END_STONE = (219, 222, 158)
END_STONE_BRICK = (205, 207, 145)
PURPUR = (166, 121, 166)
PURPUR_PILLAR = (171, 129, 171)
END_ROD = (240, 235, 245)
CHORUS = (95, 60, 105)


def end_rods(img, rng, left, right):
    """White end rods standing on the purpur on both sides, and a few chorus stalks."""
    px = img.load()
    for depths, side in ((left, "l"), (right, "r")):
        for _ in range(3):
            row = rng.randint(1, ROWS - 4)
            col = depths[row] if side == "l" else COLS - depths[row] - 1
            x = col * BLOCK + BLOCK // 2 - TEXEL
            for y in range(row * BLOCK, (row + 2) * BLOCK):
                for dx in range(TEXEL * 2):
                    px[x + dx, y] = END_ROD
        for _ in range(2):
            row = rng.randint(2, ROWS - 5)
            col = depths[row] if side == "l" else COLS - depths[row] - 1
            x = col * BLOCK + BLOCK // 3
            for y in range(row * BLOCK, (row + 3) * BLOCK):
                for dx in range(TEXEL * 3):
                    px[x + dx, y] = shade(CHORUS, 1 + rng.uniform(-0.1, 0.1))


END_BORDER = [
    (PURPUR, None),
    (PURPUR_PILLAR, None),
    (END_STONE_BRICK, None),
    (END_STONE, None),
]


if __name__ == "__main__":
    build("08-lush-caves.webp", DEEP_MOSSY_STONE, LUSH_BORDER, [hanging_vines], seed=8)
    build("09-end-city.webp", END_STONE, END_BORDER, [end_rods], seed=9)
