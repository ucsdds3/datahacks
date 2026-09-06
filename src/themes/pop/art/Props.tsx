import React from "react";
import { Box, C, Cyl, Human, Shade } from "./iso";

/** One tiny human on its own, sized to sit on a baseline. */
export function Person({
  className,
  shirt = C.teal,
  variant = 0,
}: {
  className?: string;
  shirt?: Shade;
  variant?: 0 | 1 | 2;
}) {
  return (
    <svg
      className={className}
      viewBox="-10 -23 21 27.5"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <Human x={0} y={0} shirt={shirt} variant={variant} />
    </svg>
  );
}

/** Laptop — base slab, keyboard plate, upright screen. */
export function Laptop({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="-22 -26 50 54"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <Box x={0} y={0} z={0} w={28} d={20} h={3} c={C.grey} />
      <Box x={3} y={6} z={3} w={22} d={11} h={0.8} c={C.ink} top="#2B2926" front="#151312" side="#0A0909" />
      <Box x={0} y={0} z={3} w={28} d={2.6} h={18} c={C.ink} />
      <Box x={2} y={2.6} z={5} w={24} d={0.8} h={14} c={C.teal} />
      <Box x={4} y={3.4} z={7} w={9} d={0.6} h={2} c={C.cream} />
      <Box x={4} y={3.4} z={11} w={15} d={0.6} h={2} c={C.cream} />
    </svg>
  );
}

/** Coffee cup with a couple of steam cubes. */
export function Coffee({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="-18 -34 38 52"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <Cyl x={8} y={8} z={0} r={8} h={13} c={C.cream} />
      <Cyl x={8} y={8} z={12.4} r={5.6} h={0.4} c={C.ink} />
      <Box x={15} y={6} z={4} w={4} d={4} h={5} c={C.cream} />
      <Box x={4} y={2} z={20} w={4} d={4} h={4} c={C.marigold} />
      <Box x={10} y={10} z={26} w={3} d={3} h={3} c={C.orange} />
    </svg>
  );
}

/** Server rack with teal slats. */
export function Server({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="-24 -54 50 80"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <Box x={0} y={0} z={0} w={22} d={18} h={46} c={C.ink} />
      {[6, 14, 22, 30, 38].map((z) => (
        <Box key={z} x={2} y={18} z={z} w={18} d={1.2} h={3} c={C.teal} />
      ))}
      <Box x={2} y={18} z={42} w={4} d={1.2} h={2} c={C.orange} />
    </svg>
  );
}

/** Trophy — base, stem, cup, two handles. */
export function Trophy({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="-20 -34 42 50.5"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <Box x={0} y={0} z={0} w={18} d={14} h={5} c={C.ink} />
      <Cyl x={9} y={7} z={5} r={3.2} h={7} c={C.marigold} />
      <Box x={1.5} y={0.5} z={12} w={15} d={13} h={2} c={C.marigold} />
      <Cyl x={9} y={7} z={14} r={9} h={11} c={C.marigold} />
      <Box x={-2} y={5} z={17} w={3} d={4} h={6} c={C.marigold} />
      <Box x={19} y={5} z={17} w={3} d={4} h={6} c={C.marigold} />
    </svg>
  );
}

/** A single floating data cube — used as a small punctuation mark. */
export function Cube({
  className,
  shade = C.teal,
}: {
  className?: string;
  shade?: Shade;
}) {
  return (
    <svg
      className={className}
      viewBox="-14 -20 28 30"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <Box x={0} y={0} z={0} w={14} d={14} h={14} c={shade} />
    </svg>
  );
}

/** Stack of cubes with a person beside it — used in the sponsors band. */
export function CubeStack({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="-46 -50 96 80"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <Box x={0} y={0} z={0} w={18} d={18} h={16} c={C.marigold} />
      <Box x={0} y={0} z={16} w={18} d={18} h={16} c={C.teal} />
      <Box x={2} y={2} z={32} w={14} d={14} h={13} c={C.orange} />
      <Box x={22} y={4} z={0} w={14} d={14} h={12} c={C.cream} />
      <Human x={-14} y={16} shirt={C.pink} variant={1} />
    </svg>
  );
}
