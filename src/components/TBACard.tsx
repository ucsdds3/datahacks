import { ReactNode } from "react";

interface TBACardProps {
  label?: string;
  sublabel?: string;
  icon?: ReactNode;
  className?: string;
  variant?: "default" | "person" | "logo";
}

export function TBACard({
  label = "To Be Announced",
  sublabel,
  icon,
  className = "",
  variant = "default",
}: TBACardProps) {
  if (variant === "person") {
    return (
      <div
        className={`group flex flex-col items-center rounded-lg border border-border/60 bg-card/60 p-6 text-center backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:bg-card ${className}`}
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border/60 bg-muted">
          <svg
            viewBox="0 0 24 24"
            className="h-10 w-10 text-muted-foreground/60"
            fill="currentColor"
          >
            <circle cx="12" cy="9" r="4" />
            <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
          </svg>
        </div>
        <p className="mt-4 font-serif text-lg text-foreground">{label}</p>
        {sublabel ? (
          <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            {sublabel}
          </p>
        ) : null}
      </div>
    );
  }

  if (variant === "logo") {
    return (
      <div
        className={`flex h-24 items-center justify-center rounded-md border border-dashed border-border bg-card/40 px-6 text-xs uppercase tracking-[0.18em] text-muted-foreground/70 ${className}`}
      >
        {label}
      </div>
    );
  }

  return (
    <div
      className={`group relative overflow-hidden rounded-lg border border-border/60 bg-card/60 p-6 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:bg-card ${className}`}
    >
      {icon ? <div className="mb-4 text-accent">{icon}</div> : null}
      {sublabel ? (
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
          {sublabel}
        </p>
      ) : null}
      <p className="mt-2 font-serif text-xl text-foreground">{label}</p>
    </div>
  );
}
