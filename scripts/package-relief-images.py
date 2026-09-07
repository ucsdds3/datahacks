"""Encode selected image-generation outputs for the web; never redraw or recolor."""
import sys
from pathlib import Path
from PIL import Image

destination = Path(__file__).resolve().parents[1] / 'public/images/minecraft/relief'
destination.mkdir(parents=True, exist_ok=True)
for spec in sys.argv[1:]:
    name, source = spec.split('=', 1)
    with Image.open(source) as image:
        image.convert('RGB').save(destination / f'{name}.webp', quality=91, method=6)
        print(f'{name}: {image.width} x {image.height}')
