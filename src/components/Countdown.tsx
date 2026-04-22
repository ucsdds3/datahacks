import { useEffect, useState } from "react";

interface CountdownProps {
  targetDate: string; // ISO string
}

function getRemaining(target: number) {
  const now = Date.now();
  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds };
}

export function Countdown({ targetDate }: CountdownProps) {
  const target = new Date(targetDate).getTime();
  const [time, setTime] = useState(() => getRemaining(target));

  useEffect(() => {
    const id = setInterval(() => setTime(getRemaining(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  const units: { label: string; value: number }[] = [
    { label: "Days", value: time.days },
    { label: "Hours", value: time.hours },
    { label: "Minutes", value: time.minutes },
    { label: "Seconds", value: time.seconds },
  ];

  return (
    <div className="grid grid-cols-4 gap-3 sm:gap-5">
      {units.map((u) => (
        <div
          key={u.label}
          className="flex flex-col items-center rounded-md border border-border/60 bg-card/70 px-3 py-4 backdrop-blur-sm sm:px-5 sm:py-5"
        >
          <span className="font-serif text-3xl font-medium tabular-nums text-foreground sm:text-5xl">
            {String(u.value).padStart(2, "0")}
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">
            {u.label}
          </span>
        </div>
      ))}
    </div>
  );
}
