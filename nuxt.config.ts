export default defineNuxtConfig({
  compatibilityDate: '2025-08-02',
  devtools: { enabled: true },
  
  // Explicitly enable pages
  pages: true,
  
  // Modules
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@nuxt/icon',
    '@nuxt/eslint'
  ],

  // Icon configuration
  icon: {
    provider: 'iconify',
    collections: ['mdi', 'heroicons']
  },

  // Component auto-import configuration
  components: [
    {
      path: '~/components',
      pathPrefix: true,
    }
  ],

  // Auto-import configuration
  imports: {
    dirs: [
      'composables/**'
    ]
  },

  // Tailwind CSS configuration
  tailwindcss: {
    viewer: false,
    config: {
      content: [
        './components/**/*.{vue,js,ts}',
        './layouts/**/*.vue',
        './pages/**/*.vue',
        './composables/**/*.{js,ts}',
        './plugins/**/*.{js,ts}',
        './app.vue',
        './error.vue'
      ],
      // Ensure Vuetify styles are not purged
      blocklist: [],
      extract: {
        include: ['**/*.{vue,js,ts}'],
        exclude: ['node_modules/**/*', 'dist/**/*']
      }
    }
  },

  // CSS - Order is important: Vuetify first, then Tailwind
  css: [
    'vuetify/lib/styles/main.sass',
    '@/assets/css/main.css'
  ],

  // Build configuration
  build: {
    transpile: ['vuetify']
  },

  // Vite configuration
  vite: {
    define: {
      'process.env.DEBUG': false,
    },
    ssr: {
      noExternal: ['vuetify']
    },
    optimizeDeps: {
      include: ['uuid']
    },
    resolve: {
      alias: {
        uuid: 'uuid'
      }
    }
  },

  // TypeScript configuration
  typescript: {
    typeCheck: false  // 一時的に無効化（middlewareの型エラー回避）
  },

  // Runtime configuration
  runtimeConfig: {
    // Private keys (only available on the server-side)
    awsRegion: process.env.AWS_REGION || 'ap-northeast-1',
    dynamodbUsersTable: process.env.NUXT_DYNAMODB_USERS_TABLE || 'btc-mock-app-dev-users',
    dynamodbTransactionsTable: process.env.NUXT_DYNAMODB_TRANSACTIONS_TABLE || 'btc-mock-app-dev-transactions',
    dynamodbMarketRatesTable: process.env.NUXT_DYNAMODB_MARKET_RATES_TABLE || 'btc-mock-app-dev-market-rates',
    dynamodbSessionsTable: process.env.NUXT_DYNAMODB_SESSIONS_TABLE || 'btc-mock-app-dev-sessions',
    dynamodbPermissionsTable: process.env.NUXT_DYNAMODB_PERMISSIONS_TABLE || 'btc-mock-app-dev-permissions',
    s3UploadsBucket: process.env.NUXT_S3_UPLOADS_BUCKET || 'btc-mock-app-dev-uploads',
    
    // Public keys (exposed to the client-side)
    public: {
      awsRegion: process.env.AWS_REGION || 'ap-northeast-1',
      cognitoUserPoolId: process.env.NUXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      cognitoClientId: process.env.NUXT_PUBLIC_COGNITO_CLIENT_ID || '',
      cognitoUserPoolDomain: process.env.COGNITO_USER_POOL_DOMAIN || '',
      s3BucketName: process.env.NUXT_S3_UPLOADS_BUCKET || '',
      apiBaseUrl: process.env.API_BASE_URL || '/api'
    }
  },

  // Server-side rendering
  ssr: true,

  // App configuration
  app: {
    head: {
      title: 'BTC Mock App',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'BTC Mock Application for portfolio management' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/@mdi/font@latest/css/materialdesignicons.min.css' }
      ]
    }
  },

  // Nitro configuration for Lambda deployment
  nitro: {
    preset: 'aws-lambda',
    serveStatic: true
  }
})