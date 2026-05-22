#!/usr/bin/env python3
"""
Erase the Gemini watermark diamond from a logo PNG.

Usage:
    python3 bin/clean-gemini-stamp.py icons/aa-logo.png
    python3 bin/clean-gemini-stamp.py icons/*.png

The stamp Gemini overlays sits in the bottom-right corner. We mask the
bottom-right ~7% with the median background color (ours is black), which
removes the diamond cleanly without disturbing the artwork.

Outputs to <name>-clean.png next to the original (so you can compare).
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

def median_bg(img: Image.Image, side: int = 8) -> tuple:
    """Sample corners (top-left + top-right) for the dominant bg color."""
    w, h = img.size
    samples = []
    for x in range(0, side):
        for y in range(0, side):
            samples.append(img.getpixel((x, y)))
            samples.append(img.getpixel((w - 1 - x, y)))
    samples.sort(key=lambda c: sum(c[:3]))
    return samples[len(samples) // 2]

def clean(path: Path) -> Path:
    img = Image.open(path).convert('RGB')
    w, h = img.size
    bg = median_bg(img)
    draw = ImageDraw.Draw(img)
    # The Gemini diamond sits within ~6-8% of width from the corner
    margin_x = int(w * 0.08)
    margin_y = int(h * 0.08)
    draw.rectangle([(w - margin_x, h - margin_y), (w, h)], fill=bg)
    out = path.with_name(path.stem + '-clean' + path.suffix)
    img.save(out)
    return out

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    for arg in sys.argv[1:]:
        for p in Path('.').glob(arg) if '*' in arg else [Path(arg)]:
            if not p.exists(): print(f'skip (not found): {p}'); continue
            out = clean(p)
            print(f'cleaned: {p} -> {out}  (bg sampled, bottom-right 8% masked)')
