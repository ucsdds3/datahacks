import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";
import { PixelItem, type Item } from "./PixelItem";

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} initial={reduce ? false : { opacity:0, y:18 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true, amount:.1 }} transition={{ duration:.45, ease:[.2,.7,.3,1] }}>{children}</motion.div>;
}

const inventory: { item: Item; name: string; note: string }[] = [
  { item:"book", name:"The field guide", note:"Workshops and mentors, from your first line of code to your final demo." },
  { item:"compass", name:"Your compass", note:"Find a problem you care about. We’ll help you find a way in." },
  { item:"pickaxe", name:"The builder’s pick", note:"Try, test, and try again. Every discovery starts with a little digging." },
];

export function CraftingPanel() {
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [crafted, setCrafted] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const ingredients: (Item | null)[] = ["torch",null,"code",null,"emerald",null,"code",null,"torch"];
  useEffect(() => () => clearTimeout(timer.current), []);
  const craft = () => {
    if (busy) return;
    setCrafted(false); setCycle(value => value + 1); setBusy(true);
    timer.current = setTimeout(() => { setCrafted(true); setBusy(false); }, reduce ? 0 : 800);
  };
  return <Reveal className="mc-crafting-wrap"><div className="mc-panel mc-crafting">
    <div className="mc-panel-title"><span>Crafting</span><span className="mc-craft-status">{crafted ? "COMPLETE" : "RECIPE 01"}</span></div>
    <div className="mc-recipe"><div className="mc-crafting-grid" aria-hidden="true">{ingredients.map((item, i) => <span className="mc-slot" key={i}>{item && <motion.span key={`${i}-${cycle}`} className="mc-crafting-ingredient" initial={false} animate={busy && !reduce ? { x:[0, (1 - i % 3) * 14, 95], y:[0,(1 - Math.floor(i / 3)) * 14,0], opacity:[1,1,0], scale:[1,.85,.3] } : { x:0, y:0, opacity:1, scale:1 }} transition={{ duration:.6, delay:i * .018, ease:"easeInOut" }}><PixelItem item={item} /></motion.span>}</span>)}</div><span className="mc-craft-arrow" aria-hidden="true">→</span><motion.button type="button" className={`mc-slot mc-result ${crafted ? "is-crafted" : ""}`} aria-label="Craft your first discovery" aria-busy={busy} disabled={busy} onClick={craft} data-mineable whileTap={reduce ? undefined : { scale:.96 }} animate={crafted && !reduce ? { scale:[1,1.09,1] } : { scale:1 }} transition={{ duration:.3 }}><PixelItem item={crafted ? "diamond" : "emerald"} /><b>1</b></motion.button></div>
    <p className="mc-recipe-label">Curiosity + code + your people.</p><button className="mc-craft-action" onClick={craft} disabled={busy}>{busy ? "Crafting…" : crafted ? "Craft again ↻" : "Craft your first discovery →"}</button>
    <div className="mc-inventory-caption">Inventory <span>SELECT AN ITEM</span></div><div className="mc-inventory" role="group" aria-label="Explore your inventory">{Array.from({ length:9 }, (_, i) => inventory[i] ? <motion.button key={i} type="button" className={`mc-slot ${selected === i ? "is-selected" : ""}`} aria-label={inventory[i].name} aria-pressed={selected === i} onClick={() => setSelected(i)} data-mineable whileTap={reduce ? undefined : { scale:.92 }}><PixelItem item={inventory[i].item} /></motion.button> : <span className="mc-slot" key={i} aria-hidden="true" />)}</div>
    <div className="mc-inventory-description" aria-live="polite"><strong>{inventory[selected].name}</strong><p>{inventory[selected].note}</p></div>
  </div><div className="mc-achievement" role="status"><PixelItem item={crafted ? "diamond" : "trophy"} /><span><small>{crafted ? "Achievement unlocked!" : "Your first recipe"}</small><strong>{crafted ? "A brilliant idea, crafted together." : "A little curiosity. Something worth making."}</strong></span></div></Reveal>;
}

export function PickaxeCursor() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const tool = element.querySelector<HTMLElement>(".mc-cursor-tool");
    const sprite = element.querySelector<HTMLImageElement>("img");
    let swings: Animation[] = [];
    const end = () => { document.documentElement.classList.remove("mc-custom-cursor"); element.classList.remove("is-visible"); swings.forEach(animation => animation.cancel()); };
    const updateMode = () => { if (!fine.matches || reduced.matches) end(); };
    const position = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!fine.matches || reduced.matches || event.pointerType !== "mouse" || !sprite?.complete || !sprite.naturalWidth || !target?.closest(".minecraft-root") || target.closest("input,textarea,select,[contenteditable]")) { end(); return; }
      document.documentElement.classList.add("mc-custom-cursor");
      element.classList.add("is-visible");
      element.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0)`;
    };
    const down = (event: PointerEvent) => {
      position(event);
      if (!element.classList.contains("is-visible") || event.button !== 0 || !tool) return;
      const target = event.target instanceof Element ? event.target.closest("[data-mineable], .mc-button, .mc-sponsor-slot, .mc-day-tabs button") : null;
      if (!target || target.matches(":disabled,[aria-disabled=true]")) return;
      swings.forEach(animation => animation.cancel());
      swings = [tool.animate([
        { transform:"translate(-28px,-14px) rotate(0deg)" },
        { transform:"translate(-28px,-14px) rotate(18deg)", offset:.25 },
        { transform:"translate(-28px,-14px) rotate(-32deg)", offset:.55 },
        { transform:"translate(-28px,-14px) rotate(0deg)" },
      ], { duration:240, easing:"cubic-bezier(.2,.65,.35,1)" })];
      element.querySelectorAll<HTMLElement>("i").forEach((chip, i) => swings.push(chip.animate([
        { transform:"translate(0,0)", opacity:0 },
        { transform:"translate(0,0)", opacity:.8, offset:.4 },
        { transform:`translate(${(i-1)*10}px,${-10-i*5}px)`, opacity:0 },
      ], { duration:300, easing:"ease-out" })));
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("pointermove", position, { passive:true });
    document.addEventListener("pointerleave", end);
    window.addEventListener("blur", end);
    fine.addEventListener("change", updateMode);
    reduced.addEventListener("change", updateMode);
    return () => { end(); document.removeEventListener("pointerdown", down); document.removeEventListener("pointermove", position); document.removeEventListener("pointerleave", end); window.removeEventListener("blur", end); fine.removeEventListener("change", updateMode); reduced.removeEventListener("change", updateMode); };
  }, []);
  return createPortal(<div ref={ref} className="mc-cursor-impact mc-vanilla-cursor" aria-hidden="true"><div className="mc-cursor-tool"><img src="/images/minecraft/exploration/diamond-pickaxe.png" alt="" width="32" height="32" /></div>{[0,1,2].map(i=><i key={i} />)}</div>, document.body);
}
