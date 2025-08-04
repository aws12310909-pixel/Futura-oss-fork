import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    ssr: true,
    components,
    directives,
    icons: {
      defaultSet: 'mdi'
    },
    theme: {
      defaultTheme: 'light',
      themes: {
        light: {
          colors: {
            primary: '#f97316', // Orange-500
            secondary: '#64748b', // Slate-500
            accent: '#06b6d4', // Cyan-500
            error: '#ef4444', // Red-500
            warning: '#f59e0b', // Amber-500
            info: '#3b82f6', // Blue-500
            success: '#10b981', // Emerald-500
            surface: '#ffffff',
            background: '#f8fafc', // Slate-50
          },
        },
        dark: {
          colors: {
            primary: '#fb923c', // Orange-400
            secondary: '#94a3b8', // Slate-400
            accent: '#22d3ee', // Cyan-400
            error: '#f87171', // Red-400
            warning: '#fbbf24', // Amber-400
            info: '#60a5fa', // Blue-400
            success: '#34d399', // Emerald-400
            surface: '#1e293b', // Slate-800
            background: '#0f172a', // Slate-900
          },
        },
      },
    },
    defaults: {
      VBtn: {
        style: 'text-transform: none;',
      },
      VCard: {
        elevation: 2,
      },
    },
  })

  nuxtApp.vueApp.use(vuetify)
})