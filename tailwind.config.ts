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
      },
    },
  },
  plugins: [],
};

export default config;
