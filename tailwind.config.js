/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // OSEA ocean palette — deep navy through reef teal
        ocean: {
          50: '#eefbfd',
          100: '#d4f3f9',
          200: '#aee7f3',
          300: '#76d3e9',
          400: '#37b6d7',
          500: '#1b99bd',
          600: '#197b9f',
          700: '#1b6481',
          800: '#1f526a',
          900: '#1e455a',
          950: '#0e2c3d'
        },
        reef: {
          50: '#effefa',
          100: '#c8fff1',
          200: '#91fee5',
          300: '#53f5d5',
          400: '#20e1c0',
          500: '#07c5a7',
          600: '#029e89',
          700: '#077e6f',
          800: '#0b645a',
          900: '#0e534b',
          950: '#01322e'
        },
        abyss: {
          50: '#f4f7fa',
          100: '#e6ecf3',
          200: '#d3dee9',
          300: '#b5c8da',
          400: '#91acc8',
          500: '#7694ba',
          600: '#647fab',
          700: '#586f9c',
          800: '#4c5c80',
          900: '#404e67',
          950: '#0b1320'
        },
        surface: {
          light: '#f6f9fb',
          dark: '#0c1622',
          card: '#101d2d',
          raised: '#15263a'
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
      },
      boxShadow: {
        card: '0 1px 2px rgba(9, 30, 50, 0.06), 0 4px 16px rgba(9, 30, 50, 0.06)',
        'card-dark': '0 1px 2px rgba(0, 0, 0, 0.4), 0 6px 24px rgba(0, 0, 0, 0.35)',
        pop: '0 8px 30px rgba(9, 30, 50, 0.18)'
      },
      animation: {
        'fade-in': 'fadeIn 0.18s ease-out',
        'slide-up': 'slideUp 0.22s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    }
  },
  plugins: []
}
