# Frame previews

Thumbnails for the in-kiosk frame picker. Each file is referenced by
`thumbnail` in `config/frames.ts`.

## What to put here

One image per frame, matching the frame artwork you used in the Canva design.

**The centre must be transparent.** The picker layers the guest's own photo
behind this image so they choose based on their actual shot. A JPG, or a PNG
with an opaque background, covers the photo completely and every option looks
identical.

## Exporting from Canva

1. Open the frame design.
2. Hide or delete the background layer, leaving only the frame artwork.
3. **Share → Download → PNG**, and tick **Transparent background** (a Pro
   feature, which you have).
4. Save it here, then point `thumbnail` at it in `config/frames.ts`.

Roughly 600px on the long edge is plenty — these render small.

## Current state

All four are 900x1200 (3:4, matching `CAPTURE_ASPECT`) with a transparent
photo window. Derived from the Canva SVG exports in `~/Downloads`.

| File | Transparent area | Origin |
| --- | --- | --- |
| `frame-1.png` | 45.3% | rasterised; Canva emitted a real alpha mask |
| `frame-2.png` | 39.5% | rasterised, then window flood-filled |
| `frame-3.png` | 42.9% | raster extracted, window flood-filled |
| `frame-4.png` | 43.7% | raster extracted, window flood-filled |

## Why the Canva exports came out opaque

"Transparent background" only clears the *page* background. Anything sitting in
the photo area — a placeholder image, a filled shape, a white rectangle — stays
opaque and covers the camera.

Three of the four designs exported flattened: the photo area rendered as solid
near-white rather than a hole. Since that region was near-uniform
(stddev < 11), the window could be restored by flood-filling it to alpha.

## Regenerating these

Rasterise the SVG with headless Chrome (ImageMagick can't parse Canva's
embedded data URIs), then flood-fill the centre:

```bash
# 1. wrap the SVG in a 900x1200 page and screenshot it with a transparent bg
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --default-background-color=00000000 \
  --window-size=900,1200 --screenshot=out.png page.html

# 2. punch the window out (skip if the export already has a real alpha mask)
magick out.png -alpha set -fill none -fuzz 12% \
  -draw 'alpha 450,600 floodfill' -strip frame-N.png
```

Fuzz matters: 12% is safe, 18% leaked into the border and made the corners
transparent too. Verify with:

```bash
magick frame-N.png -crop 1x1+450+600 +repage -format '%[fx:a]' info:  # 0 = centre clear
magick frame-N.png -crop 1x1+6+6     +repage -format '%[fx:a]' info:  # 1 = border solid
```

## A cleaner export (preferred, if you redo them)

1. Open the frame design in Canva.
2. **Delete** whatever sits in the photo area, leaving an actual hole. Hiding
   the page background is not enough.
3. **Share → Download → PNG**, tick **Transparent background**, size ~0.5x.
4. Save here and point `thumbnail` at it in `config/frames.ts`.

That gives crisper edges around the window than a flood fill can.
