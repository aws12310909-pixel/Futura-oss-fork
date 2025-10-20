<template>
  <v-card>
    <v-card-title class="d-flex align-center justify-space-between">
      <span>実行履歴</span>
      <v-btn
        icon="mdi-refresh"
        variant="text"
        size="small"
        :loading="loading"
        @click="fetchOperations"
      />
    </v-card-title>

    <v-card-text>
      <v-row class="mb-4">
        <v-col cols="12" md="4">
          <v-select
            v-model="statusFilter"
            :items="statusOptions"
            label="ステータスフィルター"
            variant="outlined"
            density="compact"
            hide-details
          />
        </v-col>
      </v-row>

      <v-data-table
        :headers="headers"
        :items="operations"
        :loading="loading"
        :items-per-page="itemsPerPage"
        hide-default-footer
        class="elevation-1"
      >
        <template #item.batch_id="{ item }">
          <span class="text-caption font-mono">{{ item.batch_id.substring(0, 8) }}...</span>
        </template>

        <template #item.created_at="{ item }">
          <span class="text-body-2">{{ formatDate(item.created_at) }}</span>
        </template>

        <template #item.adjustment_rate="{ item }">
          <v-chip
            :color="item.adjustment_rate > 0 ? 'success' : 'error'"
            size="small"
            variant="tonal"
          >
            {{ formatRate(item.adjustment_rate) }}
          </v-chip>
        </template>

        <template #item.target_user_count="{ item }">
          <span>{{ item.target_user_count }}</span>
        </template>

        <template #item.processed_user_count="{ item }">
          <span class="text-success">{{ item.processed_user_count }}</span>
        </template>

        <template #item.failed_user_count="{ item }">
          <span v-if="item.failed_user_count > 0" class="text-error">
            {{ item.failed_user_count }}
          </span>
          <span v-else class="text-medium-emphasis">0</span>
        </template>

        <template #item.status="{ item }">
          <v-chip
            :color="getStatusColor(item.status)"
            size="small"
            variant="tonal"
          >
            {{ getStatusLabel(item.status) }}
          </v-chip>
        </template>

        <template #item.actions="{ item }">
          <v-btn
            icon="mdi-eye"
            variant="text"
            size="small"
            @click="emit('viewDetail', item.batch_id)"
          />
        </template>

        <template #no-data>
          <div class="text-center pa-4">
            <v-icon size="48" color="grey-lighten-1">mdi-inbox</v-icon>
            <div class="text-body-1 text-medium-emphasis mt-2">
              履歴がありません
            </div>
          </div>
        </template>
      </v-data-table>

      <div v-if="total > 0" class="d-flex justify-center mt-4">
        <v-pagination
          v-model="page"
          :length="pageCount"
          :total-visible="7"
        />
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { BatchOperation, PaginatedResponse } from '~/types'
import { BATCH_OPERATION_STATUS } from '~/types'

const emit = defineEmits<{
  viewDetail: [batchId: string]
}>()

const apiClient = useApiClient()

// State
const operations = ref<BatchOperation[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const itemsPerPage = ref(10)
const statusFilter = ref<string>('')

// Fetch operations
async function fetchOperations() {
  loading.value = true

  try {
    const offset = (page.value - 1) * itemsPerPage.value
    const params: Record<string, any> = {
      limit: itemsPerPage.value,
      offset
    }

    if (statusFilter.value) {
      params.status = statusFilter.value
    }

    const response = await apiClient.get<PaginatedResponse<BatchOperation>>(
      '/api/admin/batch-operations',
      { params }
    )

    if (response.success && response.data) {
      operations.value = response.data.items
      total.value = response.data.total
    }
  } catch (error) {
    console.error('一括処理履歴取得エラー:', error)
  } finally {
    loading.value = false
  }
}

// Watch for changes
watch([page, itemsPerPage, statusFilter], () => {
  fetchOperations()
})

// Initial fetch
onMounted(() => {
  fetchOperations()
})

// Computed
const pageCount = computed(() => Math.ceil(total.value / itemsPerPage.value))

// Status color
function getStatusColor(status: string): string {
  switch (status) {
    case BATCH_OPERATION_STATUS.COMPLETED:
      return 'success'
    case BATCH_OPERATION_STATUS.PROCESSING:
      return 'info'
    case BATCH_OPERATION_STATUS.FAILED:
      return 'error'
    case BATCH_OPERATION_STATUS.PENDING:
      return 'warning'
    case BATCH_OPERATION_STATUS.CANCELLED:
      return 'grey'
    default:
      return 'grey'
  }
}

// Status label
function getStatusLabel(status: string): string {
  switch (status) {
    case BATCH_OPERATION_STATUS.COMPLETED:
      return '完了'
    case BATCH_OPERATION_STATUS.PROCESSING:
      return '処理中'
    case BATCH_OPERATION_STATUS.FAILED:
      return '失敗'
    case BATCH_OPERATION_STATUS.PENDING:
      return '待機中'
    case BATCH_OPERATION_STATUS.CANCELLED:
      return 'キャンセル'
    default:
      return status
  }
}

// Format date
function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Format rate
function formatRate(rate: number): string {
  return `${rate > 0 ? '+' : ''}${rate}%`
}

// Table headers
const headers = [
  { title: 'バッチID', key: 'batch_id', sortable: false },
  { title: '実行日時', key: 'created_at', sortable: false },
  { title: '増減率', key: 'adjustment_rate', sortable: false },
  { title: '対象数', key: 'target_user_count', sortable: false },
  { title: '成功数', key: 'processed_user_count', sortable: false },
  { title: '失敗数', key: 'failed_user_count', sortable: false },
  { title: 'ステータス', key: 'status', sortable: false },
  { title: 'アクション', key: 'actions', sortable: false }
]

// Status options
const statusOptions = [
  { value: '', title: 'すべて' },
  { value: BATCH_OPERATION_STATUS.COMPLETED, title: '完了' },
  { value: BATCH_OPERATION_STATUS.PROCESSING, title: '処理中' },
  { value: BATCH_OPERATION_STATUS.FAILED, title: '失敗' },
  { value: BATCH_OPERATION_STATUS.PENDING, title: '待機中' },
  { value: BATCH_OPERATION_STATUS.CANCELLED, title: 'キャンセル' }
]

// Define refresh function for parent component
defineExpose({
  refresh: fetchOperations
})
</script>

<style scoped>
.font-mono {
  font-family: monospace;
}
</style>
