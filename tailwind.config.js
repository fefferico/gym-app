/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}", // Standard content glob
  ],
  darkMode: 'class', // Or 'media'
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#e86c3f',
          DEFAULT: '#e0460d',
          dark: '#b33609',
        },
        secondary: {
          light: '#67e8f9',
          DEFAULT: '#06b6d4',
          dark: '#0e7490',
        },
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-in-out',
      },
    },
  },
  plugins: [
    require('@tailwindcss/line-clamp'),
  ],
};