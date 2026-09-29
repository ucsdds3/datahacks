import { useEffect, useRef, type CSSProperties } from "react";
import type { Chapter } from "./chapters";

const materials: Record<string, [string, string]> = {
  about: ["stone", "copper_ore"],
  tracks: ["stone", "iron_ore"],
  sponsors: ["andesite", "sulfur"],
  speakers: ["oak_log", "oak_planks"],
  prizes: ["deepslate", "deepslate_diamond_ore"],
  trials: ["deepslate_bricks", "copper_ore"],
  faq: ["deepslate_tiles", "sculk"],
  stronghold: ["cracked_deepslate_bricks", "deepslate_bricks"],
};

/** Decorative scenery only; navigation and text never move with the camera. */
export function SceneDepth({ chapter }: { chapter: Chapter }) {
  const ref = useRef<HTMLDivElement>(null);
  const surface = chapter.id === "hero";
  const textures = materials[chapter.id];

  useEffect(() => {
    const decoration = ref.current;
    const scene = decoration?.closest<HTMLElement>(".mc-chapter");
    const scroller = scene?.closest<HTMLElement>(".mc-story");
    const canvas = decoration?.querySelector("canvas");
    const context = canvas?.getContext("2d");
    if (!decoration || !scene || !scroller || !canvas || !context) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(pointer: fine)");
    let frame = 0;
    let visible = false;
    let width = 0;
    let height = 0;
    let last = 0;
    let time = 0;
    let x = 0;
    let y = 0;
    let targetX = 0;
    let targetY = 0;
    // Fixed seeds prevent layout changes and keep the motion repeatable.
    const particles = Array.from({ length: surface ? 23 : 12 }, (_, i) => ({
      x: ((i * 37 + 11) % 101) / 101,
      y: ((i * 61 + 7) % 103) / 103,
      depth: .3 + ((i * 19) % 17) / 17,
      phase: i * 2.399,
    }));
    const size = () => {
      width = scene.clientWidth;
      height = scene.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const draw = (now: number) => {
      frame = 0;
      if (!visible || document.hidden || reduce.matches) return;
      const dt = Math.min((now - (last || now)) / 1000, .04);
      last = now;
      time += dt;
      const ease = 1 - Math.exp(-dt * 4);
      x += (targetX - x) * ease;
      y += (targetY - y) * ease;
      const offset = Math.max(-1, Math.min(1, (scroller.scrollTop - scene.offsetTop) / Math.max(height, 1)));
      scene.style.setProperty("--camera-x", `${x * 10}px`);
      scene.style.setProperty("--camera-y", `${y * 7 + offset * 28}px`);
      decoration.style.setProperty("--lantern-sway", `${Math.sin(time * .65) * 2 + x * 1.5}deg`);
      context.clearRect(0, 0, width, height);
      for (const p of particles) {
        const drift = time * (surface ? 15 : 2.5) * p.depth;
        const px = (p.x * width + drift + Math.sin(time * .5 + p.phase) * 24 + x * p.depth * 18) % (width + 40) - 20;
        const py = (p.y * height + time * (surface ? 19 : -4) * p.depth + height * 10) % (height + 40) - 20 - offset * p.depth * 70;
        // The central reading area stays quiet. Nearer petals are larger and faster.
        const center = px > width * .24 && px < width * .76 && py > height * .12 && py < height * .75;
        context.globalAlpha = (surface ? .72 : .28) * (center ? .2 : 1);
        context.fillStyle = surface ? (p.depth > .8 ? "#f6bace" : "#e28daa") : chapter.color;
        const unit = surface ? 3 + p.depth * 4 : 1 + p.depth;
        context.save();
        context.translate(px, py);
        if (surface) {
          context.rotate(Math.sin(time * .8 + p.phase) * .7);
          context.scale(Math.max(.22, Math.abs(Math.cos(time * .8 + p.phase))), 1);
          context.fillRect(-unit, -unit / 2, unit * 2, unit);
          context.fillRect(-unit / 2, -unit, unit, unit * 2);
          context.fillStyle = "#ffe0e7";
          context.fillRect(-unit / 2, -unit / 2, unit / 2, unit / 2);
        } else context.fillRect(0, 0, unit, unit);
        context.restore();
      }
      frame = requestAnimationFrame(draw);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      last = 0;
      decoration.dataset.motion = visible && !reduce.matches ? "on" : "off";
      if (reduce.matches) {
        context.clearRect(0, 0, width, height);
        scene.style.removeProperty("--camera-x");
        scene.style.removeProperty("--camera-y");
        decoration.style.removeProperty("--lantern-sway");
      } else if (visible && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const move = (event: PointerEvent) => {
      if (!fine.matches || event.pointerType !== "mouse") return;
      const rect = scene.getBoundingClientRect();
      targetX = (event.clientX - rect.left) / width * 2 - 1;
      targetY = (event.clientY - rect.top) / height * 2 - 1;
    };
    const reset = () => { targetX = 0; targetY = 0; };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }, { root: scroller, threshold: 0 });
    const resize = new ResizeObserver(size);
    size();
    observer.observe(scene);
    resize.observe(scene);
    scene.addEventListener("pointermove", move, { passive: true });
    scene.addEventListener("pointerleave", reset);
    reduce.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      scene.removeEventListener("pointermove", move);
      scene.removeEventListener("pointerleave", reset);
      reduce.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      scene.style.removeProperty("--camera-x");
      scene.style.removeProperty("--camera-y");
    };
  }, [chapter.color, surface]);

  return <div ref={ref} className={`mc-scene-depth${surface ? " mc-scene-surface" : ""}`} aria-hidden="true">
    <canvas />
    {surface && <div className="mc-hanging-lantern">
      <div className="mc-lantern-chain" />
      <svg viewBox="0 0 88 122" fill="none">
        <path d="M37 4h14v17H37z" stroke="#303939" strokeWidth="6" />
        <path d="M21 26h46v12H21zM13 38h62v8H13z" fill="#394747" />
        <path d="m21 26 10-9h26l10 9" fill="#63706a" />
        <path d="M17 46h54v58H17z" fill="#ffb84e" />
        <path d="M27 47h33v53H27z" fill="#ffe1a2" />
        <path d="M36 62h15v33H36z" fill="#fff4cf" />
        <path d="M17 46h8v58h-8zM63 46h8v58h-8zM13 100h62v10H13zM21 110h46v8H21z" fill="#344343" />
        <path d="M25 46h5v54h-5zM13 100h62v4H13z" fill="#8e734c" />
        <path d="M71 46h7v54h-7zM67 110h8v8h-8z" fill="#202f31" />
        <path d="M17 38h50v3H17zM25 26h34v3H25z" fill="#97a096" />
      </svg>
    </div>}
    {textures && ["left", "right"].map(side => <div key={side} className={`mc-rock-ledge mc-rock-ledge-${side}`}>
      {[0, 1, 2].map(i => <div key={i} className={`mc-depth-block mc-depth-block-${i}`} style={{ "--block-texture": `url('/images/minecraft/textures/${textures[i === 1 ? 1 : 0]}.png')` } as CSSProperties}>
        <i className="mc-block-front" /><i className="mc-block-top" /><i className="mc-block-side" />
      </div>)}
    </div>)}
  </div>;
}
