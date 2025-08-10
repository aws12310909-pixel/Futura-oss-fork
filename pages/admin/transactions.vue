<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2">入出金管理</h1>
        <p class="text-gray-600">ユーザーの入出金を管理し、残高を調整します</p>
      </div>
      <v-btn
        color="primary"
                  prepend-icon="mdi-plus"
        @click="showCreateDialog = true"
      >
        新しい取引を追加
      </v-btn>
    </div>

    <!-- Filters -->
    <v-card class="mb-6">
      <v-card-text class="py-4">
        <div class="flex items-center space-x-4 flex-wrap gap-y-2">
          <v-select
            v-model="selectedUser"
            :items="userOptions"
            label="ユーザー"
            variant="outlined"
            density="compact"
            clearable
            class="w-64"
          />
          <v-select
            v-model="selectedTransactionType"
            :items="transactionTypeOptions"
            label="取引種別"
            variant="outlined"
            density="compact"
            class="w-48"
          />
          <v-select
            v-model="selectedStatus"
            :items="statusOptions"
            label="承認状態"
            variant="outlined"
            density="compact"
            class="w-48"
          />
          <v-btn
            variant="outlined"
            prepend-icon="mdi-refresh"
            @click="loadTransactions"
          >
            更新
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
      <!-- 承認済み取引 -->
      <v-card class="card-shadow">
        <v-card-text class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-gray-600">今日の承認済み取引</h3>
            <Icon name="mdi:check-circle" class="text-2xl text-blue-500" />
          </div>
          <p class="text-2xl font-bold text-gray-900">{{ todayApprovedCount }}</p>
          <p class="text-xs text-gray-500 mt-1">全体: {{ todayTransactionCount }}</p>
        </v-card-text>
      </v-card>

      <v-card class="card-shadow">
        <v-card-text class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-gray-600">今日の入金総額</h3>
            <Icon name="mdi:plus-circle" class="text-2xl text-green-500" />
          </div>
          <p class="text-2xl font-bold text-green-600">{{ todayApprovedDepositTotal }} BTC</p>
          <p class="text-xs text-gray-500 mt-1">全体: {{ todayDepositTotal }} BTC</p>
        </v-card-text>
      </v-card>

      <v-card class="card-shadow">
        <v-card-text class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-gray-600">今日の出金総額</h3>
            <Icon name="mdi:minus-circle" class="text-2xl text-red-500" />
          </div>
          <p class="text-2xl font-bold text-red-600">{{ todayApprovedWithdrawalTotal }} BTC</p>
          <p class="text-xs text-gray-500 mt-1">全体: {{ todayWithdrawalTotal }} BTC</p>
        </v-card-text>
      </v-card>

      <v-card class="card-shadow">
        <v-card-text class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-gray-600">承認待ち取引</h3>
            <Icon name="mdi:clock-outline" class="text-2xl text-orange-500" />
          </div>
          <p class="text-2xl font-bold text-orange-600">{{ pendingTransactionCount }}</p>
          <p class="text-xs text-gray-500 mt-1">総: {{ totalTransactions }}</p>
        </v-card-text>
      </v-card>
    </div>

    <!-- Transactions Table -->
    <v-card>
      <v-card-title class="px-6 py-4 border-b">
        <h3 class="text-lg font-semibold text-gray-900">取引履歴</h3>
      </v-card-title>

      <v-data-table
        :headers="headers"
        :items="filteredTransactions"
        :loading="loading"
        :items-per-page="20"
        class="elevation-0"
        no-data-text="取引履歴がありません"
        loading-text="読み込み中..."
      >
        <template #[`item.transaction_type`]="{ item }">
          <div class="flex gap-1.5">
            <v-chip
              :color="getTransactionTypeColor(item)"
              size="small"
              variant="flat"
              class="justify-start"
            >
              <Icon 
                :name="item.transaction_type === 'deposit' ? 'mdi:plus' : 'mdi:minus'" 
                class="mr-1.5 w-3.5 h-3.5" 
              />
              {{ item.transaction_type === 'deposit' ? '入金' : '出金' }}
            </v-chip>
            <v-chip
              :color="getStatusColor(item.status)"
              size="small"
              variant="outlined"
              class="justify-start"
            >
              <Icon 
                :name="getStatusIcon(item.status)" 
                class="mr-1.5 w-3.5 h-3.5" 
              />
              {{ getStatusText(item.status) }}
            </v-chip>
          </div>
        </template>

        <template #[`item.amount`]="{ item }">
          <span 
            class="font-mono font-semibold"
            :class="item.transaction_type === 'deposit' ? 'text-green-600' : 'text-red-600'"
          >
            {{ item.transaction_type === 'deposit' ? '+' : '-' }}{{ item.amount }} BTC
          </span>
        </template>

        <template #[`item.user_name`]="{ item }">
          <div>
            <p class="font-medium">{{ item.user_name }}</p>
            <p class="text-sm text-gray-500">{{ item.user_email }}</p>
          </div>
        </template>

        <template #[`item.timestamp`]="{ item }">
          {{ formatDate(item.timestamp) }}
        </template>

        <template #[`item.memo`]="{ item }">
          <div class="max-w-xs">
            <p class="truncate" :title="item.memo">{{ item.memo }}</p>
            <p class="text-xs text-gray-500 truncate" :title="item.reason">{{ item.reason }}</p>
          </div>
        </template>

        <template #[`item.actions`]="{ item }">
          <v-btn
            size="small"
            variant="text"
            color="info"
                          icon="mdi-eye"
            @click="viewTransactionDetails(item)"
          />
        </template>
      </v-data-table>
    </v-card>

    <!-- Create Transaction Dialog -->
    <AdminCreateTransactionDialog
      v-model="showCreateDialog"
      :users="users"
      @created="handleTransactionCreated"
    />

    <!-- Transaction Details Dialog -->
    <AdminTransactionDetailsDialog
      v-model="showDetailsDialog"
      :transaction="selectedTransaction"
    />
  </div>
</template>

<script setup lang="ts">
import type { Transaction, User } from '~/types'

definePageMeta({
  middleware: 'auth',
  requireAdmin: true,
  layout: 'default'
})

useHead({
  title: '入出金管理 - BTC Mock App'
})

const logger = useLogger({ prefix: '[AdminTransactions]' })
const { showSuccess: _showSuccess, showError } = useNotification()
const apiClient = useApiClient()

// State
const transactions = ref<(Transaction & { user_name: string; user_email: string })[]>([])
const users = ref<User[]>([])
const loading = ref(false)
const selectedUser = ref('')
const selectedTransactionType = ref('all')
const selectedStatus = ref('all')
const showCreateDialog = ref(false)
const showDetailsDialog = ref(false)
const selectedTransaction = ref<Transaction | null>(null)

// Options
const transactionTypeOptions = [
  { title: 'すべて', value: 'all' },
  { title: '入金', value: 'deposit' },
  { title: '出金', value: 'withdrawal' }
]

const statusOptions = [
  { title: 'すべて', value: 'all' },
  { title: '承認済み', value: 'approved' },
  { title: '承認待ち', value: 'pending' },
  { title: '拒否済み', value: 'rejected' }
]

const userOptions = computed(() => 
  users.value.map(user => ({
    title: `${user.name} (${user.email})`,
    value: user.user_id
  }))
)

// Table headers
const headers = [
  { title: '日時', key: 'timestamp', sortable: true },
  { title: 'ユーザー', key: 'user_name', sortable: true },
  { title: '種別', key: 'transaction_type', sortable: true },
  { title: '金額', key: 'amount', sortable: true },
  { title: 'メモ/理由', key: 'memo', sortable: false },
  { title: 'アクション', key: 'actions', sortable: false, width: 100 }
]

// Computed
const filteredTransactions = computed(() => {
  let filtered = transactions.value

  if (selectedUser.value) {
    filtered = filtered.filter(t => t.user_id === selectedUser.value)
  }

  if (selectedTransactionType.value !== 'all') {
    filtered = filtered.filter(t => t.transaction_type === selectedTransactionType.value)
  }

  if (selectedStatus.value !== 'all') {
    filtered = filtered.filter(t => {
      const status = t.status || 'approved' // statusが未設定の場合は承認済みとして扱う
      return status === selectedStatus.value
    })
  }

  return filtered
})

// Helper function to determine if transaction is approved
const isApprovedTransaction = (transaction: Transaction): boolean => {
  return !transaction.status || transaction.status === 'approved'
}

// 全体統計（承認待ち含む）
const todayTransactionCount = computed(() => {
  const today = new Date().toDateString()
  return transactions.value.filter(t => 
    new Date(t.timestamp).toDateString() === today
  ).length
})

const todayDepositTotal = computed(() => {
  const today = new Date().toDateString()
  return transactions.value
    .filter(t => new Date(t.timestamp).toDateString() === today && t.transaction_type === 'deposit')
    .reduce((sum, t) => sum + t.amount, 0)
})

const todayWithdrawalTotal = computed(() => {
  const today = new Date().toDateString()
  return transactions.value
    .filter(t => new Date(t.timestamp).toDateString() === today && t.transaction_type === 'withdrawal')
    .reduce((sum, t) => sum + t.amount, 0)
})

const totalTransactions = computed(() => transactions.value.length)

// 承認済み統計
const todayApprovedCount = computed(() => {
  const today = new Date().toDateString()
  return transactions.value.filter(t => 
    new Date(t.timestamp).toDateString() === today && isApprovedTransaction(t)
  ).length
})

const todayApprovedDepositTotal = computed(() => {
  const today = new Date().toDateString()
  return transactions.value
    .filter(t => 
      new Date(t.timestamp).toDateString() === today && 
      t.transaction_type === 'deposit' && 
      isApprovedTransaction(t)
    )
    .reduce((sum, t) => sum + t.amount, 0)
})

const todayApprovedWithdrawalTotal = computed(() => {
  const today = new Date().toDateString()
  return transactions.value
    .filter(t => 
      new Date(t.timestamp).toDateString() === today && 
      t.transaction_type === 'withdrawal' && 
      isApprovedTransaction(t)
    )
    .reduce((sum, t) => sum + t.amount, 0)
})

const pendingTransactionCount = computed(() => {
  return transactions.value.filter(t => t.status === 'pending').length
})

// Methods
const loadTransactions = async () => {
  loading.value = true
  try {
    const response = await apiClient.get<{ items: (Transaction & { user_name: string; user_email: string })[] }>('/admin/transactions')
    transactions.value = response.data!.items
  } catch (error) {
    logger.error('取引履歴の読み込みに失敗しました:', error)
    showError('取引履歴の取得に失敗しました')
  } finally {
    loading.value = false
  }
}

const loadUsers = async () => {
  try {
    const response = await apiClient.get<{ items: User[] }>('/admin/users')
    users.value = response.data!.items.filter(user => user.status !== 'deleted')
  } catch (error) {
    logger.error('ユーザー一覧の読み込みに失敗しました:', error)
    showError('ユーザー一覧の取得に失敗しました')
  }
}

const handleTransactionCreated = () => {
  showCreateDialog.value = false
  loadTransactions()
}

const viewTransactionDetails = (transaction: Transaction) => {
  selectedTransaction.value = transaction
  showDetailsDialog.value = true
}

// Utility functions
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getTransactionTypeColor = (transaction: Transaction) => {
  if (transaction.status === 'pending') {
    return transaction.transaction_type === 'deposit' ? 'orange' : 'deep-orange'
  }
  if (transaction.status === 'rejected') {
    return 'grey'
  }
  return transaction.transaction_type === 'deposit' ? 'success' : 'error'
}

const getStatusColor = (status?: string) => {
  const statusValue = status || 'approved'
  switch (statusValue) {
    case 'approved':
      return 'success'
    case 'pending':
      return 'warning'
    case 'rejected':
      return 'error'
    default:
      return 'info'
  }
}

const getStatusIcon = (status?: string) => {
  const statusValue = status || 'approved'
  switch (statusValue) {
    case 'approved':
      return 'mdi:check-circle'
    case 'pending':
      return 'mdi:clock-outline'
    case 'rejected':
      return 'mdi:close-circle'
    default:
      return 'mdi:help-circle'
  }
}

const getStatusText = (status?: string) => {
  const statusValue = status || 'approved'
  switch (statusValue) {
    case 'approved':
      return '承認済み'
    case 'pending':
      return '承認待ち'
    case 'rejected':
      return '拒否済み'
    default:
      return '不明'
  }
}

// Load data on mount
onMounted(async () => {
  await Promise.all([
    loadTransactions(),
    loadUsers()
  ])
})
</script>