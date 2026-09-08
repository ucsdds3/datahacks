/** The generated stone ring sits above an independent, animated portal surface. */
export function PortalFrame({ className = "" }: { className?: string }) {
  return <span className={`mc-obsidian-portal ${className}`} aria-hidden="true">
    <span className="mc-portal-surface"><i /><b /></span>
    <img className="mc-portal-stone" src="/images/minecraft/dimensions/obsidian-portal-frame.webp" alt="" width="1024" height="1536" decoding="async" />
  </span>;
}
