import { usePortalTheme } from "@/portal/portalTheme";
import { EndSky } from "./EndSky";
import { NetherSky } from "./nether/NetherSky";

/** The artwork behind the portal for the current theme. */
export function PortalBackdrop() {
  return usePortalTheme() === "nether" ? <NetherSky /> : <EndSky />;
}

/** The root class that scopes each theme's stylesheet: `sp-end` or `sp-nether`. */
export const useThemeClass = () => `sp-${usePortalTheme()}`;
