import { useEffect, useRef } from "react";

type Context = CanvasRenderingContext2D;
type Mineral = "stone" | "emerald" | "iron" | "coal" | "gold" | "redstone" | "diamond" | "deepslate" | "nether";

const stoneColors = ["#555861", "#60636b", "#4a4e56", "#6b6e75"];
const deepColors = ["#30333e", "#3c3f4c", "#252833", "#454857"];
const oreColors: Partial<Record<Mineral, [string, string]>> = {
  emerald: ["#48b67c", "#82daa2"], iron: ["#bd9883", "#e0bfa2"],
  coal: ["#20232b", "#343741"], gold: ["#d8ae4a", "#f3d574"],
  redstone: ["#b9515b", "#f07b78"], diamond: ["#5cbec5", "#a3e3dd"],
};

function noise(x: number, y: number, seed = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 43.17) * 43758.5453;
  return n - Math.floor(n);
}

function rect(ctx: Context, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h));
}

function tile(ctx: Context, x: number, y: number, material: Mineral, variant = 0) {
  const colors = material === "diamond" || material === "deepslate" ? deepColors
    : material === "nether" ? ["#59343e", "#653b45", "#492b36", "#78454c"] : stoneColors;
  rect(ctx, colors[0], x, y, 16, 16);
  // These are intentionally flat 16 × 16 pixel tiles, with no perspective or lighting.
  for (let i = 0; i < 16; i++) {
    const px = Math.floor(noise(i, variant, 1) * 14);
    const py = Math.floor(noise(i, variant, 2) * 14);
    rect(ctx, colors[1 + i % 3], x + px, y + py, 2 + i % 3, 1 + i % 2);
  }
  if (material === "stone" || material === "emerald") {
    rect(ctx, colors[2], x, y + 7, 8, 1);
    rect(ctx, colors[2], x + 8, y + 12, 8, 1);
    rect(ctx, colors[2], x + 7, y, 1, 7);
  }
  const ore = oreColors[material];
  if (ore) {
    for (const [px, py, w, h] of [[3, 3, 3, 2], [9, 2, 2, 3], [7, 8, 3, 3], [2, 11, 2, 2], [12, 12, 2, 2]]) {
      rect(ctx, ore[0], x + px, y + py, w, h);
      rect(ctx, ore[1], x + px, y + py, Math.max(w - 1, 1), 1);
    }
  }
}

function cherryTree(ctx: Context, x: number, ground: number, scale = 1) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(ground));
  ctx.scale(scale, scale);
  rect(ctx, "#75506a", -3, -36, 7, 36);
  rect(ctx, "#9b6c80", -1, -31, 2, 29);
  rect(ctx, "#75506a", -12, -26, 12, 4);
  rect(ctx, "#75506a", 2, -32, 12, 4);
  rect(ctx, "#ce88ad", -27, -47, 52, 23);
  rect(ctx, "#e4a3c3", -22, -55, 41, 27);
  rect(ctx, "#efb8cf", -13, -60, 28, 22);
  rect(ctx, "#eeb3ce", -31, -43, 11, 13);
  rect(ctx, "#efb8cf", 17, -46, 15, 15);
  for (let i = 0; i < 30; i++) {
    const px = Math.floor(noise(i, 9) * 44) - 22;
    const py = Math.floor(noise(i, 6) * 25) - 49;
    rect(ctx, i % 2 ? "#f7cede" : "#d28db1", px, py, 2, 2);
  }
  ctx.restore();
}

function drawSurface(ctx: Context, w: number, h: number) {
  rect(ctx, "#bed6ed", 0, 0, w, h);
  // Make the cherry grove read immediately: pink sky bands, blossom canopy
  // fragments at the edges, and drifting petals around the clear title space.
  rect(ctx, "#e8c1d2", 0, 0, w, Math.max(5, h * .055));
  rect(ctx, "#d9b4cb", 0, Math.max(5, h * .055), w, Math.max(4, h * .035));
  for (let x = 0; x < w; x += 13) {
    if (x < w * .27 || x > w * .73) {
      const y = Math.floor(noise(x, 41) * 30);
      rect(ctx, noise(x, 42) > .5 ? "#e8aaca" : "#c97fa8", x, y, 7 + (x % 3), 4);
      rect(ctx, "#f4c8da", x + 4, y + 4, 4, 3);
    }
  }
  // Pixel cloud silhouettes leave the middle of the sky clear for the heading.
  for (const [cx, cy, cw] of [[w * .06, h * .15, 43], [w * .79, h * .22, 56], [w * .42, h * .6, 25]]) {
    rect(ctx, "#e8e8f2", cx, cy, cw, 5);
    rect(ctx, "#eff0f7", cx + 7, cy - 5, cw * .55, 6);
    rect(ctx, "#d6dcec", cx + 5, cy + 5, cw * .85, 2);
  }
  for (let x = 0; x < w; x += 6) {
    const hill = h * .71 + Math.sin(x / 43) * 7 + Math.sin(x / 19) * 5;
    rect(ctx, "#afaecb", x, hill, 6, h - hill);
    const near = h * .78 + Math.sin(x / 28 + 1) * 6;
    rect(ctx, "#9cabc1", x, near, 6, h - near);
  }
  for (let x = 0; x < w; x += 8) {
    const land = Math.floor((h * .86 + Math.sin(x / 26) * 6) / 4) * 4;
    rect(ctx, "#738f80", x, land, 8, h - land);
    rect(ctx, "#a7bd8d", x, land, 8, 3);
  }
  rect(ctx, "#7ca9c1", w * .25, h * .90, w * .5, h * .1);
  rect(ctx, "#97bed0", w * .34, h * .88, w * .33, h * .05);
  for (let i = 0; i < 18; i++) {
    rect(ctx, "#b3d0d8", w * (.30 + noise(i, 2) * .4), h * (.91 + noise(i, 3) * .08), 3 + noise(i, 4) * 12, 1);
  }
  const treeScale = Math.max(.55, Math.min(1.25, w / 290));
  cherryTree(ctx, w * .055, h * .91, treeScale);
  cherryTree(ctx, w * .93, h * .89, treeScale * 1.12);
  if (w > 220) {
    cherryTree(ctx, w * .2, h * .88, .55);
    cherryTree(ctx, w * .79, h * .87, .58);
  }
  for (let i = 0; i < 30; i++) {
    const side = i % 2 ? .02 + noise(i, 1) * .2 : .8 + noise(i, 1) * .18;
    rect(ctx, "#e8b0cb", w * side, h * (.94 + noise(i, 2) * .045), 2, 1);
  }
  for (const x of [w * .16, w * .84]) {
    rect(ctx, "#76576a", x, h * .24, 2, h * .26);
    rect(ctx, "#f2d28d", x - 3, h * .48, 8, 10);
    rect(ctx, "#73566b", x - 4, h * .46, 10, 3);
  }
  // A grass-and-soil cutaway meets the underground tilemap at the bottom edge.
  for (let x = 0; x < w; x += 16) {
    const top = h - 9 - (noise(x, 0) > .65 ? 3 : 0);
    rect(ctx, "#826659", x, top, 16, h - top);
    rect(ctx, "#aac68c", x, top, 16, 3);
    rect(ctx, "#667f56", x, top + 3, 16, 2);
    rect(ctx, "#a2836b", x + 3, top + 7, 3, 2);
  }
}

function drawCave(ctx: Context, w: number, h: number, layerStops: number[]) {
  const cols = Math.ceil(w / 16);
  const rows = Math.ceil(h / 16);
  // A wall texture, rather than a perspective cavern: broad strata keep the same
  // readable silhouette at every breakpoint while the ore families change with depth.
  const bases: Mineral[] = ["stone", "stone", "stone", "deepslate"];
  const pairs: Mineral[][] = [["emerald", "emerald"], ["iron", "coal"], ["gold", "redstone"], ["diamond", "diamond"]];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const rowPx = row * 16;
      const layer = Math.min(3, layerStops.filter(stop => rowPx > stop).length);
      const base = bases[layer];
      // Keep clusters grouped into little two-by-three pockets, like a hand-placed
      // texture atlas, instead of scattering isolated dots randomly.
      const pocket = noise(Math.floor(col / 2), Math.floor(row / 2), 8);
      const ore = pocket > (layer === 0 ? .82 : .78);
      const material: Mineral = ore ? pairs[layer][Math.floor(noise(col, row, 9) * 2)] : base;
      tile(ctx, col * 16, rowPx, material, (col + row * 3) % 7);
      if (row > 0 && (row % 3 === 0 || noise(col, row, 12) > .94)) {
        rect(ctx, layer === 3 ? "#1e212b" : "#3e424b", col * 16, rowPx, 16, 2);
      }
      if (row === Math.floor(rows * .56) || row === Math.floor(rows * .78)) {
        rect(ctx, layer === 3 ? "#1b1d25" : "#373b43", col * 16, rowPx, 16, 3);
      }
    }
  }
}

function drawNether(ctx: Context, w: number, h: number) {
  rect(ctx, "#281d2e", 0, 0, w, h);
  for (let col = 0; col < Math.ceil(w / 16); col++) {
    const ceiling = 1 + Math.floor(noise(col, 1) * 3);
    for (let row = 0; row < ceiling; row++) tile(ctx, col * 16, row * 16, "nether", col % 5);
    const side = col < Math.max(1, w / 110) || col > w / 16 - Math.max(2, w / 100);
    if (side) for (let row = ceiling; row < Math.ceil(h / 16); row++) tile(ctx, col * 16, row * 16, "nether", row % 5);
  }
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(noise(i, 1) * w);
    const y = Math.floor(noise(i, 2) * h);
    rect(ctx, i % 3 ? "#5f3844" : "#d28057", x, y, 1, 1);
  }
  rect(ctx, "#ad5949", 0, h - 9, w, 9);
  rect(ctx, "#df8e55", 0, h - 9, w, 2);
  for (let x = 0; x < w; x += 17) rect(ctx, "#f1b265", x, h - 7 + noise(x, 1) * 4, 9, 1);
}

/** Low-resolution drawing surface. Resizes only when layout changes; no animation loop. */
export function PixelBackdrop({ kind, className = "" }: { kind: "surface" | "cave" | "nether"; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !canvas.parentElement) return;
    const parent = canvas.parentElement;
    let frame = 0;
    const draw = () => {
      const w = Math.ceil(parent.clientWidth / 4);
      const h = Math.ceil(parent.clientHeight / 4);
      if (!w || !h) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      if (kind === "surface") drawSurface(ctx, w, h);
      if (kind === "nether") drawNether(ctx, w, h);
      if (kind === "cave") {
        const parentTop = parent.getBoundingClientRect().top;
        const stops = Array.from(parent.querySelectorAll<HTMLElement>("[data-layer]")).slice(1)
          .map(el => (el.getBoundingClientRect().top - parentTop) / 4);
        drawCave(ctx, w, h, stops);
      }
    };
    const queueDraw = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); };
    const observer = new ResizeObserver(queueDraw);
    observer.observe(parent);
    parent.querySelectorAll("[data-layer]").forEach(el => observer.observe(el));
    draw();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [kind]);
  return <canvas ref={ref} className={`mc-pixel-backdrop ${className}`} aria-hidden="true" />;
}

export function PixelSprite({ kind, animated = false, className = "" }: { kind: "portal" | "creeper"; animated?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let frame = 0;
    let last = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const draw = (time: number) => {
      ctx.clearRect(0, 0, 48, 64);
      if (kind === "creeper") {
        rect(ctx, "#75a75e", 10, 5, 28, 25);
        rect(ctx, "#65904e", 15, 30, 18, 22);
        rect(ctx, "#527a42", 10, 49, 12, 13);
        rect(ctx, "#527a42", 26, 49, 12, 13);
        for (let i = 0; i < 48; i++) {
          const x = 10 + Math.floor(noise(i, 1) * 26);
          const y = 5 + Math.floor(noise(i, 2) * 23);
          rect(ctx, i % 2 ? "#91bd76" : "#619149", x, y, 2, 2);
        }
        rect(ctx, "#233c2c", 15, 14, 6, 6);
        rect(ctx, "#233c2c", 27, 14, 6, 6);
        rect(ctx, "#233c2c", 21, 20, 6, 4);
        rect(ctx, "#233c2c", 18, 23, 12, 4);
        rect(ctx, "#233c2c", 18, 27, 4, 3);
        rect(ctx, "#233c2c", 26, 27, 4, 3);
        rect(ctx, "#345331", 10, 58, 12, 4);
        rect(ctx, "#345331", 26, 58, 12, 4);
      } else {
        rect(ctx, "#191728", 3, 1, 42, 62);
        for (let y = 1; y < 63; y += 7) {
          rect(ctx, "#393047", 3, y, 7, 6);
          rect(ctx, "#33283e", 38, y, 7, 6);
          rect(ctx, "#51415c", 5, y + 2, 3, 1);
        }
        rect(ctx, "#43334f", 10, 1, 28, 6);
        rect(ctx, "#43334f", 10, 57, 28, 6);
        const colors = ["#64448a", "#8055a4", "#a371bb", "#be8acb", "#9162b0"];
        for (let y = 7; y < 57; y += 2) for (let x = 10; x < 38; x += 2) {
          const wave = Math.sin(x * .32 + time / 700) + Math.cos(y * .22 - time / 950);
          rect(ctx, colors[Math.floor((wave + 2) * 1.24)], x, y, 2, 2);
        }
      }
    };
    const tick = (time: number) => {
      if (time - last > 90) { draw(time); last = time; }
      frame = requestAnimationFrame(tick);
    };
    draw(0);
    const start = () => { cancelAnimationFrame(frame); if (animated && kind === "portal" && !reduced.matches) frame = requestAnimationFrame(tick); else draw(0); };
    start();
    reduced.addEventListener("change", start);
    return () => { cancelAnimationFrame(frame); reduced.removeEventListener("change", start); };
  }, [kind, animated]);
  return <canvas width={48} height={64} ref={ref} className={`mc-pixel-sprite ${className}`} aria-hidden="true" />;
}
