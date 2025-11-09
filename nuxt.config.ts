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
      noExternal: ['vuetify'],
      external: ['node:crypto']
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
    dynamodbUsersTable: process.env.NUXT_DYNAMODB_USERS_TABLE || 'futura-dev-users',
    dynamodbTransactionsTable: process.env.NUXT_DYNAMODB_TRANSACTIONS_TABLE || 'futura-dev-transactions',
    dynamodbMarketRatesTable: process.env.NUXT_DYNAMODB_MARKET_RATES_TABLE || 'futura-dev-market-rates',
    dynamodbSessionsTable: process.env.NUXT_DYNAMODB_SESSIONS_TABLE || 'futura-dev-sessions',
    dynamodbPermissionsTable: process.env.NUXT_DYNAMODB_PERMISSIONS_TABLE || 'futura-dev-permissions',
    dynamodbBatchOperationsTable: process.env.NUXT_DYNAMODB_BATCH_OPERATIONS_TABLE || 'futura-dev-batch-operations',
    s3UploadsBucket: process.env.NUXT_S3_UPLOADS_BUCKET || 'futura-dev-uploads',
    imageBaseUrl: process.env.NUXT_IMAGE_BASE_URL || '', // 画像URLのベースURL（CodeBuild環境変数から設定、バケット名とは異なる場合がある）
    cognitoUserPoolId: process.env.NUXT_PUBLIC_COGNITO_USER_POOL_ID || '',
    cognitoClientId: process.env.NUXT_PUBLIC_COGNITO_CLIENT_ID || '',
    
    // Public keys (exposed to the client-side)
    public: {
      apiBaseUrl: process.env.API_BASE_URL || '/api',
      imageBaseUrl: process.env.NUXT_IMAGE_BASE_URL || '' // クライアント側でも画像URLにアクセス可能にする
    }
  },

  // Server-side rendering
  ssr: false,

  // App configuration
  app: {
    head: {
      title: 'Futura',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Futura' }
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