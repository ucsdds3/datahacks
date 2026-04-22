import { useEffect, useState } from "react";

/**
 * Layered parallax castle silhouette scene.
 * Subtle hint at the defense theme without being literal.
 */
export function ParallaxCastle() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrollY(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Sky gradient wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.97 0.015 85) 0%, oklch(0.93 0.02 90) 55%, oklch(0.88 0.025 100) 100%)",
        }}
      />

      {/* Faint sun / moon */}
      <div
        className="absolute left-1/2 top-[18%] h-48 w-48 -translate-x-1/2 rounded-full opacity-30 blur-2xl"
        style={{
          background: "radial-gradient(circle, oklch(0.95 0.05 90) 0%, transparent 70%)",
          transform: `translate(-50%, ${scrollY * 0.05}px)`,
        }}
      />

      {/* Distant mountains — slowest parallax */}
      <svg
        className="absolute bottom-0 left-0 w-full"
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
        style={{
          transform: `translateY(${scrollY * 0.1}px)`,
          height: "60%",
          opacity: 0.45,
        }}
      >
        <path
          d="M0,400 L0,260 L120,180 L240,230 L360,150 L500,210 L640,140 L780,200 L920,160 L1080,220 L1220,170 L1360,210 L1440,180 L1440,400 Z"
          fill="oklch(0.72 0.015 100)"
        />
      </svg>

      {/* Mid hills */}
      <svg
        className="absolute bottom-0 left-0 w-full"
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
        style={{
          transform: `translateY(${scrollY * 0.18}px)`,
          height: "50%",
          opacity: 0.55,
        }}
      >
        <path
          d="M0,400 L0,300 L160,250 L320,290 L480,230 L640,280 L800,240 L960,290 L1120,250 L1280,300 L1440,260 L1440,400 Z"
          fill="oklch(0.6 0.018 110)"
        />
      </svg>

      {/* Castle silhouette on a hill — main feature */}
      <svg
        className="absolute bottom-0 left-1/2 -translate-x-1/2"
        viewBox="0 0 800 400"
        preserveAspectRatio="xMidYEnd meet"
        style={{
          transform: `translate(-50%, ${scrollY * 0.28}px)`,
          width: "min(1100px, 100%)",
          height: "70%",
          opacity: 0.75,
        }}
      >
        {/* Hill */}
        <path
          d="M0,400 L0,360 Q200,300 400,290 Q600,300 800,360 L800,400 Z"
          fill="oklch(0.45 0.025 120)"
        />
        {/* Castle base */}
        <g fill="oklch(0.32 0.02 100)">
          {/* Outer left tower */}
          <rect x="240" y="220" width="40" height="80" />
          <polygon points="235,220 285,220 280,210 240,210" />
          <polygon points="240,210 244,200 248,210 252,200 256,210 260,200 264,210 268,200 272,210 276,200 280,210" />

          {/* Left wall */}
          <rect x="280" y="245" width="70" height="55" />
          <polygon points="280,245 285,238 290,245 295,238 300,245 305,238 310,245 315,238 320,245 325,238 330,245 335,238 340,245 345,238 350,245" />

          {/* Main keep */}
          <rect x="350" y="195" width="100" height="105" />
          <polygon points="345,195 455,195 450,185 350,185" />
          <polygon points="350,185 354,175 358,185 362,175 366,185 370,175 374,185 378,175 382,185 386,175 390,185 394,175 398,185 402,175 406,185 410,175 414,185 418,175 422,185 426,175 430,185 434,175 438,185 442,175 446,185 450,185" />
          {/* Central tall tower */}
          <rect x="385" y="140" width="30" height="60" />
          <polygon points="382,140 418,140 400,115" />
          {/* Flag */}
          <rect x="399" y="95" width="2" height="22" />
          <polygon points="401,98 415,103 401,108" fill="oklch(0.42 0.08 145)" />

          {/* Right wall */}
          <rect x="450" y="245" width="70" height="55" />
          <polygon points="450,245 455,238 460,245 465,238 470,245 475,238 480,245 485,238 490,245 495,238 500,245 505,238 510,245 515,238 520,245" />

          {/* Outer right tower */}
          <rect x="520" y="220" width="40" height="80" />
          <polygon points="515,220 565,220 560,210 520,210" />
          <polygon points="520,210 524,200 528,210 532,200 536,210 540,200 544,210 548,200 552,210 556,200 560,210" />
        </g>
        {/* Tiny window glints */}
        <g fill="oklch(0.85 0.06 85 / 0.5)">
          <rect x="395" y="225" width="4" height="8" />
          <rect x="405" y="225" width="4" height="8" />
          <rect x="395" y="250" width="4" height="8" />
          <rect x="405" y="250" width="4" height="8" />
          <rect x="255" y="245" width="3" height="6" />
          <rect x="263" y="245" width="3" height="6" />
          <rect x="535" y="245" width="3" height="6" />
          <rect x="543" y="245" width="3" height="6" />
        </g>
      </svg>

      {/* Foreground grass / mist — fastest parallax */}
      <svg
        className="absolute bottom-0 left-0 w-full"
        viewBox="0 0 1440 200"
        preserveAspectRatio="none"
        style={{
          transform: `translateY(${scrollY * 0.4}px)`,
          height: "25%",
          opacity: 0.85,
        }}
      >
        <path
          d="M0,200 L0,120 Q180,80 360,100 Q540,120 720,90 Q900,60 1080,100 Q1260,140 1440,110 L1440,200 Z"
          fill="oklch(0.32 0.03 130)"
        />
      </svg>

      {/* Top fade for nav legibility */}
      <div
        className="absolute inset-x-0 top-0 h-32"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.97 0.015 85 / 0.85) 0%, transparent 100%)",
        }}
      />

      {/* Bottom fade into page */}
      <div
        className="absolute inset-x-0 bottom-0 h-40"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, oklch(0.965 0.012 85) 100%)",
        }}
      />
    </div>
  );
}
