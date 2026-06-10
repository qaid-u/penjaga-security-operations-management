/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable manual dark mode switching via a class
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-ui)'],
        display: ['var(--font-display)'],
        data: ['var(--font-data)'],
      }
    },
  },
  plugins: [],
}
