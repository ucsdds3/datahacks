"""Encode Mohak's End artwork for the application portal's background; never redraw or recolor.

Usage: python3 scripts/package-end-portal-art.py <source.png>

The source is the one raster embedded in the artwork PDF, pulled out at native
resolution with `pdfimages -all "<artwork>.pdf" out` (1323 x 764). Two files:

- end-sky-wide.webp  the whole painting at source width, for landscape screens.
- end-sky-tall.webp  a portrait crop centred on the big middle island, for phones.

Both stay at native resolution: upscaling would add bytes, not detail.
"""
import sys
from pathlib import Path
from PIL import Image

QUALITY = 86
# Horizontal centre of the big middle island in the source, in source pixels.
ISLAND_CENTRE_X = 655
# Portrait crop width (full height). Wide enough that a phone held either way keeps the island.
TALL_WIDTH = 600

destination = Path(__file__).resolve().parents[1] / 'public/images/minecraft/end'
destination.mkdir(parents=True, exist_ok=True)

with Image.open(sys.argv[1]) as source:
    image = source.convert('RGB')
    image.save(destination / 'end-sky-wide.webp', quality=QUALITY, method=6)
    left = max(0, min(image.width - TALL_WIDTH, ISLAND_CENTRE_X - TALL_WIDTH // 2))
    tall = image.crop((left, 0, left + TALL_WIDTH, image.height))
    tall.save(destination / 'end-sky-tall.webp', quality=QUALITY, method=6)
    print(f'wide: {image.width} x {image.height}')
    print(f'tall: {tall.width} x {tall.height} (x {left}..{left + TALL_WIDTH})')
