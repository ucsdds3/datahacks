import React, { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

/**
 * Motion for the POP theme — exactly two moves:
 *  1. staggered float-up on section entry
 *  2. parallax drift on the isometric objects
 * Both are disabled under prefers-reduced-motion.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

export function Rise({
  children,
  i = 0,
  y = 26,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  i?: number;
  y?: number;
  className?: string;
  as?: "div" | "li" | "section" | "header";
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as] as typeof motion.div;
  if (reduce) return React.createElement(as, { className }, children);
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.6, delay: i * 0.07, ease: EASE }}
    >
      {children}
    </Tag>
  );
}

export function Drift({
  children,
  amount = 40,
  className,
}: {
  children: React.ReactNode;
  amount?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [amount, -amount]);
  return (
    <div ref={ref} className={className}>
      <motion.div style={reduce ? undefined : { y }}>{children}</motion.div>
    </div>
  );
}
