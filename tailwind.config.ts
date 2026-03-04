import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', './yuios-prototype.tsx'],
  theme: {
    extend: {}
  },
  plugins: []
} satisfies Config;
