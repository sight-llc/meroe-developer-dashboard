import type { Config } from 'tailwindcss'

// Meroe design tokens
// Sidebar ink:   #0F1A14 (deep ledger-green-black, not pure slate)
// Canvas:        #FAF9F6 (warm paper, ledger-stock feel)
// Brand primary: #0B6E4F (vault emerald)
// Brand accent:  #B9852E (aged-gold, used sparingly for "live"/key-reveal moments)
// Status:        matched emerald / unmatched amber / misdirected red (kept semantic+legible)

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        display: ['"IBM Plex Sans"', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        ink: {
          DEFAULT: '#0F1A14',
          800: '#16241C',
          700: '#1D3026',
          600: '#2A4536',
        },
        paper: {
          DEFAULT: '#FAF9F6',
          100: '#F4F2EC',
          200: '#EDEAE1',
        },
        vault: {
          50: '#E9F5EF',
          100: '#CCE8DA',
          300: '#6FB596',
          500: '#0B6E4F',
          600: '#0A5F44',
          700: '#084B36',
        },
        gold: {
          400: '#D6A94F',
          500: '#B9852E',
          600: '#9C6E22',
        },
        matched: '#0B6E4F',
        unmatched: '#B9852E',
        misdirected: '#B3261E',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        lg: '8px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(15, 26, 20, 0.06), 0 1px 1px 0 rgba(15, 26, 20, 0.04)',
      },
    },
  },
  plugins: [],
}
export default config
