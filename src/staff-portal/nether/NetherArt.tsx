import { usePortalTheme } from "@/portal/portalTheme";
import type { ApplicationStatus } from "../config";

/*
 * Decorative art for the Nether theme: the treasure chest from Figma's "Status – Accepted",
 * Dyno (the "dyno spot" on "Status – In review"), Dyno in full diamond for a signed waiver,
 * and the page's loose Nether mobs and stalactite. Purely ornamental (alt="", aria-hidden),
 * and nothing at all is rendered in the End, so the End's markup is untouched.
 * Styles: nether-status.css. Files: public/images/portal-nether/status/.
 */

const ART = {
  chest: { width: 679, height: 664 },
  dyno: { width: 156, height: 162 },
  "dyno-diamond": { width: 344, height: 308 },
  strider: { width: 332, height: 380 },
  ghast: { width: 368, height: 336 },
  stalactite: { width: 258, height: 188 },
} as const;

export type NetherArtName = keyof typeof ART;

const src = (file: string) => `/images/portal-nether/status/${file}.webp`;

function Art({ name, celebrate = false }: { name: NetherArtName; celebrate?: boolean }) {
  const { width, height } = ART[name];
  // Dyno blinks: a second frame laid over the first (see .sp-nether-art-dyno).
  if (name === "dyno") {
    return (
      <span className={`sp-nether-art sp-nether-art-dyno${celebrate ? " is-celebrating" : ""}`} aria-hidden>
        <img src={src("dyno")} alt="" width={width} height={height} decoding="async" />
        <img className="sp-nether-dyno-blink" src={src("dyno-blink")} alt="" width={width} height={height} decoding="async" />
      </span>
    );
  }
  return <img className={`sp-nether-art sp-nether-art-${name}`} src={src(name)} alt="" aria-hidden width={width} height={height} decoding="async" />;
}

/** One piece of Nether art, or nothing in the End. */
export function NetherArt({ name, celebrate = false }: { name: NetherArtName; celebrate?: boolean }) {
  return usePortalTheme() === "nether" ? <Art name={name} celebrate={celebrate} /> : null;
}

const STATUS_ART: Record<ApplicationStatus, NetherArtName> = {
  pending: "dyno",
  waitlisted: "strider",
  accepted: "chest",
  rejected: "ghast",
};

/** The status page's art for where the application stands. */
/** `celebrate` plays Dyno's hop-in once, right after an application is submitted. */
export const NetherStatusArt = ({ status, celebrate = false }: { status: ApplicationStatus; celebrate?: boolean }) => (
  <NetherArt name={STATUS_ART[status]} celebrate={celebrate} />
);
