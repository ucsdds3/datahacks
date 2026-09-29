# Regenerating the backdrops — prompts for ChatGPT

The seven `0*.webp` files in this folder are the **good** set and are what the site
renders today. They are the style target, not something to replace wholesale.

Goal: keep exactly their look — flat 2D wall face down the middle, chunky stepped
relief with real shadow at the edges — and fix the two things they don't do:
they don't continue into each other vertically, and the middle is emptier than it
needs to be.

**Always upload the matching existing file as reference image 1.** Every prompt
below is an *edit* of it. That is the single most important instruction on this
page — the last round was generated from text alone and lost the style completely.

---

## The base rule — put this at the top of every request

> Edit reference image 1 into a revised version of itself. KEEP its exact art
> direction: flat two-dimensional FRONT ELEVATION, every block a square face
> aligned to the image plane, a calm flat wall face across the middle, and chunky
> stepped outcrops with short crisp drop shadows around the edges. It is a 2D
> side-scroller cave wall with shallow relief, not a 3D cavern. No perspective
> camera, no vanishing point, no receding floor, no fisheye, no bloom, no shader
> lighting, no characters, no text, no UI, no logos. LANDSCAPE 1536x1024.
>
> BLOCK SCALE IS ONE SCALE. Every block in the image — edges and middle alike —
> is the same size square, matching reference image 1. The middle of the wall must
> be built from those same clearly visible square blocks, just calmer: fewer ores,
> fewer outcrops, less contrast. The middle is NEVER a smooth gradient, a noise
> field, or a blurry texture wash. If I cannot count the blocks in the middle, it
> is wrong.
>
> CRISP PIXELS. Coarse vanilla Minecraft texture resolution, hard edges, no
> anti-aliasing, no painterly blending, no soft airbrushed shading.

## The continuity rule — also on every request

> VERTICAL CONTINUITY: this is a crop from a much taller wall. Material runs
> straight off the TOP edge and the BOTTOM edge, cut mid-block, with no ceiling
> silhouette, no floor, no scalloped border and no margin on those two edges. Only
> the LEFT and RIGHT edges carry the stepped scalloped contour. Stacking this
> image directly below the one above it should not show a join.

---

## Depth rules — these were wrong before

Material follows depth. The site puts a live Y readout on screen beside the art,
so a wrong rock is visible.

- **No deepslate anywhere above Y 0.** Not in About, not in Tracks, not in
  Sponsors. Those are grey stone, cobblestone, andesite, diorite, granite, gravel.
- Deepslate may first appear as a **few blocks along the bottom edge only** of the
  mineshaft (Y −08), and takes over from Y −28 down.
- Sulfur belongs to the Sponsors cavern alone. It must not leak up into Tracks or
  down into the mineshaft.

## Handoff colours — so each one meets the next

| File | Y | Top edge | Bottom edge |
|---|---|---|---|
| `01-about` | +48 | medium grey stone | medium grey stone |
| `02-tracks` | +24 | medium grey stone | grey stone, a little darker |
| `03-sponsors` | +08 | grey stone, first sulfur creeping in at the sides | grey stone, sulfur gone |
| `04-speakers` | −08 | grey stone | grey darkening, a few deepslate blocks |
| `05-prizes` | −28 | charcoal deepslate | charcoal deepslate |
| `trial-chamber` | −36 | charcoal deepslate | charcoal deepslate |
| `06-faq` | −44 | charcoal deepslate | near-black deepslate and sculk |
| `07-stronghold` | −56 | near-black deepslate | black stone above the lava line |

---

## Per-tile requests

Ask for them **one at a time**, uploading that tile as reference image 1.

### 01-about — Y +48, stone, coal & copper
> Keep it almost as-is: this one is already right. Apply the base, continuity and
> depth rules. Remove any deepslate. Add two or three more small coal and copper
> ore blocks into the calm middle so it is not empty, still sparse. Make the
> stepped outcrops at the left and right edges a little deeper and a little more
> irregular, with crisper shadows.

### 02-tracks — Y +24, iron & redstone
> Apply the base, continuity and depth rules. REMOVE ALL DEEPSLATE — this is
> above sea level. Grey stone, cobblestone, andesite, diorite, salmon granite,
> gravel. Add a small exposed redstone vein glinting dull red on one side and two
> tan iron ore blocks on the other. Keep the middle calm but built of visible
> blocks.

### 03-sponsors — Y +08, the sulfur cavern  **(make this one flamboyant)**
> Apply the base, continuity and depth rules. This is the showpiece and it should
> be the most dramatic image in the set. Big pale yellow-green sulfur formations
> growing inward from the left and right edges, long jagged sulfur spikes hanging
> from the upper outcrops and rising from the lower ones, dull brick-red cinnabar
> embedded in the yellow masses. Sulfur is muted old-brass yellow, NOT neon gold.
> Push the drama at the edges hard and keep the centre wall calm charcoal stone so
> text still reads. No sulfur in the top or bottom 10% — it must hand off to plain
> grey stone at both edges.

### 04-speakers — Y −08, the abandoned mineshaft  **(more of it)**
> Apply the base, continuity and depth rules. Lean much harder into the mineshaft:
> more oak plank crossbeams and upright fence posts stepping down both sides, more
> white cobwebs strung in the corners and between beams, a flat side-view rail line
> with a minecart on a ledge, small torches on the posts. This is a 2D cross
> section of a mineshaft, not a tunnel receding into the distance. A few cobbled
> deepslate blocks may appear along the very bottom edge only.

### 05-prizes — Y −28, deepslate ores
> Apply the base, continuity and depth rules. Entirely charcoal deepslate and
> cobbled deepslate. Cluster the diamond, lapis and redstone ores into two or three
> recognisable veins near the edges rather than scattering them evenly — a vein
> reads as a find. Keep original ore colours, absolutely no emissive glow or cyan
> lighting.

### trial-chamber-entrance — Y −36  **(needs the most character)**
> Apply the base, continuity and depth rules. Build a trial chamber facade in flat
> front elevation: polished deepslate and deepslate brick masonry, copper trim
> going green with oxidation, a large symmetrical arched doorway of chiselled
> deepslate in the middle distance, small barred alcoves at the sides. Ominous and
> built, not natural cave. Keep the very centre calm enough for text over it.

### 06-faq — Y −44, the Deep Dark  **(this one has to feel dangerous)**
> Apply the base, continuity and depth rules. Go much further than the reference:
> the Ancient City. Ruined deepslate brick pillars stepping down both sides, heavy
> sculk growth spreading across the lower ledges and creeping up the ruins, sculk
> veins threading over the brick. Sculk is near-black with a dark teal cast and
> tiny muted aqua speckles — dim, never neon, never glowing. The whole image is the
> darkest so far but must still be legible as distinct blocks. No sensors or
> shriekers: the site adds those separately as sprites.

### 07-stronghold — Y −56
> Apply the base, continuity and depth rules. Stone brick and mossy stone brick
> stronghold masonry in flat elevation, cracked and repaired, iron bars in a small
> alcove, one or two wall torches. Bottom 12% is a flat side-elevation cross
> section of an orange lava pool with a dark stone shelf above it. No portal in the
> image — the site renders that separately.

---

## What went wrong last time, so it doesn't repeat

1. **Generated from text with no reference image.** The style was lost entirely.
   Always attach the existing tile.
2. **"Keep the middle quiet for text"** was read as "leave the middle empty". It
   came back as a flat noise wash with no block grid at all. Say *calmer, same
   blocks* instead — the wording above does.
3. **Two block scales in one image.** Big blocks at the edges, tiny noise in the
   middle, so it read as a pixel-art frame around a photo of concrete.
4. **A shaft drawn as a lighter wedge.** A hole must be darker than the rock
   around it. If anything reads as a pyramid instead of an opening, the values are
   inverted.
5. Don't ask for a single tall strip of all of them. Detail collapses.

## When the files come back

Overwrite in place, same filenames, `.webp`. The site picks them up with no code
change — the shaft already overlaps consecutive tiles and cross-dissolves them, so
even imperfect handoffs will land softly.
