import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        heading: ["var(--font-eb-garamond)", "Georgia", "serif"],
        body: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-vt323)", "Courier New", "monospace"],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'typewriter': 'blink 1s step-end infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        blink: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } },
      },
      colors: {
        page: "var(--bg-page)",
        card: {
          DEFAULT: "var(--bg-card)",
          hover: "var(--bg-card-hover)",
        },
        inverted: "var(--bg-inverted)",
        accent: {
          blue: "var(--accent-blue)",
          orange: "var(--accent-orange)",
        },
        txt: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          inverted: "var(--text-inverted)",
        },
        border: "var(--border-color)",
        crt: {
          green: "#33FF00",
          screen: "#222529",
        },
        score: {
          high: "#22C55E",
          mid: "#F59E0B",
          low: "#64748B",
        },
        category: {
          reasoning: "#2B6CB0",
          coding: "#22C55E",
          math: "#F59E0B",
          chat: "#8B5CF6",
          agentic: "#F43F5E",
        },
      },
    },
  },
  plugins: [],
}
export default config
