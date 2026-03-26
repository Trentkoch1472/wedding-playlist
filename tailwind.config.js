/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        coral: { DEFAULT: '#E8502A', light: '#FFE8E0', dark: '#C43E1F' },
        gold: { DEFAULT: '#D4A017', light: '#FFF3CC', dark: '#A67C00' },
        swipe: { bg: '#FFFFFF', card: '#FFE8E0', dark: '#0D0D0D', text: '#1A1A1A' },
      },
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
