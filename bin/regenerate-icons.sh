#!/bin/bash
# Regenerate every app icon + favicon size from ONE master PNG.
#
# Usage:
#   1. Drop the master image into  icons/aa-mark-master.png  (highest res
#      you have — 1024×1024 minimum, square crop, transparent or solid bg).
#   2. Run:    bash bin/regenerate-icons.sh
#   3. Commit:  git add icons/ && git commit -m "icons: regenerate from master"
#
# What it overwrites (paths stay identical so no HTML/manifest edits needed):
#   icons/favicon-16/32/48/64/96/128/180/192/256/512.png
#   icons/aa-logo-192.png    icons/aa-logo-512.png
#   icons/aa-logo-192-maskable.png   icons/aa-logo-512-maskable.png
#   icons/favicon.svg        (new: SVG wrapping the raster as base64, so the
#                              same source survives any browser's SVG render)
#
# Skips icons/favicon.ico (browser caches it forever — the PNG fallbacks
# work everywhere modern). Re-make it manually via iconutil if you really
# need it: png2ico icons/favicon.ico icons/favicon-16.png icons/favicon-32.png

set -e
cd "$(dirname "$0")/.."

SRC="icons/aa-mark-master.png"

if [ ! -f "$SRC" ]; then
  echo "❌ Missing $SRC"
  echo ""
  echo "Save the master image (the Africa-with-A mark) as:"
  echo "  $SRC"
  echo ""
  echo "Best results: 1024×1024 or larger, square, transparent background"
  echo "(or solid black/white — Mark Lab renders the silhouette in white"
  echo "on a black canvas, which matches the favicon style)."
  exit 1
fi

# Detect which resizer is available. sips ships with macOS; magick / convert
# come with ImageMagick (brew install imagemagick).
if   command -v sips    >/dev/null 2>&1; then RESIZER="sips"
elif command -v magick  >/dev/null 2>&1; then RESIZER="magick"
elif command -v convert >/dev/null 2>&1; then RESIZER="convert"
else
  echo "❌ No image resizer found. Install one:"
  echo "    macOS:        already has sips (you shouldn't see this)"
  echo "    brew:         brew install imagemagick"
  exit 1
fi

echo "→ Resizer: $RESIZER"
echo "→ Source:  $SRC"
echo ""

resize() {
  local size=$1
  local out=$2
  case $RESIZER in
    sips)    sips -s format png -z "$size" "$size" "$SRC" --out "$out" >/dev/null ;;
    magick)  magick "$SRC" -resize "${size}x${size}" "$out" ;;
    convert) convert "$SRC" -resize "${size}x${size}" "$out" ;;
  esac
  echo "   ✓  $out  (${size}×${size})"
}

# --- favicon-N.png (browser tab + bookmark icons) ---------------------------
for size in 16 32 48 64 96 128 180 192 256 512; do
  resize "$size" "icons/favicon-${size}.png"
done

# --- aa-logo-N.png (PWA install / homescreen icon) --------------------------
resize 192 icons/aa-logo-192.png
resize 512 icons/aa-logo-512.png

# --- Maskable variants — same image, the "maskable" hint just tells the OS
#     it can safely crop the corners (round, squircle, etc). The master
#     should already have ~12% padding for this to look good across shapes.
resize 192 icons/aa-logo-192-maskable.png
resize 512 icons/aa-logo-512-maskable.png

# --- favicon.svg — wrap the master PNG inside an SVG so vector references
#     (link rel="icon" type="image/svg+xml") get the exact same pixels
#     scaled losslessly. Avoids the "vectorisation lost Africa's outline"
#     problem because no tracing happens — the SVG just embeds the raster.
B64=$(base64 < "$SRC" | tr -d '\n')
cat > icons/favicon.svg <<SVG
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <image href="data:image/png;base64,${B64}" x="0" y="0" width="512" height="512" preserveAspectRatio="xMidYMid meet"/>
</svg>
SVG
echo "   ✓  icons/favicon.svg  (wraps the raster — no tracing, no detail loss)"

echo ""
echo "✅ Done. ${#size} sizes + 4 logo PNGs + 1 SVG regenerated."
echo "   Verify with: open icons/favicon-512.png  icons/favicon.svg"
echo "   Then:        git add icons/ && git commit -m 'icons: regenerate from master'"
