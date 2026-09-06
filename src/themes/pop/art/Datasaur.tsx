import React from "react";
import { Box, C, Ground, Human, Prism } from "./iso";

/**
 * The Datasaur — POP treatment.
 * Isometric toy sauropod built from chunky primitive volumes, flat 3-tone shading per volume.
 * Orange body, marigold back plates, teal eyes. Sits on an implied ground plane, casts no shadow.
 * A tiny human stands at its feet for scale.
 *
 * Local iso space: the animal faces +y (screen: down-left). Tail runs to -y (screen: up-right).
 */
export default function Datasaur({
  className,
  human = true,
  grid = true,
  gridOpacity = 0.16,
}: {
  className?: string;
  human?: boolean;
  grid?: boolean;
  gridOpacity?: number;
}) {
  const body = C.orange;
  const limb = C.rust;
  const plate = C.marigold;

  return (
    <svg
      className={className}
      viewBox="-82 -68 140 134"
      role="img"
      aria-label="The Datasaur — an isometric toy sauropod with a tiny person standing beside it for scale"
      xmlns="http://www.w3.org/2000/svg"
    >
      {grid && (
        <Ground x0={-14} x1={42} y0={-30} y1={86} step={19} opacity={gridOpacity} />
      )}

      {/* ---- tail, far end first ---- */}
      <Box x={11} y={-34} z={7} w={6} d={8} h={6} c={limb} />
      <Box x={10} y={-28} z={9} w={8} d={10} h={8} c={limb} />
      <Box x={8} y={-20} z={10} w={12} d={12} h={12} c={body} />
      <Box x={6} y={-11} z={12} w={16} d={13} h={16} c={body} />

      {/* ---- rear legs ---- */}
      <Box x={0} y={2} z={0} w={11} d={11} h={12} c={limb} />
      <Box x={17} y={2} z={0} w={11} d={11} h={12} c={limb} />

      {/* ---- torso ---- */}
      <Box x={0} y={0} z={12} w={28} d={44} h={22} c={body} />
      <Box x={2} y={42} z={14} w={24} d={2.4} h={11} c={C.rust} front="#FFA97A" side="#FFA97A" />

      {/* ---- back plates ---- */}
      <Prism x={11} y={1} z={34} t={6} d={9} h={9} c={plate} />
      <Prism x={11} y={11} z={34} t={6} d={9} h={13} c={plate} />
      <Prism x={11} y={21} z={34} t={6} d={9} h={14} c={plate} />
      <Prism x={11} y={31} z={34} t={6} d={9} h={11} c={plate} />

      {/* ---- front legs ---- */}
      <Box x={0} y={31} z={0} w={11} d={11} h={12} c={limb} />
      <Box x={17} y={31} z={0} w={11} d={11} h={12} c={limb} />

      {/* ---- long neck, stepping up and forward ---- */}
      <Box x={6} y={38} z={30} w={16} d={13} h={14} c={body} />
      <Prism x={10.5} y={39} z={44} t={5} d={7} h={6} c={plate} />
      <Box x={6.5} y={44} z={42} w={15} d={12} h={14} c={body} />
      <Prism x={10.5} y={45} z={56} t={5} d={7} h={6} c={plate} />
      <Box x={7} y={49} z={54} w={14} d={11} h={13} c={body} />
      <Prism x={10.5} y={50} z={67} t={5} d={6} h={5} c={plate} />
      <Box x={7.5} y={54} z={65} w={13} d={10} h={12} c={body} />

      {/* ---- head ---- */}
      <Box x={4} y={57} z={75} w={20} d={17} h={17} c={body} />
      {/* crest */}
      <Prism x={9} y={58} z={92} t={6} d={15} h={7} c={plate} />
      {/* snout */}
      <Box x={7} y={70} z={75} w={14} d={15} h={10} c={body} />
      {/* nostril nubs */}
      <Box x={9} y={84.5} z={82} w={3} d={1.4} h={2} c={C.ink} />
      <Box x={16} y={84.5} z={82} w={3} d={1.4} h={2} c={C.ink} />
      {/* smile */}
      <Box x={9} y={85} z={77} w={10} d={0.8} h={1.6} c={C.ink} />

      {/* ---- eyes: teal volume + ink pupil, protruding from the head's front face ---- */}
      <Box x={5} y={74} z={85} w={6} d={2.4} h={6} c={C.teal} />
      <Box x={17} y={74} z={85} w={6} d={2.4} h={6} c={C.teal} />
      <Box x={6.4} y={76.4} z={86.4} w={3} d={1.2} h={3} c={C.ink} />
      <Box x={18.4} y={76.4} z={86.4} w={3} d={1.2} h={3} c={C.ink} />

      {/* ---- tiny human + a dropped data cube, for scale ---- */}
      {human && (
        <>
          <Box x={-16} y={70} z={0} w={9} d={9} h={9} c={C.teal} />
          <Human x={-9} y={56} shirt={C.cream} pants={C.ink} variant={1} />
        </>
      )}
    </svg>
  );
}
