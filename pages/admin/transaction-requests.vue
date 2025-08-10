<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
              <h1 class="text-2xl font-bold text-gray-900 mb-2">入出金リクエスト承認</h1>
      <p class="text-gray-600">ユーザーからの入出金リクエストを確認し、承認・拒否を行います</p>
      </div>
      <button
        class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        @click="loadRequests"
      >
        <Icon name="mdi:refresh" class="mr-2" />
        更新
      </button>
    </div>

    <!-- Status Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <v-card class="card-shadow">
        <v-card-text class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-gray-600">承認待ち</h3>
            <Icon name="mdi:clock-outline" class="text-2xl text-orange-500" />
          </div>
          <p class="text-2xl font-bold text-orange-600">{{ pendingCount }}</p>
        </v-card-text>
      </v-card>

      <v-card class="card-shadow">
        <v-card-text class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-gray-600">今日の承認</h3>
            <Icon name="mdi:check-circle" class="text-2xl text-green-500" />
          </div>
          <p class="text-2xl font-bold text-green-600">{{ todayApprovedCount }}</p>
        </v-card-text>
      </v-card>

      <v-card class="card-shadow">
        <v-card-text class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-gray-600">今日の拒否</h3>
            <Icon name="mdi:close-circle" class="text-2xl text-red-500" />
          </div>
          <p class="text-2xl font-bold text-red-600">{{ todayRejectedCount }}</p>
        </v-card-text>
      </v-card>
    </div>

    <!-- Filters -->
    <v-card class="mb-6">
      <v-card-text class="py-4">
        <div class="flex items-center space-x-4 flex-wrap gap-y-2">
          <v-select
            v-model="selectedStatus"
            :items="statusOptions"
            label="ステータス"
            variant="outlined"
            density="compact"
            class="w-48"
            @update:model-value="loadRequests"
          />
          <div class="flex-1"/>
          <span class="text-sm text-gray-500">
            {{ totalCount }}件中 {{ requests.length }}件を表示
          </span>
        </div>
      </v-card-text>
    </v-card>

    <!-- Requests Table -->
    <v-card class="card-shadow">
      <v-card-text class="p-0">
        <div v-if="loading" class="flex items-center justify-center py-12">
          <v-progress-circular indeterminate color="primary" />
        </div>
        
        <div v-else-if="requests.length === 0" class="text-center py-12">
          <Icon name="mdi:inbox" class="text-4xl text-gray-400 mb-4" />
          <p class="text-gray-500">{{ selectedStatus === 'pending' ? '承認待ちのリクエストはありません' : 'リクエストがありません' }}</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ユーザー
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  金額
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  理由
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  リクエスト日時
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  アクション
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr
                v-for="request in requests"
                :key="request.transaction_id"
                class="hover:bg-gray-50"
              >
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div>
                      <div class="text-sm font-medium text-gray-900">
                        {{ request.user_name }}
                      </div>
                      <div class="text-sm text-gray-500">
                        {{ request.user_email }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-mono text-gray-900">
                    {{ formatBTC(request.amount) }} BTC
                  </div>
                  <div class="text-sm text-gray-500">
                    ¥{{ formatCurrency(request.amount * currentRate) }}
                  </div>
                </td>
                <td class="px-6 py-4">
                  <div class="text-sm text-gray-900 max-w-xs truncate" :title="request.reason">
                    {{ request.reason }}
                  </div>
                  <div v-if="request.memo" class="text-sm text-gray-500 max-w-xs truncate" :title="request.memo">
                    メモ: {{ request.memo }}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ formatDateTime(request.requested_at) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <CommonStatusBadge :status="request.status" />
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <div v-if="request.status === 'pending'" class="flex space-x-2">
                    <button
                      class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                      @click="approveRequest(request)"
                    >
                      承認
                    </button>
                    <button
                      class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                      @click="showRejectDialog(request)"
                    >
                      拒否
                    </button>
                  </div>
                  <div v-else class="text-gray-500">
                    {{ request.status === 'approved' ? '承認済み' : '拒否済み' }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </v-card-text>
    </v-card>

    <!-- Pagination -->
    <div v-if="totalCount > limit" class="mt-6 flex justify-center">
      <div class="flex items-center space-x-2">
        <button
          class="px-3 py-1 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="page <= 1"
          @click="changePage(page - 1)"
        >
          前へ
        </button>
        <span class="text-sm text-gray-600">
          {{ page }} / {{ Math.ceil(totalCount / limit) }}
        </span>
        <button
          class="px-3 py-1 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!hasMore"
          @click="changePage(page + 1)"
        >
          次へ
        </button>
      </div>
    </div>

    <!-- Reject Dialog -->
    <AdminTransactionRejectDialog
      v-model="showRejectDialogState"
      :request="selectedRequest"
      @request-processed="onRequestProcessed"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { PaginatedResponse } from '~/types'
import { TRANSACTION_STATUS } from '~/types'

const logger = useLogger({ prefix: '[ADMIN-TRANSACTION-REQUESTS]' })
const apiClient = useApiClient()

definePageMeta({
  middleware: 'auth',
  layout: 'default'
})

useHead({
      title: '入出金リクエスト承認 - BTC Mock App Admin'
})

interface EnhancedTransactionRequest {
  transaction_id: string
  user_id: string
  user_name: string
  user_email: string
  amount: number
  transaction_type: 'deposit'
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  processed_at?: string
  processed_by?: string
  memo: string
  reason: string
  rejection_reason?: string
}

// State
const requests = ref<EnhancedTransactionRequest[]>([])
const loading = ref(false)
const selectedStatus = ref('pending')
const page = ref(1)
const limit = ref(20)
const totalCount = ref(0)
const hasMore = ref(false)
const currentRate = ref(0)
const showRejectDialogState = ref(false)
const selectedRequest = ref<EnhancedTransactionRequest | null>(null)

// Status options
const statusOptions = [
  { title: '承認待ち', value: 'pending' },
  { title: '承認済み', value: 'approved' },
  { title: '拒否済み', value: 'rejected' }
]

// Computed
const pendingCount = computed(() => {
  return requests.value.filter(r => r.status === TRANSACTION_STATUS.PENDING).length
})

const todayApprovedCount = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  return requests.value.filter(r => 
    r.status === TRANSACTION_STATUS.APPROVED && 
    r.processed_at?.startsWith(today)
  ).length
})

const todayRejectedCount = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  return requests.value.filter(r => 
    r.status === TRANSACTION_STATUS.REJECTED && 
    r.processed_at?.startsWith(today)
  ).length
})

// Methods
const loadRequests = async () => {
  loading.value = true
  try {
    const response = await apiClient.get<PaginatedResponse<EnhancedTransactionRequest>>('/admin/transaction-requests', {
      params: {
        status: selectedStatus.value,
        page: page.value,
        limit: limit.value
      }
    })

    requests.value = response.data!.items
    totalCount.value = response.data!.total
    hasMore.value = response.data!.hasMore
  } catch (error: any) {
    logger.error('リクエスト取得エラー:', error)
    useNotification().showError(error?.data?.message || 'リクエストの取得に失敗しました')
  } finally {
    loading.value = false
  }
}

const changePage = (newPage: number) => {
  page.value = newPage
  loadRequests()
}

const approveRequest = async (request: EnhancedTransactionRequest) => {
  try {
    const response = await apiClient.patch(`/admin/transactions/${request.transaction_id}/status`, {
      status: TRANSACTION_STATUS.APPROVED
    })

            useNotification().showSuccess(`${request.user_name}さんの${request.transaction_type === 'deposit' ? '入金' : '出金'}リクエストを承認しました`)

    loadRequests()
  } catch (error: any) {
    logger.error('承認エラー:', error)
    useNotification().showError(error?.data?.message || '承認処理に失敗しました')
  }
}

const showRejectDialog = (request: EnhancedTransactionRequest) => {
  selectedRequest.value = request
  showRejectDialogState.value = true
}

const onRequestProcessed = () => {
  loadRequests()
}

// Utility functions
const formatBTC = (amount: number) => {
  return amount.toFixed(8)
}

const formatCurrency = (value: number) => {
  return Math.round(value).toLocaleString('ja-JP')
}

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Load current rate
const loadCurrentRate = async () => {
  try {
    const response = await apiClient.get<any>('/market-rates/latest')
    currentRate.value = response.data!.btc_jpy_rate
  } catch (error) {
    logger.error('レート取得エラー:', error)
  }
}

onMounted(() => {
  loadRequests()
  loadCurrentRate()
})
</script>