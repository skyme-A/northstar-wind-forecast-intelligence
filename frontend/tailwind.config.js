/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ocean: '#247BFD',
        peach: '#FFB38A',
        aqua: '#8DE4D2',
        ink: '#20304A',
      },
      boxShadow: {
        glass: '0 18px 55px rgba(43, 74, 125, 0.10)',
      },
      animation: {
        float: 'float 5s ease-in-out infinite',
        'fade-up': 'fadeUp .6s ease-out both',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}