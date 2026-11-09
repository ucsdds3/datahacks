import { NETHER_ONLY, PORTAL_THEMES, setPortalTheme, usePortalTheme } from "@/portal/portalTheme";
import "./theme-toggle.css";

/** Switches the portal between its looks. The choice is remembered on this device. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = usePortalTheme();
  if (NETHER_ONLY) return null;
  return (
    <div className={`sp-theme-toggle ${className}`} role="group" aria-label="Portal theme">
      {PORTAL_THEMES.map(t => (
        <button key={t.id} type="button" aria-pressed={theme === t.id} onClick={() => setPortalTheme(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
