<template>
  <v-dialog
    :model-value="modelValue"
    max-width="600"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-lg font-semibold">
        新しい相場価格を設定
      </v-card-title>

      <v-card-text>
        <v-form ref="formRef" @submit.prevent="createRate">
          <div class="space-y-4">
            <v-text-field
              v-model="form.timestamp"
              label="設定日時 *"
              type="datetime-local"
              variant="outlined"
              :rules="timestampRules"
              hint="この日時時点での相場価格として記録されます"
              persistent-hint
              required
            />

            <v-text-field
              v-model="formattedRate"
              label="BTC価格（円） *"
              type="text"
              variant="outlined"
              :rules="rateRules"
              prefix="¥"
              suffix="JPY"
              hint="1 BTCの日本円価格を入力してください（小数点2桁まで、カンマ自動挿入）"
              persistent-hint
              required
              @blur="formatOnBlur"
            />

            <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 class="font-medium text-blue-800 mb-2 flex items-center">
                <Icon name="mdi-calculator" class="mr-2" />
                価格例（参考値）
              </h4>
              <div class="grid grid-cols-2 gap-4 text-sm text-blue-700">
                <div class="cursor-pointer hover:bg-blue-100 p-2 rounded" @click="setExampleRate(5123456.78)">
                  {{ (5123456.78).toLocaleString('ja-JP') }}円 (保守的)
                </div>
                <div class="cursor-pointer hover:bg-blue-100 p-2 rounded" @click="setExampleRate(7850000.50)">
                  {{ (7850000.50).toLocaleString('ja-JP') }}円 (中程度)
                </div>
                <div class="cursor-pointer hover:bg-blue-100 p-2 rounded" @click="setExampleRate(10975432.25)">
                  {{ (10975432.25).toLocaleString('ja-JP') }}円 (高価格)
                </div>
                <div class="cursor-pointer hover:bg-blue-100 p-2 rounded" @click="setExampleRate(13250000.99)">
                  {{ (13250000.99).toLocaleString('ja-JP') }}円 (極高価格)
                </div>
              </div>
            </div>
          </div>
        </v-form>

        <v-alert
          type="warning"
          variant="tonal"
          class="mt-4"
          density="compact"
        >
          <div class="text-sm">
            <strong>注意:</strong>
            <ul class="mt-2 ml-4 list-disc space-y-1">
              <li>この価格設定により、全ユーザーの資産価値が即座に再計算されます</li>
              <li>過去の日時を設定することも可能です</li>
              <li>設定後の取り消しはできません</li>
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
          @click="createRate"
        >
          設定
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { MarketRateCreateForm } from '~/types'

// Props & Emits
const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'created': []
}>()

const logger = useLogger({ prefix: '[CreateMarketRateDialog]' })
const { showSuccess, showError } = useNotification()

// State
const formRef = ref()
const loading = ref(false)

const form = reactive<MarketRateCreateForm>({
  timestamp: '',
  btc_jpy_rate: 0
})

// Formatted rate for display (with commas for readability)
const formattedRate = ref('')

// Watch for input changes and update form value
watch(formattedRate, (newValue) => {
  // Remove commas and validate
  const cleanValue = newValue.replace(/,/g, '')
  const numValue = parseFloat(cleanValue)
  
  // Update the form value (clean number)
  form.btc_jpy_rate = isNaN(numValue) ? 0 : numValue
}, { immediate: true })

// Format number with commas on blur
const formatOnBlur = () => {
  if (form.btc_jpy_rate && !isNaN(form.btc_jpy_rate)) {
    formattedRate.value = form.btc_jpy_rate.toLocaleString('ja-JP', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })
  }
}

// Validation rules
const timestampRules = [
  (v: string) => !!v || '設定日時は必須です',
  (v: string) => {
    const date = new Date(v)
    return !isNaN(date.getTime()) || '有効な日時を入力してください'
  }
]

const rateRules = [
  (v: string) => !!v || 'BTC価格は必須です',
  (v: string) => {
    const numValue = parseFloat(v.replace(/,/g, ''))
    return !isNaN(numValue) || '有効な数値を入力してください'
  },
  (v: string) => {
    const numValue = parseFloat(v.replace(/,/g, ''))
    return numValue > 0 || 'BTC価格は正の数値で入力してください'
  },
  (v: string) => {
    const numValue = parseFloat(v.replace(/,/g, ''))
    return numValue <= 100000000 || 'BTC価格が高すぎます'
  },
  (v: string) => {
    const cleanValue = v.replace(/,/g, '')
    const decimal = cleanValue.split('.')[1]
    return !decimal || decimal.length <= 2 || '小数点以下は2桁までです'
  }
]

// Methods
const createRate = async () => {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  if (!confirm('この相場価格を設定してよろしいですか？全ユーザーの資産価値が再計算されます。')) {
    return
  }

  loading.value = true
  
  try {
    await $fetch('/api/admin/market-rates', {
      method: 'POST',
      body: form
    })

    showSuccess('相場価格を設定し、全ユーザーの資産価値を更新しました')
    resetForm()
    emit('created')
  } catch (error) {
    logger.error('相場価格の作成に失敗しました:', error)
    showError('相場価格の設定に失敗しました')
  } finally {
    loading.value = false
  }
}

const cancel = () => {
  resetForm()
  emit('update:modelValue', false)
}

const resetForm = () => {
  form.timestamp = ''
  form.btc_jpy_rate = 0
  formattedRate.value = ''
  formRef.value?.resetValidation()
}

const setExampleRate = (rate: number) => {
  form.btc_jpy_rate = rate
  formattedRate.value = rate.toLocaleString('ja-JP', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

// Set current datetime when dialog opens
watch(() => props.modelValue, (newValue) => {
  if (newValue && !form.timestamp) {
    const now = new Date()
    // Format for datetime-local input
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    
    form.timestamp = `${year}-${month}-${day}T00:00:00`
  }
})

// Reset form when dialog closes
watch(() => props.modelValue, (newValue) => {
  if (!newValue) {
    resetForm()
  }
})
</script>