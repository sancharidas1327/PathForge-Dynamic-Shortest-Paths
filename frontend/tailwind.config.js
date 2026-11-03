/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        navy: {
          950: '#07090e',
          900: '#0c1018',
          850: '#111622',
          800: '#161d2e',
          700: '#1f2940',
        },
      },
    },
  },
  plugins: [],
};
