import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PortalFrame } from "./PortalFrame";
import { useStory } from "./Story";

const ease = [.22, 1, .36, 1] as const;
/** How long the break/open animation plays before the chapter changes under it. */
const BREAK = 620;

function Minecart({ opened }: { opened: boolean }) {
  return <svg viewBox="0 0 160 150" className="mc-cart-art" aria-hidden="true" shapeRendering="crispEdges">
    <path fill="#182024" d="M16 90h124v38H16zM25 125h22v16H25zM114 125h22v16h-22z" />
    <path fill="#858b88" d="m12 88 20-12h96l20 12v38H12z" /><path fill="#b6bab1" d="M12 88h136v8H12z" />
    <path fill="#535d5e" d="M22 100h116v19H22z" /><path fill="#969e98" d="M28 103h104v4H28z" />
    <path fill="#362715" d="M36 48h88v42H36z" /><path fill="#976127" d="M42 52h76v32H42z" />
    <motion.g style={{ transformOrigin: "80px 48px" }} animate={{ y: opened ? -23 : 0, rotate: opened ? -12 : 0 }} transition={{ type: "spring", stiffness: 190, damping: 20 }}>
      <path fill="#362715" d="M32 25h96v30H32z" /><path fill="#c38b36" d="M38 29h84v19H38z" />
      <path fill="#e6b552" d="M38 29h84v5H38z" /><path fill="#705024" d="M48 29h6v19h-6zM107 29h6v19h-6z" />
      <path fill="#dae2d6" d="M76 44h10v15H76z" /><path fill="#7e8984" d="M80 48h3v7h-3z" />
    </motion.g>
    <path fill="#ced4c8" d="M18 101h4v4h-4zM138 101h4v4h-4z" />
  </svg>;
}

/** The thing you click to leave a chapter. Nothing else moves the story forward by
 * mouse, so every chapter but the last has one. */
export function ChapterExit() {
  const { chapter, upcoming, next } = useStory();
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [breaking, setBreaking] = useState(false);
  const exit = chapter.exit;
  if (!exit || !upcoming) return null;
  const { kind, label, caption } = exit;

  const leave = () => {
    if (breaking) return;
    // Read the query here rather than trusting the cached hook value, so the
    // preference is honoured even if it changed since mount.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { next(); return; }
    setBreaking(true);
    window.setTimeout(next, BREAK);
  };

  return <motion.button type="button" onClick={leave} onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)} className={`mc-encounter mc-encounter-${kind}`} data-mineable aria-label={`${label} — continue to ${upcoming.name}`}>
    <span className="mc-encounter-scene" aria-hidden="true">
      <span className="mc-scene-floor" />
      <motion.span className="mc-scene-light" animate={{ opacity: breaking ? .85 : hovered ? .55 : .18, scale: breaking ? 1.2 : 1 }} transition={{ duration: .35 }} />
      {kind === "skeleton" && <motion.img className="mc-skeleton-art" src="/images/minecraft/exploration/skeleton.png" alt="" width="554" height="1024" loading="lazy" animate={breaking ? { x: [0, -8, 30, 60], y: [0, -4, 5, 28], rotate: [0, -5, 18, 80], opacity: [1, 1, 1, 0] } : { x: 0, y: 0, rotate: hovered && !reduced ? -4 : 0, opacity: 1 }} transition={{ duration: breaking ? .6 : .3, ease }} />}
      {kind === "dig" && <span className="mc-dig-face">{Array.from({ length: 9 }, (_, i) => <motion.span key={i} className="mc-dig-block" style={{ backgroundPosition: `${i % 3 * 40}% ${Math.floor(i / 3) * 40}%` }} animate={breaking ? { x: (i % 3 - 1) * 65, y: (Math.floor(i / 3) - 1) * 45 + 25, rotate: (i - 4) * 12, opacity: 0, scale: .6 } : { x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }} transition={{ delay: breaking ? .08 + Math.abs(i - 4) * .025 : 0, duration: .45, ease }} />)}<motion.span className="mc-dig-cracks" animate={{ opacity: hovered || breaking ? 1 : 0 }} /></span>}
      {kind === "chest" && <motion.span className="mc-cart-wrap" animate={breaking ? { x: [0, -6, 0, 35], y: [0, -3, 0, 0] } : { x: 0, y: hovered && !reduced ? -3 : 0 }} transition={{ duration: .65, ease }}><Minecart opened={breaking || (hovered && !reduced)} /></motion.span>}
      {kind === "portal" && <motion.span className="mc-exit-portal" animate={{ scale: breaking ? 1.25 : hovered && !reduced ? 1.05 : 1, opacity: breaking ? 0 : 1 }} transition={{ duration: .6, ease }}><PortalFrame /></motion.span>}
      {kind === "end" && <motion.img className="mc-exit-end" src="/images/minecraft/layers/end-portal.png" alt="" width="400" height="400" loading="lazy" animate={breaking ? { scale: [1, 1.15, 14], opacity: [1, 1, 0] } : { scale: hovered && !reduced ? 1.05 : 1, opacity: 1 }} transition={{ duration: .6, ease }} />}
      {Array.from({ length: 8 }, (_, i) => <motion.i key={i} className={`mc-scene-particle mc-scene-particle-${kind}`} initial={false} animate={breaking ? { x: Math.cos(i * 2.4) * (40 + i * 7), y: [-25, -65 - i * 4, 40], opacity: [0, 1, 0], rotate: i * 65, scale: [1, 1, .3] } : { x: 0, y: 0, opacity: 0, rotate: 0, scale: 1 }} transition={{ duration: .65, delay: i * .015, ease: "easeOut" }} />)}
      <motion.span className="mc-scene-crosshair" animate={{ opacity: hovered && !breaking ? 1 : 0, scale: hovered ? 1 : 1.3 }} transition={{ duration: .2 }} />
    </span>
    <span className="mc-encounter-label"><small>{caption}</small><strong>{label}<motion.span aria-hidden="true" animate={{ y: hovered && !reduced ? 3 : 0 }}>↓</motion.span></strong><span>{upcoming.name}</span></span>
  </motion.button>;
}
