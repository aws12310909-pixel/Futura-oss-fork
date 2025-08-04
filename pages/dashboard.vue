<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2">ダッシュボード</h1>
        <p class="text-gray-600">BTCポートフォリオの概要</p>
      </div>
      <v-btn
        variant="outlined"
                  prepend-icon="mdi-refresh"
        :loading="loading"
        @click="loadDashboardData"
      >
        更新
      </v-btn>
    </div>

    <!-- Price Chart - Full Width -->
    <div class="mb-8">
      <v-card class="card-shadow">
        <v-card-title class="px-6 py-4 border-b">
          <h3 class="text-lg font-semibold text-gray-900">残高推移（30日間）</h3>
        </v-card-title>
        <v-card-text class="p-6">
          <div v-if="dashboardData?.balanceHistory.length" class="h-80">
            <UserBalanceChart :data="dashboardData.balanceHistory" />
          </div>
          <div v-else class="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
            <div class="text-center">
              <Icon name="mdi:chart-line" class="text-4xl text-gray-400 mb-2" />
              <p class="text-gray-500">チャートデータがありません</p>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </div>

    <!-- Dashboard Cards - 2x2 Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-8">
      <!-- Balance Card -->
      <v-card class="card-shadow">
        <v-card-text class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-gray-600">現在の残高</h3>
            <Icon name="mdi:bitcoin" class="text-2xl text-primary-500" />
          </div>
          <div class="space-y-1">
            <p class="text-2xl font-bold text-gray-900 font-mono">
              {{ formatBTC(dashboardData?.currentBalance || 0) }} BTC
            </p>
            <p class="text-sm text-gray-500">
              ¥{{ formatNumber(dashboardData?.currentValue || 0) }}
            </p>
          </div>
          <!-- Request Button -->
          <div class="mt-4">
            <NuxtLink 
              to="/transaction-requests"
              class="block w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-center"
              :class="{ 'bg-gray-400 cursor-not-allowed': hasPermission('transaction:request') === false }"
            >
              入出金リクエスト
            </NuxtLink>
          </div>
        </v-card-text>
      </v-card>

      <!-- Asset Value Card -->
      <v-card class="card-shadow">
        <v-card-text class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-gray-600">資産価値</h3>
            <Icon name="mdi:chart-line" class="text-2xl text-green-500" />
          </div>
          <div class="space-y-1">
            <p class="text-2xl font-bold text-gray-900">
              ¥{{ formatNumber(dashboardData?.currentValue || 0) }}
            </p>
            <p class="text-sm" :class="valueChangeClass">
              {{ valueChangeText }}
            </p>
          </div>
        </v-card-text>
      </v-card>

      <!-- Current Rate Card -->
      <v-card class="card-shadow">
        <v-card-text class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-gray-600">現在レート</h3>
            <Icon name="mdi:currency-jpy" class="text-2xl text-blue-500" />
          </div>
          <div class="space-y-1">
            <p class="text-2xl font-bold text-gray-900">
              ¥{{ formatNumber(currentRate) }}
            </p>
            <p class="text-sm text-gray-500">1 BTC</p>
          </div>
        </v-card-text>
      </v-card>

      <!-- Transactions Card -->
      <v-card class="card-shadow">
        <v-card-text class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-gray-600">今月の取引</h3>
            <Icon name="mdi:swap-horizontal" class="text-2xl text-purple-500" />
          </div>
          <div class="space-y-1">
            <p class="text-2xl font-bold text-gray-900">{{ monthlyTransactionCount }}</p>
            <p class="text-sm text-gray-500">件</p>
          </div>
        </v-card-text>
      </v-card>
    </div>

    <!-- Recent Transactions - Full Width -->
    <div class="mb-8">
      <v-card class="card-shadow">
        <v-card-title class="px-6 py-4 border-b flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900">最近の取引</h3>
          <v-btn variant="text" color="primary" size="small" to="/transactions">
            すべて見る
          </v-btn>
        </v-card-title>
        <v-card-text class="p-6">
          <div v-if="dashboardData?.recentTransactions.length" class="space-y-4">
            <div
              v-for="transaction in dashboardData.recentTransactions"
              :key="transaction.transaction_id"
              class="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0"
            >
              <div class="flex items-center space-x-3">
                <v-chip
                  :color="transaction.transaction_type === 'deposit' ? 'success' : 'error'"
                  size="small"
                  variant="flat"
                >
                  <Icon 
                    :name="transaction.transaction_type === 'deposit' ? 'mdi:plus' : 'mdi:minus'" 
                    class="mr-1" 
                  />
                  {{ transaction.transaction_type === 'deposit' ? '入金' : '出金' }}
                </v-chip>
                <div>
                  <p class="text-sm font-medium">{{ transaction.memo }}</p>
                  <p class="text-xs text-gray-500">{{ formatDate(transaction.timestamp) }}</p>
                </div>
              </div>
              <div class="text-right">
                <p 
                  class="font-mono font-semibold"
                  :class="transaction.transaction_type === 'deposit' ? 'text-green-600' : 'text-red-600'"
                >
                  {{ transaction.transaction_type === 'deposit' ? '+' : '-' }}{{ formatBTC(transaction.amount) }} BTC
                </p>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-8">
            <Icon name="mdi:history" class="text-4xl text-gray-400 mb-2" />
            <p class="text-gray-500">取引履歴がありません</p>
          </div>
        </v-card-text>
      </v-card>
    </div>


  </div>
</template>

<script setup lang="ts">
import type { DashboardData } from '~/types'

const logger = useLogger({ prefix: '[PAGE-DASHBOARD]' })

definePageMeta({
  middleware: 'auth'
})

useHead({
  title: 'ダッシュボード - BTC Mock App'
})

const { showError } = useNotification()

// State
const dashboardData = ref<DashboardData | null>(null)
const loading = ref(false)

// Computed
const currentRate = computed(() => {
  if (!dashboardData.value?.balanceHistory.length) return 0
  const latest = dashboardData.value.balanceHistory[dashboardData.value.balanceHistory.length - 1]
  return latest.btc_rate
})

const valueChangeText = computed(() => {
  if (!dashboardData.value?.balanceHistory.length || dashboardData.value.balanceHistory.length < 2) {
    return '+0.00%'
  }
  
  const history = dashboardData.value.balanceHistory
  const current = history[history.length - 1].jpy_value
  const previous = history[history.length - 2].jpy_value
  
  if (previous === 0) return '+0.00%'
  
  const change = ((current - previous) / previous) * 100
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(2)}%`
})

const valueChangeClass = computed(() => {
  const text = valueChangeText.value
  if (text.startsWith('+')) return 'text-green-600'
  if (text.startsWith('-')) return 'text-red-600'
  return 'text-gray-600'
})

const monthlyTransactionCount = computed(() => {
  if (!dashboardData.value?.recentTransactions.length) return 0
  
  const thisMonth = new Date()
  thisMonth.setDate(1)
  thisMonth.setHours(0, 0, 0, 0)
  
  return dashboardData.value.recentTransactions.filter(t => 
    new Date(t.timestamp) >= thisMonth
  ).length
})

// Methods
const loadDashboardData = async () => {
  loading.value = true
  try {
    const { data } = await $fetch<{ success: boolean; data: DashboardData }>('/api/dashboard')
    dashboardData.value = data
  } catch (error) {
    logger.error('ダッシュボードデータの読み込みに失敗しました:', error)
    showError('ダッシュボードデータの取得に失敗しました')
  } finally {
    loading.value = false
  }
}

// Permission check
const hasPermission = (permission: string) => {
  const { user } = useAuth()
  return user.value?.permissions?.includes(permission)
}



// Utility functions
const formatBTC = (amount: number) => {
  return amount.toFixed(8)
}

const formatNumber = (number: number) => {
  return number.toLocaleString('ja-JP')
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Load data on mount
onMounted(() => {
  loadDashboardData()
})
</script>