import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        oxblood: "#7f1724",
        "oxblood-dark": "#4a0d16",
        blush: "#fff7f7",
        paper: "#fffdfd",
      },
    },
  },
  plugins: [],
};
export default config;
