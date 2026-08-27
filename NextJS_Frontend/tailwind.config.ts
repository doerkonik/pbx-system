import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Canvas + surfaces
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        "surface-muted": "var(--surface-muted)",
        "surface-sunken": "var(--surface-sunken)",

        // Text
        ink: {
          DEFAULT: "var(--ink)",
          muted: "var(--ink-muted)",
          subtle: "var(--ink-subtle)",
          inverse: "var(--ink-inverse)",
        },

        // Borders: `line` = gray-200 structure, `line-soft` = gray-100 cards
        line: "var(--line)",
        "line-soft": "var(--line-soft)",

        // The single accent = blue
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          soft: "var(--accent-soft)",
          ink: "var(--accent-ink)",
        },

        // Sidebar rail (white in light, slate in dark)
        rail: {
          DEFAULT: "var(--rail)",
          hover: "var(--rail-hover)",
          ink: "var(--rail-ink)",
          "ink-muted": "var(--rail-ink-muted)",
        },

        // Primary — solid blue action buttons
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          ink: "var(--primary-ink)",
        },

        // Gradient stops for the balance/summary chip
        grad: {
          from: "var(--grad-from)",
          to: "var(--grad-to)",
        },

        // Pastel tones for circular icon badges
        tone: {
          blue: "var(--tone-blue)",
          "blue-bg": "var(--tone-blue-bg)",
          indigo: "var(--tone-indigo)",
          "indigo-bg": "var(--tone-indigo-bg)",
          purple: "var(--tone-purple)",
          "purple-bg": "var(--tone-purple-bg)",
          amber: "var(--tone-amber)",
          "amber-bg": "var(--tone-amber-bg)",
          rose: "var(--tone-rose)",
          "rose-bg": "var(--tone-rose-bg)",
          green: "var(--tone-green)",
          "green-bg": "var(--tone-green-bg)",
          slate: "var(--tone-slate)",
          "slate-bg": "var(--tone-slate-bg)",
        },

        // Dark contrast card (live/urgent panels)
        darkcard: {
          DEFAULT: "var(--darkcard)",
          ink: "var(--darkcard-ink)",
          muted: "var(--darkcard-muted)",
        },

        // Status colors (only for live data)
        success: "var(--success)",
        "success-soft": "var(--success-soft)",
        warn: "var(--warn)",
        "warn-soft": "var(--warn-soft)",
        danger: "var(--danger)",
        "danger-soft": "var(--danger-soft)",
        info: "var(--info)",
        "info-soft": "var(--info-soft)",
      },
      borderRadius: {
        // Cards & major containers = rounded-xl (12px); buttons/inputs = lg (8px).
        card: "12px",
        "card-lg": "16px",
        pill: "9999px",
      },
      boxShadow: {
        // Subtle neutral elevation everywhere — never heavy drop shadows.
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        "card-hover": "0 2px 6px 0 rgb(15 23 42 / 0.07)",
        pop: "0 10px 32px rgb(15 23 42 / 0.12)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "toast-in": {
          from: { opacity: "0", transform: "translateX(16px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        spin: {
          to: { transform: "rotate(360deg)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "scale-in": "scale-in 150ms ease-out",
        "slide-up": "slide-up 200ms ease-out",
        "toast-in": "toast-in 200ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
