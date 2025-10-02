<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 mb-2">プロフィール承認</h1>
      <p class="text-gray-600">ユーザーのプロフィール情報と免許証画像を確認し、承認を管理します</p>
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
            <h3 class="text-sm font-medium text-gray-600">承認済み</h3>
            <Icon name="mdi:check-circle" class="text-2xl text-green-500" />
          </div>
          <p class="text-2xl font-bold text-green-600">{{ approvedCount }}</p>
        </v-card-text>
      </v-card>

      <v-card class="card-shadow">
        <v-card-text class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-gray-600">総ユーザー数</h3>
            <Icon name="mdi:account-group" class="text-2xl text-blue-500" />
          </div>
          <p class="text-2xl font-bold text-blue-600">{{ totalUsers }}</p>
        </v-card-text>
      </v-card>
    </div>

    <!-- Filters -->
    <v-card class="mb-6">
      <v-card-text class="py-4">
        <div class="flex items-center space-x-4">
          <v-select
            v-model="selectedStatus"
            :items="statusOptions"
            label="承認ステータス"
            variant="outlined"
            density="compact"
            class="w-48"
          />
          <v-text-field
            v-model="searchQuery"
            label="検索"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="compact"
            clearable
            class="w-64"
          />
          <v-btn
            variant="outlined"
            prepend-icon="mdi-refresh"
            @click="loadUsers"
          >
            更新
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <!-- Users Table -->
    <v-card>
      <v-data-table
        :headers="headers"
        :items="filteredUsers"
        :loading="loading"
        :items-per-page="20"
        class="elevation-0"
        no-data-text="ユーザーが見つかりません"
        loading-text="読み込み中..."
      >
        <template #[`item.profile_approved`]="{ item }">
          <v-chip
            :color="item.profile_approved ? 'success' : 'warning'"
            size="small"
            variant="flat"
          >
            <Icon 
              :name="item.profile_approved ? 'mdi:check' : 'mdi:clock-outline'" 
              class="mr-1" 
            />
            {{ item.profile_approved ? '承認済み' : '承認待ち' }}
          </v-chip>
        </template>

        <template #[`item.status`]="{ item }">
          <v-chip
            :color="getStatusColor(item.status)"
            size="small"
            variant="flat"
          >
            {{ getStatusText(item.status) }}
          </v-chip>
        </template>

        <template #[`item.profile_image_url`]="{ item }">
          <div class="flex items-center">
            <v-btn
              v-if="item.profile_image_url"
              size="small"
              variant="outlined"
              color="info"
              prepend-icon="mdi-image"
              @click="viewImage(item.profile_image_url)"
            >
              画像を表示
            </v-btn>
            <span v-else class="text-gray-400 text-sm">未アップロード</span>
          </div>
        </template>

        <template #[`item.created_at`]="{ item }">
          {{ formatDate(item.created_at) }}
        </template>

        <template #[`item.actions`]="{ item }">
          <div class="flex items-center space-x-1">
            <v-btn
              size="small"
              variant="text"
              color="info"
              icon="mdi-eye"
              @click="viewUserDetails(item)"
            />
            <v-btn
              v-if="!item.profile_approved && item.status !== 'deleted'"
              size="small"
              variant="text"
              color="success"
              icon="mdi-check"
              @click="approveUser(item)"
            />
            <v-btn
              v-if="item.profile_approved && item.status !== 'deleted'"
              size="small"
              variant="text"
              color="error"
              icon="mdi-close"
              @click="rejectUser(item)"
            />
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- User Details Dialog -->
    <AdminUserDetailsDialog
      v-model="showDetailsDialog"
      :user="selectedUser"
      @approve="handleApprove"
      @reject="handleReject"
    />

    <!-- Image Viewer Dialog -->
    <AdminImageViewerDialog
      v-model="showImageDialog"
      :image-url="selectedImageUrl"
    />
  </div>
</template>

<script setup lang="ts">
import type { User } from '~/types'

definePageMeta({
  middleware: 'auth',
  requireAdmin: true,
  layout: 'default'
})

useHead({
  title: 'プロフィール承認 - M・S CFD App'
})

const logger = useLogger({ prefix: '[AdminApprovals]' })
const { showSuccess, showError } = useNotification()
const apiClient = useApiClient()

// State
const users = ref<User[]>([])
const loading = ref(false)
const selectedStatus = ref('all')
const searchQuery = ref('')
const showDetailsDialog = ref(false)
const showImageDialog = ref(false)
const selectedUser = ref<User | null>(null)
const selectedImageUrl = ref('')

// Options
const statusOptions = [
  { title: 'すべて', value: 'all' },
  { title: '承認待ち', value: 'pending' },
  { title: '承認済み', value: 'approved' }
]

// Table headers
const headers = [
  { title: '名前', key: 'name', sortable: true },
  { title: 'メールアドレス', key: 'email', sortable: true },
  { title: 'ステータス', key: 'status', sortable: true },
  { title: '承認状況', key: 'profile_approved', sortable: true },
  { title: '免許証画像', key: 'profile_image_url', sortable: false },
  { title: '登録日', key: 'created_at', sortable: true },
  { title: 'アクション', key: 'actions', sortable: false, width: 160 }
]

// Computed
const filteredUsers = computed(() => {
  let filtered = users.value.filter(user => user.status !== 'deleted')

  // Filter by approval status
  if (selectedStatus.value === 'pending') {
    filtered = filtered.filter(user => !user.profile_approved)
  } else if (selectedStatus.value === 'approved') {
    filtered = filtered.filter(user => user.profile_approved)
  }

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(user => 
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    )
  }

  return filtered
})

const pendingCount = computed(() => 
  users.value.filter(user => !user.profile_approved && user.status !== 'deleted').length
)

const approvedCount = computed(() => 
  users.value.filter(user => user.profile_approved && user.status !== 'deleted').length
)

const totalUsers = computed(() => 
  users.value.filter(user => user.status !== 'deleted').length
)

// Methods
const loadUsers = async () => {
  loading.value = true
  try {
    const response = await apiClient.get<{ items: User[] }>('/admin/users')
    const data = response.data!
    users.value = data.items
  } catch (error) {
    logger.error('ユーザー一覧の読み込みに失敗しました:', error)
    showError('ユーザー一覧の取得に失敗しました')
  } finally {
    loading.value = false
  }
}

const approveUser = async (user: User) => {
  if (!confirm(`${user.name}のプロフィールを承認してもよろしいですか？`)) {
    return
  }

  try {
    await apiClient.post(`/admin/users/${user.user_id}/approve`)
    showSuccess(`${user.name}のプロフィールを承認しました`)
    await loadUsers()
  } catch (error) {
    logger.error('プロフィール承認に失敗しました:', error)
    showError('プロフィール承認に失敗しました')
  }
}

const rejectUser = async (user: User) => {
  const reason = prompt(`${user.name}のプロフィール承認を取り消す理由を入力してください（任意）:`)
  
  if (reason === null) return // User cancelled

  try {
    await apiClient.post(`/admin/users/${user.user_id}/reject`, { reason: reason || undefined })
    showSuccess(`${user.name}のプロフィール承認を取り消しました`)
    await loadUsers()
  } catch (error) {
    logger.error('プロフィール承認取り消しに失敗しました:', error)
    showError('プロフィール承認取り消しに失敗しました')
  }
}

const viewUserDetails = (user: User) => {
  selectedUser.value = user
  showDetailsDialog.value = true
}

const viewImage = (imageUrl: string) => {
  selectedImageUrl.value = imageUrl
  showImageDialog.value = true
}

const handleApprove = async (user: User) => {
  await approveUser(user)
  showDetailsDialog.value = false
}

const handleReject = async (user: User) => {
  await rejectUser(user)
  showDetailsDialog.value = false
}

// Utility functions
const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'success'
    case 'suspended': return 'warning'
    case 'deleted': return 'error'
    default: return 'grey'
  }
}

const getStatusText = (status: string) => {
  switch (status) {
    case 'active': return 'アクティブ'
    case 'suspended': return '停止中'
    case 'deleted': return '削除済み'
    default: return status
  }
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

// Load users on mount
onMounted(() => {
  loadUsers()
})
</script>