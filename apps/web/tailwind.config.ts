import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        surfaceSoft: "var(--surface-soft)",
        textPrimary: "var(--text-primary)",
        textSecondary: "var(--text-secondary)",
        accent: "var(--accent)",
      },
      boxShadow: {
        glow: "0 0 24px rgba(29, 185, 84, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
