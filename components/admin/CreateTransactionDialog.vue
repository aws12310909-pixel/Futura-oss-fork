<template>
  <v-dialog
    :model-value="modelValue"
    max-width="600"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-lg font-semibold">
        新しい取引を追加
      </v-card-title>

      <v-card-text>
        <v-form ref="formRef" @submit.prevent="createTransaction">
          <div class="space-y-4">
            <v-select
              v-model="form.user_id"
              :items="userOptions"
              label="対象ユーザー *"
              variant="outlined"
              :rules="userRules"
              required
              @update:model-value="onUserChange"
            />

            <!-- User Balance Display -->
            <div v-if="selectedUserBalance !== null" class="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 class="font-medium text-blue-800 mb-2">現在の残高</h4>
              <p class="text-lg font-semibold text-blue-900">
                {{ selectedUserBalance }} BTC
              </p>
            </div>

            <v-select
              v-model="form.transaction_type"
              :items="transactionTypeOptions"
              label="取引種別 *"
              variant="outlined"
              :rules="typeRules"
              required
            />

            <!-- Currency and Amount Input -->
            <div class="space-y-2">
              <div class="flex flex-col sm:flex-row gap-2">
                <v-select
                  v-model="selectedCurrency"
                  :items="currencyOptions"
                  label="入力通貨"
                  variant="outlined"
                  class="w-full sm:w-32 flex-shrink-0"
                />
                
                <v-text-field
                  v-if="selectedCurrency === 'JPY'"
                  v-model.number="jpyAmount"
                  label="金額（JPY） *"
                  type="number"
                  step="1"
                  variant="outlined"
                  :rules="jpyAmountRules"
                  suffix="JPY"
                  hint="最新の相場レートでBTCに自動換算されます"
                  persistent-hint
                  required
                  class="flex-1"
                  @input="convertJpyToBtc"
                />
                
                <v-text-field
                  v-else
                  v-model.number="form.amount"
                  label="金額（BTC） *"
                  type="number"
                  step="0.00000001"
                  variant="outlined"
                  :rules="amountRules"
                  suffix="BTC"
                  hint="直接BTCで金額を入力します"
                  persistent-hint
                  required
                  class="flex-1"
                  @input="convertBtcToJpy"
                />
              </div>

              <!-- Exchange Rate Display -->
              <div v-if="latestRate" class="bg-gray-50 p-4 rounded-lg border">
                <div class="flex items-center justify-between text-sm">
                  <span class="font-medium text-gray-700">現在の相場レート:</span>
                  <span class="font-mono text-gray-900">1 BTC = {{ formatCurrency(latestRate.btc_jpy_rate) }} JPY</span>
                </div>
                <div class="flex items-center justify-between text-sm mt-2">
                  <span class="font-medium text-gray-700">換算後金額:</span>
                  <span class="font-mono text-blue-600">
                    {{ selectedCurrency === 'JPY' ? `${form.amount.toFixed(8)} BTC` : `${jpyAmount.toLocaleString()} JPY` }}
                  </span>
                </div>
              </div>

              <!-- Rate Loading/Error State -->
              <v-alert
                v-if="rateError"
                type="error"
                variant="tonal"
                density="compact"
                class="mt-2"
              >
                相場レートの取得に失敗しました。BTCで直接入力してください。
              </v-alert>
            </div>

            <v-text-field
              v-model="form.reason"
              label="操作理由 *"
              variant="outlined"
              :rules="reasonRules"
              hint="この取引を行う理由を入力してください"
              persistent-hint
              required
            />

            <v-textarea
              v-model="form.memo"
              label="メモ"
              variant="outlined"
              :rules="memoRules"
              rows="3"
              hint="ユーザーに表示される詳細情報（任意）"
              persistent-hint
            />
          </div>
        </v-form>

        <v-alert
          v-if="form.transaction_type === 'withdrawal' && selectedUserBalance !== null && form.amount > selectedUserBalance"
          type="error"
          variant="tonal"
          class="mt-4"
          density="compact"
        >
          残高不足です。現在の残高: {{ selectedUserBalance }} BTC
        </v-alert>

        <v-alert
          type="info"
          variant="tonal"
          class="mt-4"
          density="compact"
        >
          <div class="text-sm">
            <strong>注意:</strong>
            この操作は取り消すことができません。金額と理由を十分に確認してください。
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
          :disabled="isInvalidWithdrawal"
          @click="createTransaction"
        >
          追加
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { TransactionCreateForm, User, MarketRate } from '~/types'

// Props & Emits
const props = defineProps<{
  modelValue: boolean
  users: User[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'created': []
}>()

const logger = useLogger({ prefix: '[CreateTransactionDialog]' })
const { showSuccess, showError } = useNotification()

// State
const formRef = ref()
const loading = ref(false)
const selectedUserBalance = ref<number | null>(null)
const selectedCurrency = ref<'BTC' | 'JPY'>('BTC')
const jpyAmount = ref<number>(0)
const latestRate = ref<MarketRate | null>(null)
const rateError = ref<boolean>(false)

const form = reactive<TransactionCreateForm>({
  user_id: '',
  amount: 0,
  transaction_type: 'deposit',
  memo: '',
  reason: ''
})

// Options
const userOptions = computed(() => 
  props.users.map(user => ({
    title: `${user.name} (${user.email})`,
    value: user.user_id
  }))
)

const transactionTypeOptions = [
  { title: '入金', value: 'deposit' },
  { title: '出金', value: 'withdrawal' }
]

const currencyOptions = [
  { title: 'BTC', value: 'BTC' },
  { title: 'JPY', value: 'JPY' }
]

// Computed
const isInvalidWithdrawal = computed(() => {
  return form.transaction_type === 'withdrawal' && 
         selectedUserBalance.value !== null && 
         form.amount > selectedUserBalance.value
})

// Validation rules
const userRules = [
  (v: string) => !!v || 'ユーザーを選択してください'
]

const typeRules = [
  (v: string) => !!v || '取引種別を選択してください'
]

const amountRules = [
  (v: number) => !!v || '金額は必須です',
  (v: number) => v > 0 || '金額は正の数値で入力してください',
  (v: number) => v <= 1000 || '金額が大きすぎます（最大1000 BTC）'
]

const jpyAmountRules = [
  (v: number) => !!v || '金額は必須です',
  (v: number) => v > 0 || '金額は正の数値で入力してください',
  (v: number) => v <= 20000000000 || '金額が大きすぎます（最大200億円）'
]

const reasonRules = [
  (v: string) => !!v || '操作理由は必須です',
  (v: string) => v.length >= 3 || '操作理由は3文字以上で入力してください'
]

const memoRules = [
  (v: string) => !v || v.length >= 5 || 'メモは5文字以上で入力してください'
]

// Methods
const createTransaction = async () => {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  if (isInvalidWithdrawal.value) {
    showError('残高が不足しています')
    return
  }

  const selectedUser = props.users.find(u => u.user_id === form.user_id)
  const confirmMessage = `${selectedUser?.name}に${form.transaction_type === 'deposit' ? '入金' : '出金'}（${form.amount} BTC）を実行してもよろしいですか？`
  
  if (!confirm(confirmMessage)) {
    return
  }

  loading.value = true
  
  try {
    await $fetch('/api/admin/transactions', {
      method: 'POST',
      body: form
    })

    showSuccess('取引を追加しました')
    resetForm()
    emit('created')
  } catch (error: unknown) {
    logger.error('取引の作成に失敗しました:', error)
    
    // Type guard for fetch error
    const fetchError = error as { data?: { statusMessage?: string } }
    if (fetchError.data?.statusMessage?.includes('Insufficient balance')) {
      showError('残高が不足しています')
    } else {
      showError('取引の追加に失敗しました')
    }
  } finally {
    loading.value = false
  }
}

const cancel = () => {
  resetForm()
  emit('update:modelValue', false)
}

// Currency conversion methods
const loadLatestRate = async () => {
  try {
    rateError.value = false
    const response = await $fetch<{ success: boolean; data: MarketRate }>('/api/market-rates/latest')
    if (response.success && response.data) {
      latestRate.value = response.data
    } else {
      throw new Error('No market rate data available')
    }
  } catch (error) {
    logger.error('相場レート取得エラー:', error)
    rateError.value = true
    latestRate.value = null
  }
}

const convertJpyToBtc = () => {
  if (!latestRate.value || !jpyAmount.value) {
    form.amount = 0
    return
  }
  
  form.amount = jpyAmount.value / latestRate.value.btc_jpy_rate
}

const convertBtcToJpy = () => {
  if (!latestRate.value || !form.amount) {
    jpyAmount.value = 0
    return
  }
  
  jpyAmount.value = Math.round(form.amount * latestRate.value.btc_jpy_rate)
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ja-JP').format(amount)
}

const resetForm = () => {
  form.user_id = ''
  form.amount = 0
  form.transaction_type = 'deposit'
  form.memo = ''
  form.reason = ''
  selectedUserBalance.value = null
  selectedCurrency.value = 'BTC'
  jpyAmount.value = 0
  formRef.value?.resetValidation()
}

const onUserChange = async (userId: string) => {
  if (!userId) {
    selectedUserBalance.value = null
    return
  }

  try {
    const { data } = await $fetch<{ success: boolean; data: { btc_balance: number } }>(`/api/admin/users/${userId}/balance`)
    selectedUserBalance.value = data.btc_balance
  } catch (error) {
    logger.error('ユーザー残高の取得に失敗しました:', error)
    selectedUserBalance.value = null
  }
}

// Watchers
watch(() => props.modelValue, async (newValue) => {
  if (newValue) {
    // ダイアログが開かれた時に相場レートを取得
    await loadLatestRate()
  } else {
    resetForm()
  }
})

// 通貨選択が変更された時の処理
watch(selectedCurrency, (newCurrency) => {
  if (newCurrency === 'JPY') {
    // BTCからJPYモードに変更
    convertBtcToJpy()
  } else {
    // JPYからBTCモードに変更
    convertJpyToBtc()
  }
})
</script>