/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        warm: 'var(--bg-warm)',
        card: 'var(--bg-card)',
        raised: 'var(--bg-raised)',
        input: 'var(--bg-input)',
        amber: 'var(--amber)',
        'amber-lt': 'var(--amber-lt)',
        'amber-dim': 'var(--amber-dim)',
        rust: 'var(--rust)',
        'rust-lt': 'var(--rust-lt)',
        cream: 'var(--cream)',
        'cream-dim': 'var(--cream-dim)',
        muted: 'var(--muted)',
        sub: 'var(--text-sub)',
        text: 'var(--text)',
        spotify: 'var(--spotify)',
        youtube: 'var(--youtube)',
        soundcloud: 'var(--soundcloud)',
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],
        condensed: ['"Barlow Condensed"', 'sans-serif'],
        sans: ['Barlow', 'sans-serif'],
      },
      borderColor: {
        DEFAULT: 'var(--border)',
        warm: 'var(--border-warm)',
        hard: 'var(--border-hard)',
      },
      animation: {
        'spin-slow':         'spin 3s linear infinite',
        'spin-slow-reverse': 'spin 3s linear infinite reverse',
        'blink':             'blink 1.5s ease-in-out infinite',
        'vu':                'vu 0.3s ease-in-out infinite alternate',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.1' },
        },
        vu: {
          from: { transform: 'scaleY(0.35)', opacity: '0.45' },
          to:   { transform: 'scaleY(1)',    opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}