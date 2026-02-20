/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0A',
        card: '#141414',
        accent: '#E8E8E8'
      },
      boxShadow: {
        glow: '0 0 40px rgba(232, 232, 232, 0.08)'
      }
    }
  },
  plugins: []
}
