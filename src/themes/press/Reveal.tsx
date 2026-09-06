import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

type RevealProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  /** cinematic blocks fade slower and travel less than small elements */
  delay?: number;
  as?: "section" | "div" | "footer";
};

/**
 * Motion #2 of two: a cinematic fade-through as each colour block enters.
 * Fully disabled under prefers-reduced-motion — no transform, no fade.
 */
export default function Reveal({ children, className, id, delay = 0, as = "section" }: RevealProps) {
  const reduce = useReducedMotion();
  const Tag = motion[as];

  if (reduce) {
    const Plain = as;
    return (
      <Plain className={className} id={id}>
        {children}
      </Plain>
    );
  }

  return (
    <Tag
      id={id}
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12, margin: "0px 0px -6% 0px" }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Tag>
  );
}
