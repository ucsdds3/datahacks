# Crafted Together — Minecraft mockup

Fourth DataHacks 2.0 concept, available at `/minecraft` and linked from `/themes`.

Uses Pop Machine's content skeleton: hero, about, stats, four tracks, prizes, schedule, sponsors, FAQs, and footer. Dates and provisional event information are retained. Applications remain visibly closed; contact actions open the existing organizers' email addresses. The other three designs and the default route are preserved.

## Direction

A Minecraft overworld opening, stone-extruded pixel title, yellow splash caption, beveled game-menu controls, crafting and inventory panels, locked track slots, block-shaped prize podium, and a two-day quest log. Grass greens lead to an underground mineral palette and a light stone schedule. Silkscreen provides display lettering, VT323 provides game-interface labels, and the existing DM Sans provides readable body copy. All styles are scoped to `.minecraft-root`.

Responsive layouts cover desktop and narrow mobile screens. Navigation collapses into a menu; schedule tabs and FAQs use the existing accessible Radix components. Reduced-motion preferences disable the splash animation and transitions. The page includes a skip link and visible keyboard focus.

## Artwork

Hero asset: `public/images/minecraft/overworld.png` (1672 × 941).
Created with the built-in image-generation tool and visually inspected before integration. It is an original generated illustration, not an official Minecraft screenshot. No Figma connection or additional package was used.

Exact generation prompt:

> Use case: stylized-concept
> Asset type: landscape background artwork for a DataHacks hackathon website hero
> Primary request: ONE beautiful Minecraft-inspired landscape, wide 16:9, ideally 2048x1152.
> Scene/backdrop: authentic Minecraft voxel block world, with lush grassy stepped cliffs framing the foreground along the bottom and sides, oak block trees, a clear river winding from the right foreground toward the center distance, and hazy blue distant mountains.
> Style/medium: beautiful game-world cinematic rendering, authentic cubical Minecraft geometry and crisp square pixel textures.
> Composition/framing: eye-level panoramic camera view across a welcoming valley, not an isometric miniature. Expansive pale azure sky fills the upper 55% of the image, with a few block clouds near the edges and a large uncluttered central sky area suitable for centered website title overlay.
> Lighting/mood: cinematic daylight with subtle warm sunlight from the upper left; welcoming adventure atmosphere.
> Color palette: rich lush greens, clear blue water, pale azure sky, hazy blue mountains.
> Constraints: landscape artwork only. No text, no logos, no watermarks, no UI, no characters. No objects in the central sky. Keep the central title area light, calm and uncluttered.

## Verification

Production build, application TypeScript check, and ESLint on the changed components passed. The local route returned HTTP 200. Browser interaction and screenshot testing were not performed.
