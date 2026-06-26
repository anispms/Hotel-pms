import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#bcd2ff",
          300: "#8eb4ff",
          400: "#598bff",
          500: "#3563ff",
          600: "#1f43f5",
          700: "#1832e1",
          800: "#1a2bb6",
          900: "#1c2b8f",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
