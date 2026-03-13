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
        // App Theme
        base: 'var(--bg-base)',
        surface: 'var(--surface-color)',
        'surface-hover': 'var(--surface-hover)',
        accent: 'var(--accent-color)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        
        // Platform Colors
        spotify: '#1DB954',
        soundcloud: '#FF5500',
        youtube: '#FF0000',
      },
    },
  },
  plugins: [],
}