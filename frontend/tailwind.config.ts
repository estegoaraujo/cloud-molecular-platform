import type { Config } from "tailwindcss";

/**
 * ThermRad design tokens.
 *
 * The palette is grounded in the subject: a scientific-instrument console for
 * watching molecules destabilize under thermal/radiation load. Accent colors
 * follow a "thermal ramp" (cold blue -> warm amber -> hot magenta), echoing the
 * perceptual colormaps (plasma/inferno) computational scientists already read.
 *
 * Colors are defined as CSS variables in globals.css so they can theme both
 * Tailwind utilities and hand-written component classes without duplication.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "var(--void)",
        panel: "var(--panel)",
        "panel-2": "var(--panel-2)",
        line: "var(--line)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        cold: "var(--cold)", // stable / low energy
        warm: "var(--warm)", // heating
        hot: "var(--hot)", //  destabilizing / bonds breaking
      },
      fontFamily: {
        // Mapped to next/font CSS variables declared in layout.tsx.
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 24px 60px -30px rgba(0,0,0,0.9)",
      },
    },
  },
  plugins: [],
};

export default config;
