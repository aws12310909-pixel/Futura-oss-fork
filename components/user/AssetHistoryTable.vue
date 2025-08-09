<template>
  <div class="bg-white rounded-lg">
    <!-- Header with filters -->
    <div class="flex items-center justify-between p-4 border-b">
      <h3 class="text-lg font-semibold text-gray-900">資産推移詳細</h3>
      <div class="flex items-center space-x-2">
        <v-select
          v-model="dateRange"
          :items="dateRangeOptions"
          item-title="label"
          item-value="value"
          variant="outlined"
          density="compact"
          class="w-32"
          hide-details
        />
        <v-btn
          variant="outlined"
          size="small"
          prepend-icon="mdi-download"
          @click="exportToCSV"
        >
          CSV出力
        </v-btn>
      </div>
    </div>

    <!-- Table -->
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              日付
            </th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              BTC残高
            </th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              BTC価格
            </th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              資産価値(JPY)
            </th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              前日比較
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr
            v-for="(item, index) in filteredData"
            :key="item.date"
            class="hover:bg-gray-50"
          >
            <td class="px-4 py-3 text-sm text-gray-900">
              <div>
                <div class="font-medium">{{ formatDate(item.date) }}</div>
                <div class="text-xs text-gray-500">{{ formatDayOfWeek(item.date) }}</div>
              </div>
            </td>
            <td class="px-4 py-3 text-sm text-gray-900 text-right font-mono">
              {{ formatBTC(item.btc_amount) }} BTC
            </td>
            <td class="px-4 py-3 text-sm text-gray-900 text-right">
              ¥{{ formatNumber(item.btc_rate) }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
              ¥{{ formatNumber(item.jpy_value) }}
            </td>
            <td class="px-4 py-3 text-sm text-right">
              <div v-if="index > 0" class="flex items-center justify-end space-x-1">
                <Icon
                  :name="getChangeIcon(item, filteredData[index - 1])"
                  :class="getChangeColor(item, filteredData[index - 1])"
                  class="text-sm"
                />
                <span :class="getChangeColor(item, filteredData[index - 1])">
                  {{ getChangeText(item, filteredData[index - 1]) }}
                </span>
              </div>
              <div v-else class="text-gray-400 text-xs">
                -
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer with pagination if needed -->
    <div v-if="data.length > itemsPerPage" class="p-4 border-t">
      <div class="flex items-center justify-between">
        <div class="text-sm text-gray-700">
          {{ (currentPage - 1) * itemsPerPage + 1 }}-{{ Math.min(currentPage * itemsPerPage, filteredData.length) }} 
          of {{ filteredData.length }} 件を表示
        </div>
        <div class="flex items-center space-x-2">
          <v-btn
            variant="outlined"
            size="small"
            :disabled="currentPage === 1"
            @click="currentPage--"
          >
            前へ
          </v-btn>
          <span class="text-sm text-gray-700">
            {{ currentPage }} / {{ totalPages }}
          </span>
          <v-btn
            variant="outlined"
            size="small"
            :disabled="currentPage === totalPages"
            @click="currentPage++"
          >
            次へ
          </v-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BalanceHistoryItem } from '~/types'

interface Props {
  data: BalanceHistoryItem[]
}

const props = defineProps<Props>()

// State
const dateRange = ref('30')
const currentPage = ref(1)
const itemsPerPage = 10

// Options
const dateRangeOptions = [
  { label: '7日間', value: '7' },
  { label: '30日間', value: '30' },
  { label: '全期間', value: 'all' }
]

// Computed
const filteredData = computed(() => {
  let filtered = [...props.data]
  
  if (dateRange.value !== 'all') {
    const days = parseInt(dateRange.value)
    filtered = filtered.slice(-days)
  }
  
  // Sort by date ascending for table display
  filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  
  // Apply pagination
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filtered.slice(start, end)
})

const totalPages = computed(() => {
  const totalItems = dateRange.value === 'all' 
    ? props.data.length 
    : Math.min(props.data.length, parseInt(dateRange.value))
  return Math.ceil(totalItems / itemsPerPage)
})

// Methods
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

const formatDayOfWeek = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ja-JP', {
    weekday: 'short'
  })
}

const formatBTC = (amount: number) => {
  return amount.toFixed(8)
}

const formatNumber = (number: number) => {
  return number.toLocaleString('ja-JP')
}

const getChangeText = (current: BalanceHistoryItem, previous: BalanceHistoryItem) => {
  const diff = current.jpy_value - previous.jpy_value
  const percentage = previous.jpy_value !== 0 ? (diff / previous.jpy_value) * 100 : 0
  const sign = diff >= 0 ? '+' : ''
  return `${sign}${percentage.toFixed(2)}%`
}

const getChangeColor = (current: BalanceHistoryItem, previous: BalanceHistoryItem) => {
  const diff = current.jpy_value - previous.jpy_value
  if (diff > 0) return 'text-green-600'
  if (diff < 0) return 'text-red-600'
  return 'text-gray-600'
}

const getChangeIcon = (current: BalanceHistoryItem, previous: BalanceHistoryItem) => {
  const diff = current.jpy_value - previous.jpy_value
  if (diff > 0) return 'mdi:trending-up'
  if (diff < 0) return 'mdi:trending-down'
  return 'mdi:minus'
}

const exportToCSV = () => {
  const headers = ['日付', 'BTC残高', 'BTC価格', '資産価値(JPY)', '前日比(%)', '曜日']
  const rows = props.data.map((item, index) => {
    const prevItem = index > 0 ? props.data[index - 1] : null
    const change = prevItem 
      ? ((item.jpy_value - prevItem.jpy_value) / prevItem.jpy_value * 100).toFixed(2)
      : '0.00'
    
    return [
      formatDate(item.date),
      formatBTC(item.btc_amount),
      item.btc_rate.toString(),
      item.jpy_value.toString(),
      change,
      formatDayOfWeek(item.date)
    ]
  })

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `asset-history-${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}

// Reset page when date range changes
watch(dateRange, () => {
  currentPage.value = 1
})
</script>
