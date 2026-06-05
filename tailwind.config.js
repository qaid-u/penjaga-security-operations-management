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
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Deep slate for dark mode backgrounds
        slate: {
          850: '#1e2128',
          900: '#15171c',
          950: '#0b0c0f',
        }
      }
    },
  },
  plugins: [],
}
