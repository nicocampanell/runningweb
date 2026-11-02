/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f2f5f8",
        ink: "#212121",
        black: "#1F1A17",
        secondary: "#5C544E",
      },
      fontFamily: {
        sans: [
          "Suisse Neue Trial",
          "Inter",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        sf: ["-apple-system", "BlinkMacSystemFont", "SF Pro Text", "SF Pro", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
