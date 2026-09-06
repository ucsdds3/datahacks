# DataHacks 2.0 — Three-Theme Design Direction

**Status:** temp mockups for internal design selection
**Event:** DataHacks 2.0 · January 16–17, 2027 (Sat–Sun)
**Org:** DS3 (Data Science Student Society)
**Mascot:** the Datasaur
**Constraint:** NOT university-branded. No UCSD marks, no campus imagery, no school colors as the system.

---

## 0. Method note

The supplied reference board is the design source of truth. Section 1 is a deep visual extraction of that
board; the palettes, type scales, spacing and component families below all follow from it. The mockups use
hand-authored SVG illustrations rather than stock or generated imagery, so the Datasaur can be translated
faithfully into each of the three visual systems.

---

## 1. Reference extraction

### 1.A — "Pure Imagination" / Creative South (left panel)

| Property | Extracted value |
|---|---|
| Structure | Full-bleed near-black hero, hard cut to cream lower half. Edge-to-edge, no page gutter. |
| Top strip | Scrolling marquee, small caps, cream on black: "Early bird tickets on sale now!" repeated ~6× |
| Nav | Left link cluster (Agenda, Speakers, Drip) · centered script wordmark · right pill buttons (Register / The fam) |
| Display type | Retro 70s high-contrast rounded serif. Cream fill, thick dark outline, offset drop shadow. Two lines, gently arced. Very tight leading — lines nearly touch. |
| Hero headline | "Pure / Imagination" — 2 lines, huge, dominates ~45% of viewport |
| Signature move | A single continuous multi-band rainbow ribbon, S-curved, flowing behind and around the headline. Bands: tomato → orange → marigold → mint → sky → pink. Ribbon has a dark outline like everything else. |
| Illustration | Dense doodle ecosystem — rockets, planets w/ rings, 4-point sparkles, smiling daisies, mushrooms, worms, wide-eyed characters. All thick uniform stroke, flat fill, no gradients. |
| Buttons | Fully-rounded pill, **outline only** (no fill), generous horizontal padding (~2.5× vertical). "Get your tickets", "Become a speaker" |
| Section 2 | On cream. Centered bold geometric sans heading "Speakers & Workshops", short centered body, pill CTA. |
| Section 2 art | Rube-Goldberg line-art machine — pipes, gears, valves, tubes — running across full width, connecting elements. Line art only, no fill. |
| Spacing | Very generous. Large vertical air above/below the headline. Body copy sits in a narrow ~340px column, small, calm. |
| Palette | Ink `#16110E`, cream `#F3E7D3`, tomato `#E8523F`, orange `#F08A3C`, marigold `#F5C13D`, mint `#7FBF8A`, sky `#6FA8DC`, pink `#EF8FB5`, lilac `#A78BC9` |
| Motion implied | Marquee scroll · parallax drift on doodles |

### 1.B — "Super Hello" (center panel)

| Property | Extracted value |
|---|---|
| Structure | Hard full-width colour bands stacked with zero transition. Pink band, then marigold band. No rounded section wrappers. |
| Top bar | Solid black strip. Small white wordmark left, small link row right, one white pill "Log in". Low height, dense, contrasts with the airy hero below. |
| Display type | Massive lowercase geometric grotesk, ultra-heavy, negative tracking, very tight leading. Two words at two different scales: "super" ~40% the size of "hello". White on pink. Left-aligned, not centered. |
| Sub | One medium-weight line ("A design agency....kinda") then one small body line. Big scale gap between display and sub — that gap *is* the hierarchy. |
| Buttons | Small **rectangular** orange fill, minimal radius (~4px), white label. Deliberately modest next to the giant type. |
| Illustration | Isometric toy machines/robots. Chunky primitive volumes, flat shading (3 tones per face-set, no gradients), orange/marigold/warm-grey/teal. **Tiny human figures for scale** — this is the signature. Objects sit on an implied isometric ground plane, casting no shadow. |
| Section 2 | Marigold. Isometric machine left, text column right, right column ~35% width. Heading is bold sans, ~3× body. |
| Section 3 | "How it works" centered heading, then 3 equal cards. |
| Card anatomy | Cream fill · **2px hard black border** · small radius · pink square icon tile at top-left with a black line icon inside · bold title · small body copy. Flat, no shadow. |
| Floating element | Black circular badge with a star, bottom-left, overlapping the band edge |
| Spacing | Airy hero, denser card section. Generous side gutters. |
| Palette | Pink `#EFA0DE`, marigold `#F0BE3D`, orange `#F26522`, ink `#000000`, cream `#FFF8EC`, teal `#4FB3A5`, warm grey `#B9B3A9` |
| Motion implied | Staggered float-up · parallax drift on isometric objects |

### 1.C — "Muse Creates" (right panel)

| Property | Extracted value |
|---|---|
| Structure | Rigid magazine grid. Every block edge-to-edge, separated by **visible black hairline rules**. Zero rounded corners except pills. |
| Top strip | Green marquee, white caps: "LET'S WORK TOGETHER!" repeated |
| Nav | Cream bar. Outlined pill links left (Services, Main Page) · centered serif wordmark · outlined pill links right (About, Portfolio) |
| Hero | Full-bleed vintage sepia photograph. Editorial serif headline overlaid in near-black: roman line + **italic** line ("Let's make your brand / *unforgettable.*"). Small outlined pill CTA "Discover". |
| Signature move | **Two-column question rows.** Narrow left label column (serif italic, lowercase, trailing ellipsis) + wide right statement column (bold condensed CAPS). Each row is a different solid colour block. Rows divided by black rules. |
| Row palette | 1: brick red bg / cream label / yellow caps · 2: mustard bg / black label / black caps · 3: forest green bg / cream label / cream caps · 4: brick red bg / cream hand-drawn marker text + collage portrait right |
| Card row | 2-up: "THE DESIGNER" (red, photo), "THE PORTFOLIO" (green, surreal collage). Condensed caps labels overlaid bottom-left. |
| Closing block | Landscape photo card, yellow outlined serif caps "SERVICES" |
| Type system | Editorial serif (roman + italic) for voice · bold condensed caps sans for statements · small serif for labels · hand-drawn marker for one emotional beat only |
| Spacing | Tight, deliberate, magazine-like. Density is the point — but rows are tall enough to breathe internally. |
| Palette | Cream `#F5E9C8`, brick `#C8342B`, mustard `#F2C230`, forest `#3E7A45`, ink `#141210`, sepia `#B08D5F` |
| Motion implied | Marquee · cinematic fade-through between colour blocks |

---

## 2. Shared content model

Identical copy across all three themes. Only the *visual* system changes — that is the whole point of the
comparison. Any TBD is rendered as a designed placeholder, never as a broken-looking gap.

```
EVENT       DataHacks 2.0
YEAR        2027
DATES       January 16–17, 2027
DAYS        Saturday + Sunday
FORMAT      36 hours, in person
ORG         DS3 — Data Science Student Society
MASCOT      The Datasaur
```

### Section pack (8 sections + footer)

| # | Section | Content |
|---|---|---|
| 1 | **Hero** | Wordmark, "January 16–17, 2027", one-line positioning, primary CTA "Apply to hack" + secondary "Become a sponsor", datasaur hero art |
| 2 | **Marquee strip** | `DATAHACKS 2.0 · JAN 16–17 · 36 HOURS · BUILD SOMETHING · APPLICATIONS OPEN SOON ·` looping |
| 3 | **About** | 2–3 sentences on what DataHacks is: a weekend-long data science and ML hackathon run by students, open to all skill levels, teams up to 4. No university naming. |
| 4 | **Last year in numbers** | 4 stats, all placeholder: `XXX hackers` · `XXX projects shipped` · `$XX,XXX awarded` · `XX schools`. Placeholders must look *intentional* — treat XXX as a type specimen, not an error. |
| 5 | **Tracks** | 4 cards, all TBD: "Track One → Four", each with `TBD` as the body and a themed icon. Copy line: "Four tracks. Announced closer to the date." |
| 6 | **Prizes** | Total pool `$XX,XXX` TBD, then 1st / 2nd / 3rd + track prizes as TBD tiers |
| 7 | **Schedule** | Two-day timeline. Sat: check-in, opening, team formation, workshops, dinner, midnight event. Sun: breakfast, submissions close, judging, closing + awards. Times may be TBD. |
| 8 | **Sponsors** | Tiered empty slots (Diamond / Gold / Silver) rendered as designed placeholder frames + "Sponsor inquiries → sponsorship@ds3ucsd.com" |
| 9 | **FAQ + Footer** | 5 Q/A (who can apply, cost, team size, hardware, travel). Footer: DS3 credit, socials, MLH-style small print. |

### FAQ copy (shared)

1. **Who can apply?** — Any current student, any major, any experience level. First-time hackers welcome.
2. **How much does it cost?** — Nothing. Free to attend, with meals and swag included.
3. **Can I bring a team?** — Teams of up to 4. Come solo and we'll help you find one at team formation.
4. **What should I bring?** — Laptop, charger, student ID. We'll handle food, caffeine and floor space.
5. **Is travel covered?** — Travel reimbursement details are TBD and will be announced with applications.

---

## 3. The Datasaur

The mascot is the throughline. Each theme renders the *same character* in its own visual language — long-necked
sauropod silhouette, friendly, oversized head, four stubby legs, plates or spots along the back. It must read as
one animal across all three sites.

**All mascot art is inline SVG.** No external image files, no raster assets, no CDN. Hand-authored paths.

| Theme | Datasaur treatment |
|---|---|
| **Groove** | Thick uniform-stroke doodle. Cream body, ink outline, no gradients. Surfing the rainbow ribbon, sunglasses, tiny sparkles trailing behind. Back plates = alternating rainbow bands. Companion doodles: rocket, ringed planet, daisy, mushroom. |
| **Pop** | Isometric toy figure. Built from chunky primitive volumes, flat 3-tone shading per volume (light / mid / shadow face), no gradient meshes. Orange body, marigold plates, teal eye. **A tiny human figure standing beside it for scale** — the signature borrowed from the reference. Sits on an implied ground plane. |
| **Press** | Vintage engraving. Fine-line hatching for volume, halftone dot fill, sepia-on-cream. Framed like a natural-history plate with a hairline rule and a small serif caption: `Fig. 1 — Datasaurus scientiae`. |

Additional themed illustration is encouraged and expected — go past just the mascot:

- **Groove:** rainbow ribbon system, doodle field, a Rube-Goldberg line-art "data pipeline" running through the schedule section
- **Pop:** an isometric "hackathon machine" for the About section, isometric server/laptop/coffee props, tiny humans throughout
- **Press:** engraved specimen plates for track cards, halftone-treated blocks standing in for the reference's vintage photography, a marker-style hand-drawn beat used exactly once

---

## 4. Theme specs

### 4.1 · GROOVE — "Cosmic Groove" · route `/groove`

**Direction:** Deep Dark Mode → cut to warm cream. Expressive display typography. Editorial offset composition.

| Token | Value |
|---|---|
| `--ink` | `#16110E` |
| `--cream` | `#F3E7D3` |
| `--tomato` | `#E8523F` |
| `--orange` | `#F08A3C` |
| `--marigold` | `#F5C13D` |
| `--mint` | `#7FBF8A` |
| `--sky` | `#6FA8DC` |
| `--pink` | `#EF8FB5` |
| `--lilac` | `#A78BC9` |

**Type:** display `Shrikhand` · headings `Poppins` 800 · body `Poppins` 400/500 · labels `Space Mono` (uppercase, tracked +0.12em)

**Type scale:** hero `clamp(4rem, 12vw, 11rem)` / leading `0.82` · section head `clamp(2.5rem, 5vw, 4.25rem)` · body `1.0625rem` / leading `1.65` · label `0.75rem`

**Signature components (4):**
1. Rainbow ribbon SVG system — a continuous S-curve of 6 stroked bands, used as the hero backdrop and again as a section divider
2. Infinite marquee strip (ink on cream and cream on ink, alternating)
3. Doodle scatter field with parallax drift on scroll
4. Outlined pill buttons + outlined pill link nav

**Motion (2):** staggered float-up on section entry · parallax drift on doodles

**Section backgrounds:** hero ink → about cream → stats ink → tracks cream → prizes marigold → schedule cream → sponsors ink → FAQ cream → footer ink

**Hard rules:** every shape carries the same ~3px ink outline. Flat fills only, zero gradients. Buttons are outline-only pills. Do not centre everything — offset the hero composition.

---

### 4.2 · POP — "Pop Machine" · route `/pop`

**Direction:** Bold Studio Solid. Hard colour bands. Compressed statement typography. Modular rhythm.

| Token | Value |
|---|---|
| `--pink` | `#EFA0DE` |
| `--marigold` | `#F0BE3D` |
| `--orange` | `#F26522` |
| `--ink` | `#000000` |
| `--cream` | `#FFF8EC` |
| `--teal` | `#4FB3A5` |
| `--grey` | `#B9B3A9` |

**Type:** display + headings `Archivo` (weight 900, tracking `-0.04em`) · body `DM Sans` 400/500

**Type scale:** hero display `clamp(5rem, 15vw, 14rem)` / leading `0.78` / **lowercase** · secondary display line ~38% of hero size · section head `clamp(2rem, 4.5vw, 3.5rem)` · body `1rem` / leading `1.6`

**Signature components (4):**
1. Hard-edge full-bleed colour bands with zero transition between them
2. Isometric illustration system with tiny humans for scale
3. Bordered flat cards — cream fill, 2px ink border, small radius, coloured icon tile top-left, no shadow
4. Black top bar with a single pill CTA

**Motion (2):** staggered float-up · parallax drift on isometric objects

**Band order:** pink hero → black marquee → marigold about → cream stats → pink tracks → marigold prizes → cream schedule → pink sponsors → cream FAQ → black footer

**Hard rules:** hero display is lowercase, left-aligned, and the CTA button stays deliberately small against it. No shadows anywhere. No nested cards. Borders are `2px solid #000`, never grey.

---

### 4.3 · PRESS — "Field Guide" · route `/press`

**Direction:** Quiet Premium / editorial. Serif + condensed caps. Swiss-grid discipline with magazine colour blocking.

| Token | Value |
|---|---|
| `--cream` | `#F5E9C8` |
| `--brick` | `#C8342B` |
| `--mustard` | `#F2C230` |
| `--forest` | `#3E7A45` |
| `--ink` | `#141210` |
| `--sepia` | `#B08D5F` |

**Type:** display serif `Playfair Display` 400/700 + **italic** · condensed caps `Anton` · body serif `EB Garamond` · marker accent `Caveat Brush` (used exactly once)

**Type scale:** hero serif `clamp(3rem, 7vw, 6.5rem)` / leading `1.02` · condensed caps statement `clamp(1.75rem, 3.6vw, 3rem)` / tracking `0.01em` · body serif `1.125rem` / leading `1.7` · label `0.8125rem` italic

**Signature components (4):**
1. Two-column question rows — narrow serif-italic label column + wide condensed-caps statement column, alternating solid colour blocks, black hairline rules between
2. Hairline-ruled magazine grid (`1px solid ink` everywhere, no radius)
3. Engraved specimen plates with halftone fill and serif `Fig. N —` captions
4. Marquee strip + outlined pill nav

**Motion (2):** marquee · cinematic fade-through on block entry

**Question rows** (adapt the reference's device to hackathon voice):
- brick / *"Have you ever..."* → **BUILT SOMETHING IN 36 HOURS?**
- mustard / *"Do you want to..."* → **SHIP A MODEL THAT ACTUALLY WORKS?**
- forest / *"Are you ready for..."* → **DATA, CAFFEINE, AND NO SLEEP?**
- brick / marker: **WELL.. YOU'RE IN THE RIGHT PLACE!** + engraved datasaur plate right

**Hard rules:** zero border-radius except pills. Every block separated by a visible `1px` ink rule. No drop shadows. Photography is replaced by SVG engraving + halftone — no external images.

---

## 5. Implementation contract

**Stack:** existing Vite + React 18 + TS + Tailwind + framer-motion. Nothing new installed.

**File ownership — strict, no overlap:**

```
src/themes/groove/**   → agent A only
src/themes/pop/**      → agent B only
src/themes/press/**    → agent C only
```

Shared files (`App.tsx`, `index.html`, `index.css`, `tailwind.config.ts`, `src/pages/ThemeIndex.tsx`)
are scaffolded up front and are **off-limits to all agents**. Fonts are already linked in `index.html`.

**Each theme directory contains:**

```
src/themes/<slug>/
  index.tsx        default-exported page component, root element carries class "<slug>-root"
  <slug>.css       all styling, every selector scoped under .<slug>-root
  sections/*.tsx   one file per section
  art/*.tsx        inline-SVG illustration + datasaur components
```

**Non-negotiables (from the skill's anti-slop rules):**

- Scope every CSS selector under `.<slug>-root`. The app has global shadcn base styles — override at the root.
- Reset `--background`/`--foreground` bleed at the theme root; set the theme's own `background` and `color`.
- No external images, no CDN assets, no icon libraries for the art. Inline SVG only. `lucide-react` is allowed for small utility glyphs only, never for mascot or signature illustration.
- **No cards inside cards inside cards.** One framing move per section, maximum.
- **No giant rounded wrapper** around every section.
- No default purple/blue AI gradients. No glassmorphism. No floating blobs.
- Hero: headline ≤ 3 lines, one focal point, must be clean and readable at 1280×720. Do not stuff it with pills, badges, or fake stats.
- Section spacing must be generous and even. `clamp(5rem, 10vw, 9rem)` vertical is the default rhythm.
- Vary section rhythm — density, alignment, image-to-text ratio, background intensity. Do not repeat the same block shape down the page.
- Responsive down to 390px. Wide content scrolls inside its own container; the body never scrolls horizontally.
- `prefers-reduced-motion` disables all transforms and marquees.
- Placeholder values (`XXX`, `TBD`, `$XX,XXX`) are styled as deliberate type specimens.

**Definition of done:** `npx tsc --noEmit` clean, `npm run build` clean, route renders top to bottom with no console errors at 1440px and 390px.
