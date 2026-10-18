/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ibm: {
          blue: '#0f62fe',
          light: '#4589ff',
          cyan: '#1192e8',
          teal: '#009d9a',
          purple: '#8a3ffc',
          navy: '#002d9c',
          hover: '#0353e9'
        },
        slate: {
          950: '#0b0f19',
          900: '#0f172a', // Deep slate requested
          850: '#141d2e',
          800: '#1e293b', // Card slate requested
          750: '#27354a',
          700: '#334155', // Border slate requested
          600: '#475569',
        },
        risk: {
          allow: '#10b981',
          'allow-bg': 'rgba(16, 185, 129, 0.15)',
          review: '#f59e0b',
          'review-bg': 'rgba(245, 158, 11, 0.15)',
          block: '#ef4444',
          'block-bg': 'rgba(239, 68, 68, 0.18)',
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['"Inter"', '"IBM Plex Sans"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      }
    },
  },
  plugins: [],
}
