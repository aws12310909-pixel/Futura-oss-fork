/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        }
      },
      fontFamily: {
        sans: ['Noto Sans JP', 'Kanit', 'sans-serif'],
      }
    },
  },
  plugins: [],
  // Tailwind safelist for dynamic classes used in components
  safelist: [
    // Common dynamic utility classes that might be purged
    'opacity-0', 'opacity-100',
    'translate-x-0', 'translate-x-full', '-translate-x-full',
    'translate-y-0', 'translate-y-full', '-translate-y-full',
    'scale-0', 'scale-100', 'scale-105',
    'rotate-0', 'rotate-45', 'rotate-90', 'rotate-180',
    // Status and state classes
    'bg-green-100', 'bg-red-100', 'bg-blue-100', 'bg-yellow-100',
    'text-green-800', 'text-red-800', 'text-blue-800', 'text-yellow-800',
    'border-green-200', 'border-red-200', 'border-blue-200', 'border-yellow-200'
  ]
}