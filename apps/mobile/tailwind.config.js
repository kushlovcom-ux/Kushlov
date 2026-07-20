/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './index.ts', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          pink: '#ec4899',
          purple: '#8b5cf6',
          orange: '#f97316',
        },
        surface: {
          bg: '#0a0a0b',
          card: '#141416',
          elevated: '#1c1c1f',
          border: '#27272a',
        },
      },
    },
  },
  plugins: [],
};
