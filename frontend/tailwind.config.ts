import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        surface: {
          DEFAULT: '#18181b',
          raised: '#1f1f23',
          overlay: '#27272a',
        },
      },
      boxShadow: {
        card: '0 0 0 1px rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.4)',
        'card-hover': '0 0 0 1px rgba(255,255,255,0.08), 0 4px 12px rgba(0,0,0,0.5)',
        glow: '0 0 20px rgba(59,130,246,0.15)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
