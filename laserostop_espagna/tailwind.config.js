/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#22A9AF",
        "background-light": "#FFFFFF",
        "background-dark": "#121212",
        "text-light": "#374151",
        "text-dark": "#E5E7EB",
        "border-light": "#E5E7EB",
        "border-dark": "#374151",
      },
      fontFamily: {
        display: ["Poppins", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography')
  ],
}
