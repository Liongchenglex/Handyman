/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'primary': '#38e07b',
        'background-light': '#f6f8f7',
        'background-dark': '#122017',
        'foreground-light': '#111714',
        'foreground-dark': '#f6f8f7',
        'muted-light': '#648772',
        'muted-dark': '#a0b5a9',
        'border-light': '#e0e6e2',
        'border-dark': '#2a3c31'
      },
      fontFamily: {
        'display': ['Space Grotesk', 'sans-serif']
      },
      borderRadius: {
        'DEFAULT': '0.25rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        'full': '9999px'
      }
    }
  },
  plugins: []
}