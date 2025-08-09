<template>
  <v-dialog
    v-model="dialog"
    max-width="800px"
    persistent
  >
    <v-card>
      <v-card-title>
        <span class="text-h5">CSV一括アップロード - 相場レート</span>
      </v-card-title>

      <v-card-text>
        <v-stepper
          v-model="step"
          alt-labels
        >
          <v-stepper-header>
            <v-stepper-item
              value="1"
              title="CSVファイル選択"
            />
            <v-divider />
            <v-stepper-item
              value="2"
              title="データ確認"
            />
            <v-divider />
            <v-stepper-item
              value="3"
              title="アップロード実行"
            />
          </v-stepper-header>

          <v-stepper-window>
            <!-- Step 1: File Selection -->
            <v-stepper-window-item value="1">
              <div class="mb-4">
                <h3 class="text-h6 mb-2">テンプレートダウンロード</h3>
                <p class="text-body-2 text-grey-600 mb-4">
                  まず、テンプレートCSVをダウンロードして、正しい形式を確認してください。
                </p>
                <v-btn
                  variant="outlined"
                  color="primary"
                  @click="downloadTemplate"
                  :loading="downloading"
                  prepend-icon="mdi-download"
                >
                  テンプレートCSVダウンロード
                </v-btn>
              </div>

              <v-divider class="my-6" />

              <div>
                <h3 class="text-h6 mb-2">CSVファイルアップロード</h3>
                <p class="text-body-2 text-grey-600 mb-4">
                  テンプレート形式に従ったCSVファイルを選択してください。
                </p>
                
                <v-file-input
                  v-model="selectedFile"
                  accept=".csv"
                  label="CSVファイルを選択"
                  prepend-icon="mdi-file-csv"
                  show-size
                  :rules="fileRules"
                  :loading="parsing"
                  :disabled="parsing"
                  @change="handleFileSelect"
                />

                <v-alert
                  v-if="parsing"
                  type="info"
                  class="mt-4"
                >
                  CSVファイルを解析中...
                </v-alert>

                <v-alert
                  v-if="parseError"
                  type="error"
                  class="mt-4"
                >
                  {{ parseError }}
                </v-alert>
              </div>
            </v-stepper-window-item>

            <!-- Step 2: Data Confirmation -->
            <v-stepper-window-item value="2">
              <div v-if="parsedData.length > 0">
                <div class="d-flex justify-space-between align-center mb-4">
                  <h3 class="text-h6">データ確認</h3>
                  <v-chip
                    color="primary"
                    variant="outlined"
                  >
                    {{ parsedData.length }}件のデータ
                  </v-chip>
                </div>

                <v-alert
                  v-if="duplicates.length > 0"
                  type="warning"
                  class="mb-4"
                >
                  <strong>{{ duplicates.length }}件の重複データが検出されました。</strong>
                  これらのデータは既に登録済みのため、スキップされます。
                </v-alert>

                <v-alert
                  v-if="validationErrors.length > 0"
                  type="error"
                  class="mb-4"
                >
                  <strong>{{ validationErrors.length }}件のエラーが検出されました。</strong>
                  <ul class="mt-2">
                    <li v-for="error in validationErrors.slice(0, 5)" :key="error">
                      {{ error }}
                    </li>
                    <li v-if="validationErrors.length > 5">
                      ...他 {{ validationErrors.length - 5 }}件
                    </li>
                  </ul>
                </v-alert>

                <div class="mb-4">
                  <v-tabs v-model="dataTab">
                    <v-tab value="valid">
                      有効データ ({{ validData.length }}件)
                    </v-tab>
                    <v-tab value="duplicates" v-if="duplicates.length > 0">
                      重複データ ({{ duplicates.length }}件)
                    </v-tab>
                  </v-tabs>

                  <v-window v-model="dataTab">
                    <v-window-item value="valid">
                      <v-data-table
                        :headers="dataHeaders"
                        :items="validData.slice(0, 50)"
                        :items-per-page="10"
                        class="elevation-1"
                        density="compact"
                      >
                        <template #item.btc_jpy_rate="{ item }">
                          ¥{{ Number(item.btc_jpy_rate).toLocaleString() }}
                        </template>
                      </v-data-table>
                      <p v-if="validData.length > 50" class="text-caption text-grey-600 mt-2">
                        ※ 最初の50件のみ表示
                      </p>
                    </v-window-item>

                    <v-window-item value="duplicates">
                      <v-data-table
                        :headers="dataHeaders"
                        :items="duplicates.slice(0, 50)"
                        :items-per-page="10"
                        class="elevation-1"
                        density="compact"
                      >
                        <template #item.btc_jpy_rate="{ item }">
                          ¥{{ Number(item.btc_jpy_rate).toLocaleString() }}
                        </template>
                      </v-data-table>
                    </v-window-item>
                  </v-window>
                </div>
              </div>
            </v-stepper-window-item>

            <!-- Step 3: Upload Execution -->
            <v-stepper-window-item value="3">
              <div v-if="!uploading && !uploadResult">
                <h3 class="text-h6 mb-4">アップロード実行確認</h3>
                <v-alert
                  type="info"
                  class="mb-4"
                >
                  <strong>{{ validData.length }}件</strong>の相場レートデータをアップロードします。
                  <div v-if="duplicates.length > 0" class="mt-2">
                    <strong>{{ duplicates.length }}件</strong>の重複データはスキップされます。
                  </div>
                </v-alert>
                <p class="text-body-2">
                  よろしければ「アップロード実行」ボタンをクリックしてください。
                </p>
              </div>

              <div v-if="uploading">
                <div class="text-center">
                  <v-progress-circular
                    indeterminate
                    color="primary"
                    size="64"
                  />
                  <p class="mt-4 text-h6">アップロード中...</p>
                  <p class="text-body-2">{{ uploadProgress }}</p>
                </div>
              </div>

              <div v-if="uploadResult">
                <v-alert
                  :type="uploadResult.success ? 'success' : 'error'"
                  class="mb-4"
                >
                  {{ uploadResult.message }}
                </v-alert>

                <div v-if="uploadResult.success">
                  <v-row>
                    <v-col cols="4">
                      <v-card variant="outlined">
                        <v-card-text class="text-center">
                          <div class="text-h4 text-success">{{ uploadResult.created_count }}</div>
                          <div class="text-body-2">作成済み</div>
                        </v-card-text>
                      </v-card>
                    </v-col>
                    <v-col cols="4">
                      <v-card variant="outlined">
                        <v-card-text class="text-center">
                          <div class="text-h4 text-warning">{{ uploadResult.duplicates?.length || 0 }}</div>
                          <div class="text-body-2">重複スキップ</div>
                        </v-card-text>
                      </v-card>
                    </v-col>
                    <v-col cols="4">
                      <v-card variant="outlined">
                        <v-card-text class="text-center">
                          <div class="text-h4 text-error">{{ uploadResult.errors?.length || 0 }}</div>
                          <div class="text-body-2">エラー</div>
                        </v-card-text>
                      </v-card>
                    </v-col>
                  </v-row>

                  <div v-if="uploadResult.errors && uploadResult.errors.length > 0" class="mt-4">
                    <h4>エラー詳細:</h4>
                    <ul>
                      <li v-for="error in uploadResult.errors" :key="error" class="text-error">
                        {{ error }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </v-stepper-window-item>
          </v-stepper-window>
        </v-stepper>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="closeDialog"
          :disabled="uploading"
        >
          {{ uploadResult ? '閉じる' : 'キャンセル' }}
        </v-btn>
        
        <v-btn
          v-if="step === 1"
          color="primary"
          :disabled="!selectedFile || !!parseError || parsedData.length === 0 || parsing"
          @click="step = 2"
        >
          次へ
        </v-btn>

        <v-btn
          v-if="step === 2"
          variant="text"
          @click="step = 1"
        >
          戻る
        </v-btn>
        <v-btn
          v-if="step === 2"
          color="primary"
          :disabled="validData.length === 0 || validationErrors.length > 0"
          @click="step = 3"
        >
          確認
        </v-btn>

        <v-btn
          v-if="step === 3 && !uploading && !uploadResult"
          variant="text"
          @click="step = 2"
        >
          戻る
        </v-btn>
        <v-btn
          v-if="step === 3 && !uploading && !uploadResult"
          color="primary"
          :disabled="validData.length === 0"
          @click="executeUpload"
        >
          アップロード実行
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { MarketRateCreateForm, CSVUploadResponse } from '~/types'

interface Props {
  modelValue: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'uploaded', result: CSVUploadResponse): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Dialog control
const dialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Stepper
const step = ref(1)

// File handling
const selectedFile = ref<File | File[] | null>(null)
const downloading = ref(false)
const parsing = ref(false)
const parseError = ref('')

// Parsed data
const parsedData = ref<MarketRateCreateForm[]>([])
const validData = ref<MarketRateCreateForm[]>([])
const duplicates = ref<MarketRateCreateForm[]>([])
const validationErrors = ref<string[]>([])

// UI state
const dataTab = ref('valid')
const uploading = ref(false)
const uploadProgress = ref('')
const uploadResult = ref<CSVUploadResponse | null>(null)

// Data table headers
const dataHeaders = [
  { title: '日付', key: 'timestamp', sortable: true },
  { title: 'BTC価格', key: 'btc_jpy_rate', sortable: true }
]

// File validation rules
const fileRules = [
  (file: File | File[] | null) => {
    if (!file) return 'ファイルを選択してください'
    
    // Handle both single file and file array
    const targetFile = Array.isArray(file) ? file[0] : file
    if (!targetFile) return 'ファイルを選択してください'
    
    if (!targetFile.name.toLowerCase().endsWith('.csv')) {
      return 'CSVファイルを選択してください'
    }
    if (targetFile.size > 5 * 1024 * 1024) { // 5MB limit
      return 'ファイルサイズは5MB以下にしてください'
    }
    return true
  }
]

// Template download
async function downloadTemplate() {
  downloading.value = true
  try {
    // Create template CSV with sample data
    const templateData = [
      ['Date', 'BTC'],
      ['2025/01/01', '14866449'],
      ['2025/01/02', '15330848'],
      ['2025/01/03', '15460228']
    ]
    
    const csvContent = templateData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', 'market_rates_template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    useNotification().showSuccess('テンプレートCSVをダウンロードしました')
  } catch (error) {
    console.error('Template download error:', error)
    useNotification().showError('テンプレートCSVのダウンロードに失敗しました')
  } finally {
    downloading.value = false
  }
}

// File selection handler
async function handleFileSelect() {
  if (!selectedFile.value) {
    resetData()
    return
  }

  // Handle both single file and file array
  const file = Array.isArray(selectedFile.value) ? selectedFile.value[0] : selectedFile.value
  if (!file) {
    resetData()
    return
  }

  parsing.value = true
  parseError.value = ''
  
  try {
    await parseCSVFile(file)
    
    // Auto-advance to next step if parsing was successful
    if (parsedData.value.length > 0 && validationErrors.value.length === 0) {
      // Show success message
      useNotification().showSuccess(`${parsedData.value.length}件のデータを解析しました`)
      
      // Small delay to ensure UI updates
      await nextTick()
      step.value = 2
    }
  } catch (error) {
    console.error('File parsing error:', error)
    parseError.value = 'ファイルの処理中にエラーが発生しました'
  } finally {
    parsing.value = false
  }
}

// CSV parsing
async function parseCSVFile(file: File) {
  parseError.value = ''
  resetData()

  try {
    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      parseError.value = 'CSVファイルにデータがありません'
      return
    }

    // Parse header
    const headerLine = lines[0]
    const headers = headerLine.split(',').map(h => h.trim())
    
    // Validate headers
    const dateColumnIndex = headers.findIndex(h => 
      h.toLowerCase().includes('date') || h.toLowerCase().includes('日付')
    )
    const btcColumnIndex = headers.findIndex(h => 
      h.toLowerCase().includes('btc') || h.toLowerCase().includes('bitcoin')
    )

    if (dateColumnIndex === -1 || btcColumnIndex === -1) {
      parseError.value = 'CSVヘッダーに「Date」と「BTC」列が必要です'
      return
    }

    // Parse data rows
    const tempParsedData: MarketRateCreateForm[] = []
    const tempValidationErrors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const columns = line.split(',').map(c => c.trim())
      
      if (columns.length !== headers.length) {
        tempValidationErrors.push(`行${i + 1}: 列数が一致しません`)
        continue
      }

      const dateStr = columns[dateColumnIndex]
      const btcStr = columns[btcColumnIndex]

      // Validate and parse date
      let timestamp: string
      try {
        // Convert YYYY/MM/DD to ISO format
        const dateParts = dateStr.split('/')
        if (dateParts.length !== 3) {
          throw new Error('Invalid date format')
        }
        const year = parseInt(dateParts[0])
        const month = parseInt(dateParts[1]) - 1 // JavaScript months are 0-based
        const day = parseInt(dateParts[2])
        const date = new Date(year, month, day)
        
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date')
        }
        
        timestamp = date.toISOString()
      } catch (error) {
        tempValidationErrors.push(`行${i + 1}: 日付形式が無効です (${dateStr})`)
        continue
      }

      // Validate and parse BTC rate
      let btc_jpy_rate: number
      try {
        btc_jpy_rate = parseFloat(btcStr.replace(/,/g, ''))
        if (isNaN(btc_jpy_rate) || btc_jpy_rate <= 0) {
          throw new Error('Invalid BTC rate')
        }
      } catch (error) {
        tempValidationErrors.push(`行${i + 1}: BTC価格が無効です (${btcStr})`)
        continue
      }

      tempParsedData.push({
        timestamp,
        btc_jpy_rate
      })
    }

    parsedData.value = tempParsedData
    validationErrors.value = tempValidationErrors

    // Check for duplicates (call API to check existing rates)
    await checkDuplicates()

  } catch (error) {
    console.error('CSV parse error:', error)
    parseError.value = 'CSVファイルの解析に失敗しました'
  }
}

// Check for duplicate rates
async function checkDuplicates() {
  try {
    // Get existing rates to check for duplicates
    const response = await $fetch('/api/market-rates', {
      method: 'GET'
    })

    if (response.success && response.data && response.data.items) {
      const existingTimestamps = new Set(
        response.data.items.map((rate: any) => new Date(rate.timestamp).getTime())
      )

      const tempValidData: MarketRateCreateForm[] = []
      const tempDuplicates: MarketRateCreateForm[] = []

      for (const rate of parsedData.value) {
        const rateTimestamp = new Date(rate.timestamp).getTime()
        if (existingTimestamps.has(rateTimestamp)) {
          tempDuplicates.push(rate)
        } else {
          tempValidData.push(rate)
        }
      }

      validData.value = tempValidData
      duplicates.value = tempDuplicates
    } else {
      // If we can't check duplicates, assume all data is valid
      validData.value = [...parsedData.value]
      duplicates.value = []
    }
  } catch (error) {
    console.error('Duplicate check error:', error)
    // If duplicate check fails, assume all data is valid
    validData.value = [...parsedData.value]
    duplicates.value = []
  }
}

// Upload execution
async function executeUpload() {
  if (validData.value.length === 0) return

  uploading.value = true
  uploadProgress.value = '相場レートをアップロード中...'

  try {
    const response = await $fetch('/api/admin/market-rates', {
      method: 'POST',
      body: {
        rates: validData.value
      }
    })

    uploadResult.value = response
    
    if (response.success) {
      useNotification().showSuccess(`${response.created_count}件の相場レートをアップロードしました`)
      emit('uploaded', response)
    } else {
      useNotification().showError('アップロードに失敗しました')
    }
  } catch (error) {
    console.error('Upload error:', error)
    useNotification().showError('アップロードエラーが発生しました')
    uploadResult.value = {
      success: false,
      created_count: 0,
      duplicates: [],
      errors: ['アップロードエラーが発生しました'],
      message: 'アップロードに失敗しました'
    }
  } finally {
    uploading.value = false
    uploadProgress.value = ''
  }
}

// Reset data
function resetData() {
  parsedData.value = []
  validData.value = []
  duplicates.value = []
  validationErrors.value = []
  uploadResult.value = null
}

// Close dialog
function closeDialog() {
  if (uploading.value) return
  
  dialog.value = false
  
  // Reset form after dialog closes
  nextTick(() => {
    step.value = 1
    selectedFile.value = null
    parseError.value = ''
    resetData()
  })
}

// Notification composable
const { showSuccess, showError } = useNotification()
</script>

<style scoped>
.v-stepper {
  box-shadow: none !important;
}
</style>
