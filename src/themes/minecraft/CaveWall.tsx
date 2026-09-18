import { useEffect, useRef, type RefObject } from "react";
import { airAt, blockAt, hash, isRock, STRATA, STRATUM_ROWS, TEXTURES } from "./cave";

/** On-screen size of one block. Big enough that a 16x16 texture reads as itself. */
const BLOCK = 54;

const source = (name: string) => `/images/minecraft/textures/${name}.png`;

/**
 * Draws the shaft wall a block at a time from real vanilla textures.
 *
 * Nothing is scaled smoothly and nothing is blurred: every tile is a 16x16 image
 * blitted at an integer multiple with smoothing off, which is what makes it read
 * as Minecraft rather than as a painting of Minecraft. Because the wall is
 * generated rather than photographed there is no edge anywhere in it — one stratum
 * scatters into the next, and the cave mouth runs unbroken from the surface to
 * bedrock.
 */
export function CaveWall({ scroller, place, repaint }: {
  scroller: RefObject<HTMLElement | null>;
  /** How far down the story we are, 0 at the surface and 1 at the End. Counted in
   * chapters rather than pixels so sulfur lands on Sponsors and sculk on the
   * Ancient City — a fixed parallax rate drifts the strata off their chapters. */
  place: RefObject<number>;
  /** Story publishes the redraw here and calls it once it has updated `place`.
   * The wall must not listen to scroll itself: child effects run first, so its
   * frame would land before the new position and the wall would trail by one. */
  repaint: RefObject<(() => void) | null>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const surface = canvas.current;
    const view = scroller.current;
    const context = surface?.getContext("2d", { alpha: false });
    if (!surface || !view || !context) return;

    const blocks = new Map<string, HTMLImageElement>();
    let ready = false;
    let queued = 0;
    let width = 0;
    let height = 0;
    let ratio = 1;

    const paint = () => {
      queued = 0;
      if (!ready) return;
      const visibleRows = height / BLOCK;
      // Put the middle of chapter N's stratum in the middle of the window when
      // chapter N is pinned. The wall still travels a good deal less than the copy
      // does, so it keeps sitting back — the parallax falls out of the geometry
      // rather than being dialled in on top of it.
      const top = (place.current * STRATA.length - 1) * STRATUM_ROWS
        + STRATUM_ROWS / 2 - visibleRows / 2;
      const firstRow = Math.floor(top);
      const offset = (top - firstRow) * BLOCK;
      const cols = Math.ceil(width / BLOCK) + 1;
      const rows = Math.ceil(height / BLOCK) + 1;

      context.imageSmoothingEnabled = false;
      const lip = Math.max(3, Math.round(BLOCK * .17));

      for (let r = 0; r < rows; r++) {
        const row = firstRow + r;
        const y = Math.round(r * BLOCK - offset);
        const [ar, ag, ab] = airAt(row);

        for (let c = 0; c < cols; c++) {
          const x = c * BLOCK;
          const rock = isRock(c, row, cols);
          const tile = blocks.get(blockAt(c, row));
          if (tile) context.drawImage(tile, 0, 0, 16, 16, x, y, BLOCK, BLOCK);
          else { context.fillStyle = "#14181c"; context.fillRect(x, y, BLOCK, BLOCK); }

          if (!rock) {
            // The far side of the cave: the same rock, well back in shadow. Depth
            // out of value alone, the way the game does it — no blur, no glow.
            context.fillStyle = `rgba(${ar},${ag},${ab},.88)`;
            context.fillRect(x, y, BLOCK, BLOCK);
            // A hard lip under and beside any rock that overhangs this cell. This
            // is what the flat grid was missing: the wall reads as stepped ledges
            // standing proud of the cave rather than as one tiled plane.
            context.fillStyle = "rgba(3,5,8,.82)";
            if (isRock(c, row - 1, cols)) context.fillRect(x, y, BLOCK, lip);
            if (isRock(c - 1, row, cols)) context.fillRect(x, y, lip, BLOCK);
            if (isRock(c + 1, row, cols)) context.fillRect(x + BLOCK - lip, y, lip, BLOCK);
          } else {
            // Near rock, lit unevenly so a flat field of one block never appears,
            // and picked out along the brow where it meets open air.
            context.fillStyle = `rgba(0,0,0,${hash(c, row, 61) * .18})`;
            context.fillRect(x, y, BLOCK, BLOCK);
            if (!isRock(c, row - 1, cols)) {
              context.fillStyle = "rgba(255,246,228,.09)";
              context.fillRect(x, y, BLOCK, lip);
            }
          }
        }
      }
    };

    const schedule = () => { queued ||= requestAnimationFrame(paint); };

    const measure = () => {
      width = view.clientWidth;
      height = view.clientHeight;
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      surface.width = Math.round(width * ratio);
      surface.height = Math.round(height * ratio);
      surface.style.width = `${width}px`;
      surface.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint();
    };

    let pending = TEXTURES.length;
    for (const name of TEXTURES) {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => { blocks.set(name, image); if (--pending === 0) { ready = true; paint(); } };
      image.onerror = () => { if (--pending === 0) { ready = true; paint(); } };
      image.src = source(name);
    }

    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    measure();
    resize?.observe(view);
    window.addEventListener("resize", measure);
    repaint.current = schedule;
    return () => {
      cancelAnimationFrame(queued);
      resize?.disconnect();
      window.removeEventListener("resize", measure);
      repaint.current = null;
    };
  }, [scroller, place, repaint]);

  return <canvas className="mc-cave-wall" ref={canvas} aria-hidden="true" />;
}
