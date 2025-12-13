/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          // カスタムカラー例
          primary: "#2563eb",
          secondary: "#9333ea",
        },
        fontFamily: {
          // カスタムフォント例
          sans: ['Inter', 'sans-serif'],
        },
        animation: {
          // カスタムアニメーション例
          'gradient-xy': 'gradient-xy 8s ease infinite',
        },
        keyframes: {
          'gradient-xy': {
            '0%, 100%': {
              'background-size': '400% 400%',
              'background-position': '0% 0%',
            },
            '25%': {
              'background-size': '400% 400%',
              'background-position': '100% 0%',
            },
            '50%': {
              'background-size': '400% 400%',
              'background-position': '100% 100%',
            },
            '75%': {
              'background-size': '400% 400%',
              'background-position': '0% 100%',
            },
          },
        },
      },
    },
    plugins: [
      // require('@tailwindcss/forms'),
      // require('@tailwindcss/typography'),
    ],
  }