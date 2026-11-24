/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1C1612',
        sand: '#F3EEE6',
        card: '#FFFCF8',
        line: '#E4D9CC',
        clay: '#C4522A',
        pine: '#1F4F45',
        gold: '#A6854E',
        mute: '#6F655C',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Outfit', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
