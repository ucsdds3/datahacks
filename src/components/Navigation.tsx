import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetOverlay,
} from "@/components/ui/sheet";

const navLinks = [
  { name: "Devpost", href: "https://datahacks-2026.devpost.com/" },
  { name: "Tracks", href: "#tracks" },
  { name: "Prizes", href: "#prizes" },
  { name: "Challenges", href: "#challenges" },
  { name: "Sponsors", href: "#sponsors" },
  { name: "Judges", href: "#team" },
  { name: "FAQ", href: "#faq" },
  { name: "Contact", href: "#contact" },
];

const Navigation = () => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = Math.min(window.scrollY / totalHeight, 1);
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getBackgroundStyle = () => {
    if (scrollProgress < 0.1) return "bg-sky/80 backdrop-blur-sm";
    if (scrollProgress < 0.3) return "bg-shallow-water/80 backdrop-blur-sm";
    if (scrollProgress < 0.6) return "bg-mid-water/90 backdrop-blur-sm";
    return "bg-deep-water/95 backdrop-blur-sm";
  };

  const getTextColor = () =>
    scrollProgress > 0.3 ? "text-white" : "text-foreground";

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${getBackgroundStyle()}`}
    >
      <nav className="container mx-auto px-4 py-4 flex items-center relative">
        {/* LEFT-CLAMPED LOGO */}
        <a
          href="#"
          style={{
            position: "fixed",
            left: "16px",
            top: "6px",
            zIndex: 10001,
          }}
        >
          <img
            src="/club-logos/emblem.png"
            alt="DataHacks 2026"
            style={{ width: "90px" }}
          />
        </a>

        {/* CENTERED DESKTOP NAV */}
        <div className="flex-1 flex justify-center">
          <div className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className={`font-medium transition-colors hover:text-accent ${getTextColor()}`}
              >
                {link.name}
              </a>
            ))}
            <Button
              asChild
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold"
            >
              <a href="https://docs.google.com/forms/d/e/1FAIpQLScWZ1-QNCF55GJrnIhXD2ZLJqriXSOJ8V8gDQFkzbQqKNRmlQ/viewform?usp=sharing&ouid=113914661221302710293" target="_blank">Register</a>
            </Button>
          </div>
        </div>

        {/* MLH BADGE (RIGHT-CLAMPED) */}
        <a
          id="mlh-trust-badge"
          style={{
            position: "fixed",
            right: "5px",
            top: 0,
            width: "90px",
            zIndex: 10000,
          }}
          href="https://mlh.io/na?utm_source=na-hackathon&utm_medium=TrustBadge&utm_campaign=2026-season&utm_content=white"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="https://s3.amazonaws.com/logged-assets/trust-badge/2026/mlh-trust-badge-2026-white.svg"
            alt="Major League Hacking 2026 Hackathon Season"
            style={{ width: "100%" }}
          />
        </a>

        {/* MOBILE NAV */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon" className={getTextColor()}>
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>

          {/* CRITICAL FIX: OVERLAY ABOVE MLH */}
          <SheetOverlay className="z-[10040]" />

          {/* SHEET CONTENT ABOVE OVERLAY */}
          <SheetContent
            side="right"
            className="bg-deep-water/95 border-deep-water z-[10050]"
          >
            <div className="flex flex-col gap-6 mt-8">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="text-white text-lg font-medium hover:text-accent transition-colors"
                >
                  {link.name}
                </a>
              ))}
              <Button
                asChild
                className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold mt-4"
              >
                <a href="#register" onClick={() => setIsOpen(false)}>
                  Register Now
                </a>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </motion.header>
  );
};

export default Navigation;
