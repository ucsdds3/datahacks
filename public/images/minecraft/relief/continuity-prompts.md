# Continuity artwork — prompts for ChatGPT

The seven reliefs in this folder were each generated as a **framed vignette**:
decorated border the whole way round, quiet hollow in the middle. That was right
when each one was a separate page background. It is wrong now that they are
stacked into one continuous shaft, because two borders meet at every join and the
palette cuts hard from one to the next.

The site compensates in CSS (tiles overlap 42% and cross-dissolve, see
`story.css` → "The shaft"). These prompts remove the cause instead. Both can
co-exist — the dissolve only gets easier with art that already continues.

Generate at **1536×1024**, save as `.webp` next to the existing files.

---

## The shared rule to add to every prompt

Append this to the approved template. It is the whole point of the exercise:

> VERTICAL CONTINUITY: this image is a crop from a much taller cave wall, not a
> framed picture. Material must run straight off the TOP edge and the BOTTOM edge
> of the canvas, cut mid-block, with no ceiling silhouette, no floor, no scalloped
> border and no empty margin on those two edges. Only the LEFT and RIGHT edges
> carry the stepped scalloped contour. Someone stacking this image directly above
> or below another crop of the same wall should not be able to see where one ends.

---

## 1. NEW — the shaft head (surface → underground)

**This is the missing piece.** Nothing currently bridges the cherry-grove hero, a
lit 3D render with a horizon, and the flat cross-section below it. The site fades
the grove into darkness to cover the gap. This tile closes it properly. It goes
**above** `01-about.webp` in the strip.

Save as `00-surface.webp`.

> Create one landscape background image for a Minecraft-themed website, 1536x1024.
> CRITICAL CAMERA: FLAT TWO-DIMENSIONAL FRONT ELEVATION. A straight-on soil and
> rock cross section, like a 2D side-scrolling game's background. Every block face
> is a square aligned to the image plane. NO perspective camera, NO visible
> top/side faces, NO vanishing point, NO isometric blocks, NO receding floor, NO
> photographic screenshot.
> SUBJECT: the ground opening up. The top 12% is a thin strip of green grass-block
> tops with a few pale pink cherry petals and short grass, seen edge-on as a flat
> band. Directly under it, a band of brown dirt roughly 18% tall, then the dirt
> gives way to medium grey stone that fills the remaining lower two thirds. A dark
> irregular shaft mouth opens down the middle: a stepped, pixel-square hole through
> the dirt and into the stone, widening as it descends, so the eye is led downward.
> Sparse black coal ore and a little orange-green copper ore near the lower outer
> edges. One or two oak-plank ladder rungs or a wooden support beam at the shaft
> mouth, drawn in flat elevation.
> COMPOSITION: keep the middle 55% quiet enough for website text. The shaft mouth
> should read as depth through value alone — darker stone, not a lighting effect.
> VERTICAL CONTINUITY: material runs straight off the BOTTOM edge cut mid-block as
> plain medium grey stone, with no floor and no border, so it continues into the
> next image. The TOP edge is the only edge that terminates, at the grass line.
> Left and right edges carry a stepped scalloped rock contour.
> DEPTH: restrained 2D layer separation only, from slightly darker recessed patches
> and short crisp shadows. Flat front-facing faces throughout. No 3D extrusions, no
> lens curvature, no bloom, no shader lighting.
> TEXTURES: coarse vanilla Minecraft pixel texture scale, subdued natural colours.
> Clear readable discrete pixels, large recognizable square blocks, minimal blur.
> No text, no UI, no logos, no characters. Deliver just the clean background.

---

## 2. Re-cuts of the existing seven

Same prompts as in `README.md`, with the shared continuity rule appended and the
edge colours below pinned so each one hands off to the next. Ask for them one at a
time, feeding the previous output back in as reference image 1 so the block scale
stays consistent.

| File | Top edge must be | Bottom edge must be |
|---|---|---|
| `00-surface` (new) | grass / dirt | medium grey stone |
| `01-about` | medium grey stone | medium grey stone |
| `02-tracks` | medium grey stone | grey stone, first olive tinges |
| `03-sponsors` | grey stone with olive sulfur creeping in | grey stone, sulfur gone |
| `04-speakers` | grey stone | grey stone darkening to charcoal |
| `05-prizes` | charcoal deepslate | charcoal deepslate |
| `06-faq` | charcoal deepslate | near-black deepslate + sculk |
| `07-stronghold` | near-black deepslate | black stone above the lava line |

**Sulfur specifically.** `03-sponsors.webp` is the one that jars — saturated
yellow and brick red against grey stone on both sides. The site currently pulls it
back with `filter: saturate(.62) brightness(.82)`. If you regenerate it, ask for
*"muted olive-khaki sulfur, the colour of old brass, not lemon or gold; brick-red
patches dulled toward rust"* and the CSS grade can come off.

---

## 3. What not to ask for

- **Do not** ask for a "seamless tileable texture". These are compositions, not
  tiles; the model will flatten them into wallpaper and lose the cave.
- **Do not** ask for one tall 1536×9216 strip in a single generation. Detail
  collapses. Generate crops and let the CSS dissolve join them.
- **Do not** let it add characters, torches-as-light-sources, or glow. Every light
  effect in this theme is CSS, and baked-in lighting fights the depth gradient that
  darkens the shaft as you descend.

## 4. After you get the files

Drop them in this folder as `.webp`. For `00-surface.webp` I need to add it to the
strip — it is not a chapter, so it needs to be a backdrop-only entry ahead of
`about`. Tell me when it lands and I will wire it in and retune the overlap.
