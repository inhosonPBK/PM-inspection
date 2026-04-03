import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg: "#0d1025",
          hover: "rgba(255,255,255,0.05)",
          active: "rgba(99,102,241,0.15)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
