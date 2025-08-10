<template>
  <v-dialog
    :model-value="modelValue"
    max-width="600"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-lg font-semibold">
        新規ユーザー作成
      </v-card-title>

      <v-card-text>
        <v-form ref="formRef" @submit.prevent="createUser">
          <div class="space-y-4">
            <v-text-field
              v-model="form.email"
              label="メールアドレス *"
              type="email"
              variant="outlined"
              :rules="emailRules"
              required
            />

            <v-text-field
              v-model="form.name"
              label="氏名 *"
              variant="outlined"
              :rules="nameRules"
              required
            />

            <v-textarea
              v-model="form.address"
              label="住所 *"
              variant="outlined"
              :rules="addressRules"
              rows="3"
              required
            />

            <v-text-field
              v-model="form.phone_number"
              label="電話番号 *"
              variant="outlined"
              :rules="phoneRules"
              required
            />

            <v-text-field
              v-model="form.temporary_password"
              label="仮パスワード *"
              :type="showPassword ? 'text' : 'password'"
              variant="outlined"
              :rules="passwordRules"
              :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
              hint="ユーザーは初回ログイン時にパスワード変更が必要です"
              persistent-hint
              required
              @click:append-inner="showPassword = !showPassword"
            />
          </div>
        </v-form>

        <v-alert
          type="info"
          variant="tonal"
          class="mt-4"
          density="compact"
        >
          <div class="text-sm">
            <strong>注意:</strong>
            <ul class="mt-2 ml-4 list-disc space-y-1">
              <li>作成されたユーザーは自動的に一般ユーザーグループに追加されます</li>
              <li>ユーザーには確認メールは送信されません</li>
              <li>仮パスワードを直接お伝えください</li>
            </ul>
          </div>
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          :disabled="loading"
          @click="cancel"
        >
          キャンセル
        </v-btn>
        <v-btn
          color="primary"
          :loading="loading"
          @click="createUser"
        >
          作成
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { UserCreateForm } from '~/types'

const logger = useLogger({ prefix: '[COMPONENT-CREATE-USER-DIALOG]' })
const apiClient = useApiClient()

// Props & Emits
const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'created': []
}>()

const { showSuccess, showError } = useNotification()

// State
const formRef = ref()
const loading = ref(false)
const showPassword = ref(false)

const form = reactive<UserCreateForm>({
  email: '',
  name: '',
  address: '',
  phone_number: '',
  temporary_password: ''
})

// Validation rules
const emailRules = [
  (v: string) => !!v || 'メールアドレスは必須です',
  (v: string) => /.+@.+\..+/.test(v) || '有効なメールアドレスを入力してください'
]

const nameRules = [
  (v: string) => !!v || '氏名は必須です',
  (v: string) => v.length >= 2 || '氏名は2文字以上で入力してください'
]

const addressRules = [
  (v: string) => !!v || '住所は必須です',
  (v: string) => v.length >= 10 || '住所は10文字以上で入力してください'
]

const phoneRules = [
  (v: string) => !!v || '電話番号は必須です',
  (v: string) => /^[\d-+()]+$/.test(v) || '有効な電話番号を入力してください'
]

const passwordRules = [
  (v: string) => !!v || 'パスワードは必須です',
  (v: string) => v.length >= 8 || 'パスワードは8文字以上で入力してください',
  (v: string) => /(?=.*[a-z])/.test(v) || 'パスワードに小文字を含めてください',
  (v: string) => /(?=.*\d)/.test(v) || 'パスワードに数字を含めてください'
]

// Methods
const createUser = async () => {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  loading.value = true
  
  try {
    await apiClient.post('/admin/users', form)

    showSuccess('ユーザーを作成しました')
    resetForm()
    emit('created')
  } catch (error: unknown) {
    logger.error('ユーザーの作成に失敗しました:', error)
    
    // Type guard for fetch error
    const fetchError = error as { data?: { statusMessage?: string } }
    if (fetchError.data?.statusMessage === 'User already exists') {
      showError('このメールアドレスは既に使用されています')
    } else {
      showError('ユーザーの作成に失敗しました')
    }
  } finally {
    loading.value = false
  }
}

const cancel = () => {
  resetForm()
  emit('update:modelValue', false)
}

const resetForm = () => {
  form.email = ''
  form.name = ''
  form.address = ''
  form.phone_number = ''
  form.temporary_password = ''
  showPassword.value = false
  formRef.value?.resetValidation()
}

// Generate random password
const generatePassword = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  // Ensure it has at least one lowercase and one number
  form.temporary_password = password + '1a'
}

// Auto-generate password on dialog open
watch(() => props.modelValue, (newValue) => {
  if (newValue && !form.temporary_password) {
    generatePassword()
  }
})
</script>