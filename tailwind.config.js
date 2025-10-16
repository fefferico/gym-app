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

        // Red Shades
        'routine-red-800': '#7f1d1d', // Darker Red
        'routine-red-700': '#b91c1c', // Medium Red

        // Purple Shades
        'routine-purple-800': '#86198f', // Darker Purple
        'routine-purple-900': '#4a044e', // Very Dark Purple (almost black)
        'routine-purple-700': '#c026d3', // Medium Purple
        'routine-purple-850': '#701a75', // Slightly lighter dark purple

        // Indigo/Blue Shades
        'routine-indigo-900': '#1e1b4b', // Very Dark Indigo
        'routine-indigo-800': '#312e81', // Dark Indigo
        'routine-blue-800': '#1e3a8a',  // Dark Blue
        'routine-blue-700': '#2563eb',  // Medium Blue
        'routine-blue-900': '#1d4ed8',  // Slightly darker than medium blue
        'routine-violet-700': '#5b21b6', // Violet/Darker Blue

        // Green Shades
        'routine-green-900': '#064e3b', // Very Dark Green
        'routine-green-800': '#14532d', // Dark Green
        'routine-green-700': '#047857', // Medium Green
        'routine-green-600': '#15803d', // Lighter Green
        'routine-lime-700': '#4d7c0f',  // Lime/Olive Green

        // Orange/Yellow Shades
        'routine-orange-500': '#f97316', // Bright Orange
        'routine-yellow-600': '#ca8a04', // Golden Yellow

        // Teal/Cyan Shades
        'routine-teal-700': '#0f766e',  // Dark Teal
        'routine-teal-600': '#0369a1',  // Blue-ish Teal
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
    require('tailwind-scrollbar'),
  ],
};