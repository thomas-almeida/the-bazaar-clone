/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fire: '#ff5a3c',
        water: '#3ca5ff',
        grass: '#6fcf5a',
        panel: '#141926',
        ink: '#0d1017',
      },
      fontFamily: {
        mono: ['Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
