import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Ocean theme colors
        sky: "hsl(var(--sky))",
        sun: "hsl(var(--sun))",
        sand: "hsl(var(--sand))",
        "shallow-water": "hsl(var(--shallow-water))",
        "mid-water": "hsl(var(--mid-water))",
        "deep-water": "hsl(var(--deep-water))",
        abyss: "hsl(var(--abyss))",
        bioluminescent: "hsl(var(--bioluminescent))",
        coral: "hsl(var(--coral))",
        seaweed: "hsl(var(--seaweed))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        display: ["'Fredoka'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        wave: {
          "0%, 100%": { transform: "translateX(0) translateY(0)" },
          "25%": { transform: "translateX(-5px) translateY(-3px)" },
          "50%": { transform: "translateX(0) translateY(-5px)" },
          "75%": { transform: "translateX(5px) translateY(-3px)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-30px) rotate(5deg)" },
        },
        bubble: {
          "0%": { transform: "translateY(100vh) scale(0)", opacity: "0" },
          "10%": { opacity: "0.6" },
          "100%": { transform: "translateY(-100vh) scale(1)", opacity: "0" },
        },
        "swim-right": {
          "0%": { transform: "translateX(-100px) scaleX(1)" },
          "100%": { transform: "translateX(calc(100vw + 100px)) scaleX(1)" },
        },
        "swim-left": {
          "0%": { transform: "translateX(calc(100vw + 100px)) scaleX(-1)" },
          "100%": { transform: "translateX(-100px) scaleX(-1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        glow: {
          "0%, 100%": { opacity: "0.5", filter: "blur(10px)" },
          "50%": { opacity: "1", filter: "blur(15px)" },
        },
        "sun-rays": {
          "0%, 100%": { opacity: "0.3", transform: "rotate(0deg) scale(1)" },
          "50%": { opacity: "0.5", transform: "rotate(180deg) scale(1.1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        wave: "wave 3s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
        "float-slow": "float-slow 6s ease-in-out infinite",
        bubble: "bubble 8s ease-in infinite",
        "swim-right": "swim-right 20s linear infinite",
        "swim-left": "swim-left 25s linear infinite",
        shimmer: "shimmer 3s linear infinite",
        glow: "glow 2s ease-in-out infinite",
        "sun-rays": "sun-rays 10s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
