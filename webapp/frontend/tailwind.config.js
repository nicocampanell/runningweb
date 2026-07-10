/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f2f5f8",
        ink: "#212121",
        black: "#1F1A17",
        swim: "#E96D6D",
        lift: "#9FD2D5",
        run: "#E9C46A",
        cycle: "#6D9EE9",
        walk: "#8AC48A",
        random: "#CCAEE0",
        rest: "#C9CED3",
        secondary: "#5C544E",
        tertiary: "#7A716A",
      },
      fontFamily: {
        sans: [
          "Suisse Neue Trial",
          "Inter",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
