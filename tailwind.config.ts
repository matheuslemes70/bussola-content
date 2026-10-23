import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Identidade visual Bússola Media
        bussola: {
          yellow: "#F9B800",
          blue: "#0A48C4",
          black: "#000000",
        },
        // Linguagem visual 2026: fundo quente, superfícies de areia, tinta quase preta
        ink: {
          DEFAULT: "#121110",
          soft: "#1C1B19",
          muted: "#24221F",
        },
        paper: "#F2EFE8",
        sand: {
          DEFAULT: "#E8E3D8",
          light: "#F7F5F0",
          line: "#DDD7CA",
        },
        stone: {
          450: "#8A8478",
          550: "#5F5A50",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        "4xl": "1.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
