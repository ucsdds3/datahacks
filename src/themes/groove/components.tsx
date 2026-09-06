import type { ReactNode } from "react";
import { RibbonRule } from "./art/Ribbon";
import { Reveal } from "./motion";

/** Outline-only pill. The only button shape in this theme. */
export function Pill({
  children,
  href = "#",
  tone = "ink",
  size = "md",
  className = "",
}: {
  children: ReactNode;
  href?: string;
  tone?: "ink" | "cream";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <a className={`g-pill g-pill--${tone} g-pill--${size} ${className}`} href={href}>
      {children}
    </a>
  );
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`g-label ${className}`}>{children}</p>;
}

/**
 * Centred section head: eyebrow label, Poppins 800 heading, narrow calm body
 * column beneath. Used where the section wants a formal opening — not every
 * section uses it, on purpose.
 */
export function SectionHead({
  eyebrow,
  title,
  body,
  rule = false,
  align = "center",
}: {
  eyebrow: string;
  title: ReactNode;
  body?: ReactNode;
  rule?: boolean;
  align?: "center" | "left";
}) {
  return (
    <header className={`g-head g-head--${align}`}>
      <Reveal>
        <p className="g-label">{eyebrow}</p>
      </Reveal>
      <Reveal delay={0.06}>
        <h2 className="g-head__title">{title}</h2>
      </Reveal>
      {rule ? (
        <Reveal delay={0.1}>
          <RibbonRule className="g-head__rule" />
        </Reveal>
      ) : null}
      {body ? (
        <Reveal delay={0.12}>
          <p className="g-head__body">{body}</p>
        </Reveal>
      ) : null}
    </header>
  );
}
