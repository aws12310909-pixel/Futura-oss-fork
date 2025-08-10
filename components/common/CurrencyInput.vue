<template>
  <div class="space-y-2">
    <div class="flex flex-col sm:flex-row gap-2">
      <v-select
        v-model="selectedCurrency"
        :items="currencyOptions"
        label="入力通貨"
        variant="outlined"
        class="w-full sm:w-32 flex-shrink-0"
        @update:model-value="onCurrencyChange"
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
        v-model.number="btcAmount"
        label="金額（BTC） *"
        type="number"
        step="0.00000001"
        variant="outlined"
        :rules="btcAmountRules"
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
          {{ selectedCurrency === 'JPY' ? `${(btcAmount || 0).toFixed(8)} BTC` : `${(jpyAmount || 0).toLocaleString()} JPY` }}
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
</template>

<script setup lang="ts">
import type { MarketRate } from '~/types'

interface Props {
  modelValue: number // BTC amount
  maxBtc?: number
  maxJpy?: number
  disabled?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: number): void
}

const props = withDefaults(defineProps<Props>(), {
  maxBtc: 999999999, // 事実上制限なし
  maxJpy: 999999999999999, // 事実上制限なし
  disabled: false
})

const emit = defineEmits<Emits>()

const logger = useLogger({ prefix: '[CurrencyInput]' })
const apiClient = useApiClient()

// State
const selectedCurrency = ref<'BTC' | 'JPY'>('BTC')
const jpyAmount = ref<number>(0)
const btcAmount = ref<number>(props.modelValue || 0)
const latestRate = ref<MarketRate | null>(null)
const rateError = ref<boolean>(false)

// Options
const currencyOptions = [
  { title: 'BTC', value: 'BTC' },
  { title: 'JPY', value: 'JPY' }
]

// Validation rules
const btcAmountRules = [
  (v: number) => !!v || '金額は必須です',
  (v: number) => v > 0 || '金額は正の数値で入力してください'
]

const jpyAmountRules = [
  (v: number) => !!v || '金額は必須です',
  (v: number) => v > 0 || '金額は正の数値で入力してください'
]

// Methods
const loadLatestRate = async () => {
  try {
    rateError.value = false
    const response = await apiClient.get<MarketRate>('/market-rates/latest')
    if (response.data) {
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
  if (!latestRate.value || !jpyAmount.value || isNaN(jpyAmount.value)) {
    btcAmount.value = 0
    emit('update:modelValue', 0)
    return
  }
  
  const calculatedBtc = jpyAmount.value / latestRate.value.btc_jpy_rate
  btcAmount.value = isNaN(calculatedBtc) ? 0 : calculatedBtc
  emit('update:modelValue', btcAmount.value)
}

const convertBtcToJpy = () => {
  if (!latestRate.value || !btcAmount.value || isNaN(btcAmount.value)) {
    jpyAmount.value = 0
    return
  }
  
  const calculatedJpy = Math.round(btcAmount.value * latestRate.value.btc_jpy_rate)
  jpyAmount.value = isNaN(calculatedJpy) ? 0 : calculatedJpy
  emit('update:modelValue', btcAmount.value)
}

const formatCurrency = (amount: number): string => {
  if (isNaN(amount)) return '取得中...'
  return new Intl.NumberFormat('ja-JP').format(amount)
}

const onCurrencyChange = (currency: 'BTC' | 'JPY') => {
  if (currency === 'JPY') {
    // BTCからJPYモードに変更
    convertBtcToJpy()
  } else {
    // JPYからBTCモードに変更
    convertJpyToBtc()
  }
}

// Watchers
watch(() => props.modelValue, (newValue) => {
  btcAmount.value = newValue || 0
  if (selectedCurrency.value === 'JPY') {
    convertBtcToJpy()
  }
})

watch(latestRate, () => {
  // レートが更新された時に再計算
  if (selectedCurrency.value === 'JPY') {
    convertJpyToBtc()
  } else {
    convertBtcToJpy()
  }
})

// Initialize
onMounted(() => {
  loadLatestRate()
})
</script>