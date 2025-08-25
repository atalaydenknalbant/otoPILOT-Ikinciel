import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef5ff',
          100: '#dbe9ff',
          200: '#bcd5ff',
          300: '#91b8ff',
          400: '#6292ff',
          500: '#3f6bff',
          600: '#2d4bff',
          700: '#253bdb',
          800: '#2233b0',
          900: '#202f8d',
        },
      },
      boxShadow: {
        soft: '0 8px 24px rgba(0,0,0,0.06)',
      },
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          lg: '2rem',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
