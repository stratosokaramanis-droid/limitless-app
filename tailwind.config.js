/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Clash Grotesk', 'sans-serif'],
      },
      colors: {
        bg: '#000000',
        card: '#1C1C1E',
        accent: '#FFFFFF',
        surface: '#1C1C1E',
        pillarsleep: '#5E9EFF',
        pillarnutrition: '#30D158',
        pillardopamine: '#BF5AF2',
        pillarmood: '#FF9F0A',
        positive: '#30D158',
        negative: '#FF453A',
      },
      boxShadow: {
        glow: '0 0 80px rgba(255, 255, 255, 0.03)',
      }
    }
  },
  plugins: []
}
