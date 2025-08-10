<template>
  <v-app>
    <v-main>
      <v-container class="fill-height" fluid>
        <v-row align="center" justify="center">
          <v-col cols="12" sm="8" md="6" lg="4">
            <v-card elevation="8" class="pa-8 auth-error-card">
              <v-card-title class="text-center">
                <v-icon 
                  icon="mdi-account-lock-outline" 
                  color="warning"
                  size="80"
                  class="mb-4"
                />
                <h1 class="text-h4 font-weight-bold mb-2">
                  認証エラー
                </h1>
              </v-card-title>
              
              <v-card-text class="text-center">
                <p class="text-h6 mb-4 text-warning">
                  セッションが無効または期限切れです
                </p>
                <p class="text-body-1 text-medium-emphasis mb-6">
                  セキュリティのため、再度ログインしてください。<br>
                  セッションが期限切れになった可能性があります。
                </p>
                
                <v-alert
                  type="info"
                  variant="tonal"
                  class="mb-6 text-left"
                  icon="mdi-information"
                >
                  <div class="text-body-2">
                    <strong>考えられる原因：</strong>
                    <ul class="mt-2 ml-4">
                      <li>長時間の非アクティブ状態</li>
                      <li>セッションの期限切れ</li>
                      <li>他のデバイスからのログアウト</li>
                      <li>セキュリティ上の理由によるセッション無効化</li>
                    </ul>
                  </div>
                </v-alert>
              </v-card-text>
              
              <v-card-actions class="justify-center flex-column gap-3">
                <v-btn
                  color="primary"
                  size="large"
                  variant="elevated"
                  prepend-icon="mdi-login"
                  class="px-8"
                  :loading="isRedirecting"
                  @click="redirectToLogin"
                >
                  ログインページへ
                </v-btn>
                
                <v-btn
                  color="secondary"
                  size="large"
                  variant="outlined"
                  prepend-icon="mdi-home"
                  class="px-8"
                  @click="goHome"
                >
                  ホームに戻る
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
const isRedirecting = ref(false)

// ページメタ設定
definePageMeta({
  layout: false, // レイアウトを無効化
  auth: false   // 認証不要
})

// SEOメタ設定
useSeoMeta({
  title: '認証エラー - BTC Mock App',
  description: 'セッションが無効または期限切れです。再度ログインしてください。',
  robots: 'noindex, nofollow'
})

// セッションクリア関数
const clearSession = async () => {
  try {
    // サーバーサイドのセッションクリア
    const apiClient = useApiClient()
    await apiClient.post('/auth/logout')
  } catch (error) {
    console.warn('ログアウト処理中にエラーが発生しましたが、続行します:', error)
  }
}

// ログインページへリダイレクト
const redirectToLogin = async () => {
  isRedirecting.value = true
  
  try {
    // セッションクリア
    await clearSession()
    
    // 現在のパスを取得（リダイレクト用）
    const route = useRoute()
    const from = route.query.from as string || '/'
    
    // ログインページへリダイレクト
    await navigateTo(`/login?redirect=${encodeURIComponent(from)}`)
  } catch (error) {
    console.error('リダイレクト中にエラーが発生しました:', error)
    // エラーが発生してもログインページへリダイレクト
    await navigateTo('/login')
  } finally {
    isRedirecting.value = false
  }
}

// ホームページへ移動
const goHome = async () => {
  try {
    await clearSession()
    await navigateTo('/')
  } catch (error) {
    console.error('ホームページへの移動中にエラーが発生しました:', error)
    await navigateTo('/')
  }
}

// ページ読み込み時にセッションクリア
onMounted(async () => {
  await clearSession()
})
</script>

<style scoped>
.auth-error-card {
  border-radius: 16px;
  max-width: 500px;
  margin: 0 auto;
}

.gap-3 {
  gap: 12px;
}

/* アニメーション */
.v-card {
  animation: fadeInUp 0.5s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* レスポンシブ調整 */
@media (max-width: 600px) {
  .auth-error-card {
    margin: 16px;
  }
}
</style>