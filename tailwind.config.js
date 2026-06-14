/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable manual dark mode switching via a class
  theme: {
    extend: {
      colors: {
        johorNavy: '#002B5B',
        johorDarkBlue: '#001F3F',
        johorGold: '#F5C542',
        govBg: '#F5F7FA',
        govText: '#1F2937',
      },
      fontFamily: {
        sans: ['var(--font-ui)'],
        display: ['var(--font-display)'],
        data: ['var(--font-data)'],
      }
    },
  },
  plugins: [],
}
