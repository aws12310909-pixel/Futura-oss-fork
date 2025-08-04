<template>
  <v-app>
    <v-main>
      <v-container class="fill-height" fluid>
        <v-row align="center" justify="center">
          <v-col cols="12" sm="8" md="6" lg="4">
            <v-card elevation="8" class="pa-6">
              <v-card-title class="text-center">
                <v-icon 
                  :icon="errorIcon" 
                  :color="errorColor"
                  size="64"
                  class="mb-4"
                />
                <h1 class="text-h4 font-weight-bold">
                  {{ errorTitle }}
                </h1>
              </v-card-title>
              
              <v-card-text class="text-center">
                <p class="text-h6 mb-4">
                  {{ errorMessage }}
                </p>
                <p class="text-body-1 text-medium-emphasis mb-6">
                  {{ errorDescription }}
                </p>
              </v-card-text>
              
              <v-card-actions class="justify-center flex-column gap-2">
                <v-btn
                  v-if="showLoginButton"
                  color="primary"
                  size="large"
                  variant="elevated"
                  @click="goToLogin"
                  prepend-icon="mdi-login"
                  class="mb-2"
                >
                  ログインページへ
                </v-btn>
                
                <v-btn
                  color="secondary"
                  size="large"
                  variant="outlined"
                  @click="goHome"
                  prepend-icon="mdi-home"
                >
                  ホームに戻る
                </v-btn>
                
                <v-btn
                  v-if="showRetryButton"
                  color="warning"
                  size="large"
                  variant="text"
                  @click="retryRequest"
                  prepend-icon="mdi-refresh"
                  class="mt-2"
                >
                  再試行
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
const error = useError()

// エラー情報の取得
const statusCode = computed(() => error.value?.statusCode || 500)
const statusMessage = computed(() => error.value?.statusMessage || 'Unknown Error')

// エラータイプに応じた表示設定
const errorConfig = computed(() => {
  switch (statusCode.value) {
    case 401:
      return {
        icon: 'mdi-lock-alert',
        color: 'warning',
        title: '認証が必要です',
        message: 'ログインが必要です',
        description: 'このページにアクセスするにはログインしてください。セッションが期限切れの可能性があります。',
        showLogin: true,
        showRetry: false
      }
    case 403:
      return {
        icon: 'mdi-shield-alert',
        color: 'error',
        title: 'アクセス権限がありません',
        message: '権限が不足しています',
        description: 'このリソースにアクセスする権限がありません。管理者にお問い合わせください。',
        showLogin: false,
        showRetry: false
      }
    case 404:
      return {
        icon: 'mdi-file-question',
        color: 'info',
        title: 'ページが見つかりません',
        message: 'お探しのページは存在しません',
        description: 'URLが正しいかご確認ください。ページが移動または削除された可能性があります。',
        showLogin: false,
        showRetry: false
      }
    case 500:
      return {
        icon: 'mdi-server-network-off',
        color: 'error',
        title: 'サーバーエラー',
        message: 'サーバーで問題が発生しました',
        description: '一時的な問題の可能性があります。しばらく時間をおいてから再度お試しください。',
        showLogin: false,
        showRetry: true
      }
    default:
      return {
        icon: 'mdi-alert-circle',
        color: 'error',
        title: 'エラーが発生しました',
        message: statusMessage.value,
        description: '予期しないエラーが発生しました。問題が続く場合は管理者にお問い合わせください。',
        showLogin: false,
        showRetry: true
      }
  }
})

const errorIcon = computed(() => errorConfig.value.icon)
const errorColor = computed(() => errorConfig.value.color)
const errorTitle = computed(() => errorConfig.value.title)
const errorMessage = computed(() => errorConfig.value.message)
const errorDescription = computed(() => errorConfig.value.description)
const showLoginButton = computed(() => errorConfig.value.showLogin)
const showRetryButton = computed(() => errorConfig.value.showRetry)

// ナビゲーション関数
const goToLogin = () => {
  clearError({ redirect: '/login' })
}

const goHome = () => {
  clearError({ redirect: '/' })
}

const retryRequest = () => {
  clearError()
}

// SEOメタ設定
useSeoMeta({
  title: `${statusCode.value} - ${errorTitle.value}`,
  description: errorDescription.value,
  robots: 'noindex, nofollow'
})
</script>

<style scoped>
.v-card {
  border-radius: 16px;
}

.gap-2 {
  gap: 8px;
}
</style>