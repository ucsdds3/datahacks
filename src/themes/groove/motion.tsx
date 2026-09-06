import type { ReactNode } from "react";
import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";

/**
 * Exactly two motion ideas for this theme:
 *   1. staggered float-up on section entry
 *   2. parallax drift on the doodles, tied to scroll
 * Both no-op under prefers-reduced-motion.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
  y = 26,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "header" | "p" | "h2";
  y?: number;
}) {
  const reduced = useReducedMotion();
  const Tag = motion[as] as typeof motion.div;

  if (reduced) {
    const Plain = as as "div";
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px -10% 0px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </Tag>
  );
}

/** Stagger container: children floating up one after another. */
export function RevealGroup({
  children,
  className,
  step = 0.09,
  count,
}: {
  children: ReactNode[];
  className?: string;
  step?: number;
  count?: number;
}) {
  const n = count ?? children.length;
  return (
    <div className={className}>
      {children.map((child, i) => (
        <Reveal key={i} delay={Math.min(i, n) * step}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}

/**
 * Parallax drift. Returns a MotionValue for `y` derived from page scroll.
 * `speed` is in px of travel across the full viewport pass.
 */
export function useDrift(speed: number): MotionValue<number> {
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  const raw = useTransform(scrollY, (v) => (reduced ? 0 : (v / 900) * speed));
  return useSpring(raw, { stiffness: 90, damping: 24, mass: 0.4 });
}

/** Same, but measured relative to a container entering the viewport. */
export function useSectionDrift(speed: number) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const raw = useTransform(scrollYProgress, [0, 1], [speed, -speed]);
  const y = useSpring(raw, { stiffness: 80, damping: 26, mass: 0.5 });
  return { ref, y: reduced ? undefined : y };
}

export function DriftingDoodle({
  children,
  className,
  speed = 40,
  spin = 0,
}: {
  children: ReactNode;
  className?: string;
  speed?: number;
  spin?: number;
}) {
  const reduced = useReducedMotion();
  const y = useDrift(speed);

  if (reduced) {
    return (
      <div className={className} style={{ transform: `rotate(${spin}deg)` }} aria-hidden="true">
        {children}
      </div>
    );
  }

  return (
    <motion.div className={className} style={{ y, rotate: spin }} aria-hidden="true">
      {children}
    </motion.div>
  );
}
