<template>
  <div>
    <h2 class="text-2xl font-bold text-center text-gray-900 mb-8">ログイン</h2>
    
    <v-form :disabled="isLoading" @submit.prevent="handleLogin">
      <div class="space-y-4">
        <v-text-field
          v-model="form.email"
          label="メールアドレス"
          type="email"
          variant="outlined"
          :rules="emailRules"
          required
          autocomplete="email"
        />
        
        <v-text-field
          v-model="form.password"
          label="パスワード"
          :type="showPassword ? 'text' : 'password'"
          variant="outlined"
          :rules="passwordRules"
          required
          autocomplete="current-password"
        >
        <template #append-inner>
          <Icon v-if="showPassword" name="mdi:eye" class="cursor-pointer" @click="showPassword = !showPassword" />
          <Icon v-else name="mdi:eye-off" class="cursor-pointer" @click="showPassword = !showPassword" />
        </template>
        </v-text-field>

        <v-btn
          type="submit"
          color="primary"
          size="large"
          block
          :loading="isLoading"
          class="mt-6"
        >
          ログイン
        </v-btn>
      </div>
    </v-form>

    <!-- Password Change Dialog -->
    <AuthChangeInitialPasswordDialog
      v-model="showPasswordChangeDialog"
      :email="passwordChangeData.email"
      :temporary-password="passwordChangeData.temporaryPassword"
      :session="passwordChangeData.session"
      @success="handlePasswordChangeSuccess"
    />
  </div>
</template>

<script setup lang="ts">
const logger = useLogger({ prefix: '[COMPONENT-LOGIN-FORM]' })

const { login } = useAuth()
const { showError, showSuccess } = useNotification()

const isLoading = ref(false)
const showPassword = ref(false)
const showPasswordChangeDialog = ref(false)

const form = reactive({
  email: '',
  password: ''
})

const passwordChangeData = reactive({
  email: '',
  temporaryPassword: '',
  session: ''
})

const emailRules = [
  (v: string) => !!v || 'メールアドレスは必須です',
  (v: string) => /.+@.+\..+/.test(v) || '有効なメールアドレスを入力してください'
]

const passwordRules = [
  (v: string) => !!v || 'パスワードは必須です',
  (v: string) => v.length >= 8 || 'パスワードは8文字以上で入力してください'
]

const handleLogin = async () => {
  isLoading.value = true
  
  try {
    const result = await login(form)
    
    if (result?.success) {
      showSuccess('ログインしました')
    } else if (result?.challenge === 'NEW_PASSWORD_REQUIRED') {
      // Show password change dialog
      passwordChangeData.email = form.email
      passwordChangeData.temporaryPassword = form.password
      passwordChangeData.session = result.session
      showPasswordChangeDialog.value = true
      showSuccess('初回ログインです。新しいパスワードを設定してください。')
    } else {
      showError('ログインに失敗しました。メールアドレスとパスワードを確認してください。')
    }
  } catch (error) {
    logger.error('ログインエラー:', error)
    showError('ログイン処理中にエラーが発生しました')
  } finally {
    isLoading.value = false
  }
}

const handlePasswordChangeSuccess = async (authResult: any) => {
  try {
    // Complete login process with new authentication result
    const success = await login(form, authResult)
    if (success) {
      showSuccess('パスワード変更とログインが完了しました')
    }
  } catch (error) {
    logger.error('パスワード変更後のログインエラー:', error)
    showError('パスワード変更後のログイン処理でエラーが発生しました')
  }
}

// Auto-fill demo credentials
const _fillDemoCredentials = (type: 'admin' | 'user') => {
  if (type === 'admin') {
    form.email = 'admin@example.com'
    form.password = 'TempAdmin123!'
  } else {
    form.email = 'user@example.com'
    form.password = 'TempUser123!'
  }
}
</script>