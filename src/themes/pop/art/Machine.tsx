import React from "react";
import { Box, C, Cyl, Ground, Human } from "./iso";

/**
 * The Hackathon Machine — an isometric contraption for the About band.
 * Raw data drops into the hopper, the machine chews for 36 hours, finished
 * projects come out on the belt. Two tiny operators, for scale.
 *
 * Everything is drawn back-to-front (painter's order): far objects first.
 */
export default function Machine({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="-80 -72 174 164"
      role="img"
      aria-label="An isometric machine that turns data cubes into finished projects, with two tiny people working beside it"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <Ground x0={-6} x1={90} y0={-12} y1={80} step={19} opacity={0.15} />

      {/* ---------- far: server tower + pipe ---------- */}
      <Box x={76} y={-16} z={0} w={20} d={22} h={44} c={C.ink} />
      {[8, 16, 24, 32].map((z) => (
        <Box key={z} x={78} y={6} z={z} w={16} d={1.2} h={3} c={C.teal} />
      ))}
      <Box x={78} y={6} z={37} w={4} d={1.2} h={2} c={C.orange} />
      <Box x={62} y={-6} z={24} w={16} d={10} h={9} c={C.grey} />

      {/* ---------- plinth + housing ---------- */}
      <Box x={7} y={5} z={0} w={62} d={54} h={5} c={C.ink} top="#2C2926" front="#181615" side="#0B0A0A" />
      <Box x={10} y={8} z={5} w={56} d={48} h={45} c={C.grey} />

      {/* screen set into the front face */}
      <Box x={17} y={54} z={20} w={32} d={2.4} h={22} c={C.teal} />
      <Box x={20} y={56.4} z={23} w={4} d={1} h={6} c={C.ink} />
      <Box x={26} y={56.4} z={23} w={4} d={1} h={11} c={C.ink} />
      <Box x={32} y={56.4} z={23} w={4} d={1} h={8} c={C.ink} />
      <Box x={38} y={56.4} z={23} w={4} d={1} h={14} c={C.ink} />
      <Box x={44} y={56.4} z={23} w={2} d={1} h={4} c={C.ink} />

      {/* front panel furniture */}
      <Box x={53} y={54} z={22} w={9} d={2.4} h={9} c={C.orange} />
      <Box x={17} y={54} z={11} w={45} d={2} h={4} c={C.marigold} />
      {/* side vent on the x+w face */}
      <Box x={66} y={14} z={16} w={2} d={10} h={22} c={C.marigold} />

      {/* ---------- top deck ---------- */}
      <Box x={13} y={11} z={50} w={5} d={5} h={4} c={C.teal} />
      <Box x={20} y={11} z={50} w={5} d={5} h={4} c={C.marigold} />
      <Box x={27} y={11} z={50} w={5} d={5} h={4} c={C.pink} />
      <Cyl x={55} y={22} z={50} r={7} h={5} c={C.orange} />
      <Cyl x={32} y={35} z={50} r={9} h={11} c={C.marigold} />
      <Cyl x={32} y={35} z={61} r={13} h={4} c={C.marigold} />

      {/* raw data falling in */}
      <Box x={27} y={30} z={68} w={10} d={10} h={10} c={C.teal} />
      <Box x={47} y={17} z={74} w={7} d={7} h={7} c={C.orange} />
      <Box x={14} y={44} z={80} w={6} d={6} h={6} c={C.pink} />
      <Box x={50} y={44} z={62} w={5} d={5} h={5} c={C.marigold} />

      {/* ---------- near: steps, belt, output ---------- */}
      <Box x={68} y={40} z={0} w={12} d={12} h={8} c={C.grey} />
      <Box x={68} y={40} z={8} w={12} d={6} h={8} c={C.grey} />

      <Box x={10} y={58} z={2} w={24} d={42} h={6} c={C.ink} top="#332F2B" front="#1B1918" side="#0C0B0B" />
      <Box x={13} y={62} z={8} w={9} d={9} h={9} c={C.teal} />
      <Box x={21} y={76} z={8} w={9} d={9} h={9} c={C.orange} />
      <Box x={13} y={88} z={8} w={9} d={9} h={9} c={C.pink} />

      {/* ---------- operators ---------- */}
      <Human x={88} y={28} shirt={C.orange} pants={C.ink} variant={1} />
      <Human x={38} y={92} shirt={C.marigold} pants={C.ink} variant={2} />
    </svg>
  );
}
