/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './index.ts', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          pink: '#EC4899',
          purple: '#8B5CF6',
          cyan: '#22D3EE',
          orange: '#F97316',
          gold: '#FBBF24',
        },
        surface: {
          bg: '#050510',
          card: '#12121C',
          elevated: '#1A1A28',
          border: 'rgba(255,255,255,0.08)',
        },
      },
    },
  },
  plugins: [],
};
