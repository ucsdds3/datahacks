/**
 * The portal's page colours, painted on <html> before and behind everything so a page
 * that's still loading (or overscrolled) is never white.
 */

/** The End's deep purple, under the artwork on the sign-in, apply and portal pages. */
export const PORTAL_BACKGROUND = "#170d29";

/** The Nether theme's netherrack red (see portalTheme.ts and staff-portal/nether/). */
export const NETHER_BACKGROUND = "#2a0f10";

/** The page colour for each portal theme. */
export const THEME_BACKGROUND = { end: PORTAL_BACKGROUND, nether: NETHER_BACKGROUND } as const;

/** The organizer console keeps its own mossy green. */
export const ORGANIZER_BACKGROUND = "#26382f";
