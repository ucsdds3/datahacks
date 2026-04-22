import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "#about", label: "About" },
  { href: "#tracks", label: "Tracks" },
  { href: "#prizes", label: "Prizes" },
  { href: "#challenges", label: "Challenges" },
  { href: "#sponsors", label: "Sponsors" },
  { href: "#judges", label: "Judges" },
  { href: "#mentors", label: "Mentors" },
  { href: "#faq", label: "FAQ" },
  { href: "#contact", label: "Contact" },
];

interface SiteNavProps {
  registerUrl: string;
}

export function SiteNav({ registerUrl }: SiteNavProps) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-border/60 bg-background/85 backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <a href="#top" className="flex items-baseline gap-2">
          <span className="font-serif text-xl font-medium tracking-tight text-foreground">
            DataHacks
          </span>
          <span className="text-xs font-medium text-accent">2027</span>
        </a>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <a href={registerUrl} target="_blank" rel="noopener noreferrer">
              Register
            </a>
          </Button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-card/60 text-foreground lg:hidden"
            aria-label="Toggle menu"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-border/60 bg-background/95 backdrop-blur-md lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-5 py-4">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b border-border/40 py-3 text-sm text-foreground last:border-b-0"
              >
                {l.label}
              </a>
            ))}
            <Button asChild size="sm" className="mt-4 sm:hidden">
              <a href={registerUrl} target="_blank" rel="noopener noreferrer">
                Register
              </a>
            </Button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
