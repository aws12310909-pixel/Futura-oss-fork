<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2">ユーザー管理</h1>
        <p class="text-gray-600">システム内のユーザーアカウントを管理します</p>
      </div>
      <v-btn
        color="primary"
                  prepend-icon="mdi-plus"
        @click="showCreateDialog = true"
      >
        新規ユーザー作成
      </v-btn>
    </div>

    <!-- Filters -->
    <v-card class="mb-6">
      <v-card-text class="py-4">
        <div class="flex items-center space-x-4">
          <v-select
            v-model="selectedStatus"
            :items="statusOptions"
            label="ステータス"
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
        <template #[`item.status`]="{ item }">
          <v-chip
            :color="getStatusColor(item.status)"
            size="small"
            variant="flat"
          >
            {{ getStatusText(item.status) }}
          </v-chip>
        </template>

        <template #[`item.profile_approved`]="{ item }">
          <v-chip
            :color="item.profile_approved ? 'success' : 'warning'"
            size="small"
            variant="flat"
          >
            {{ item.profile_approved ? '承認済み' : '未承認' }}
          </v-chip>
        </template>

        <template #[`item.created_at`]="{ item }">
          {{ formatDate(item.created_at) }}
        </template>

        <template #[`item.actions`]="{ item }">
          <div class="flex items-center space-x-1">
            <v-btn
              v-if="item.status === 'active'"
              size="small"
              variant="text"
              color="warning"
              icon="mdi-pause"
              @click="suspendUser(item)"
            />
            <v-btn
              v-if="item.status === 'suspended'"
              size="small"
              variant="text"
              color="success"
              icon="mdi-play"
              @click="activateUser(item)"
            />
            <v-btn
              size="small"
              variant="text"
              color="info"
              icon="mdi-lock-reset"
              @click="openResetPasswordDialog(item)"
            />
            <v-btn
              v-if="item.status !== 'deleted'"
              size="small"
              variant="text"
              color="error"
              icon="mdi-delete"
              @click="deleteUser(item)"
            />
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- Create User Dialog -->
    <AdminCreateUserDialog
      v-model="showCreateDialog"
      @created="handleUserCreated"
    />

    <!-- Reset Password Dialog -->
    <AdminResetPasswordDialog
      v-model="showResetPasswordDialog"
      :user="selectedUser"
      @reset="handlePasswordReset"
    />
  </div>
</template>

<script setup lang="ts">
import type { User } from '~/types'

const logger = useLogger({ prefix: '[PAGE-ADMIN-USERS]' })
const apiClient = useApiClient()

definePageMeta({
  middleware: 'auth',
  requireAdmin: true,
  layout: 'default'
})

useHead({
  title: 'ユーザー管理 - M・S CFD App'
})

const { showSuccess, showError } = useNotification()

// State
const users = ref<User[]>([])
const loading = ref(false)
const selectedStatus = ref('all')
const searchQuery = ref('')
const showCreateDialog = ref(false)
const showResetPasswordDialog = ref(false)
const selectedUser = ref<User | null>(null)

// Options
const statusOptions = [
  { title: 'すべて', value: 'all' },
  { title: 'アクティブ', value: 'active' },
  { title: '停止中', value: 'suspended' },
  { title: '削除済み', value: 'deleted' }
]

// Table headers
const headers = [
  { title: '名前', key: 'name', sortable: true },
  { title: 'メールアドレス', key: 'email', sortable: true },
  { title: 'ステータス', key: 'status', sortable: true },
  { title: 'プロフィール承認', key: 'profile_approved', sortable: true },
  { title: '作成日', key: 'created_at', sortable: true },
  { title: 'アクション', key: 'actions', sortable: false, width: 140 }
]

// Computed
const filteredUsers = computed(() => {
  let filtered = users.value

  // Filter by status
  if (selectedStatus.value !== 'all') {
    filtered = filtered.filter(user => user.status === selectedStatus.value)
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

const suspendUser = async (user: User) => {
  try {
    await apiClient.post(`/admin/users/${user.user_id}/suspend`)
    showSuccess(`${user.name}を停止しました`)
    await loadUsers()
  } catch (error) {
    logger.error('ユーザーの停止に失敗しました:', error)
    showError('ユーザーの停止に失敗しました')
  }
}

const activateUser = async (user: User) => {
  try {
    await apiClient.post(`/admin/users/${user.user_id}/activate`)
    showSuccess(`${user.name}を有効化しました`)
    await loadUsers()
  } catch (error) {
    logger.error('ユーザーの有効化に失敗しました:', error)
    showError('ユーザーの有効化に失敗しました')
  }
}

const deleteUser = async (user: User) => {
  if (!confirm(`${user.name}を削除してもよろしいですか？この操作は取り消せません。`)) {
    return
  }

  try {
    await apiClient.post(`/admin/users/${user.user_id}/delete`)
    showSuccess(`${user.name}を削除しました`)
    await loadUsers()
  } catch (error) {
    logger.error('ユーザーの削除に失敗しました:', error)
    showError('ユーザーの削除に失敗しました')
  }
}

const openResetPasswordDialog = (user: User) => {
  selectedUser.value = user
  showResetPasswordDialog.value = true
}

const handleUserCreated = () => {
  showCreateDialog.value = false
  loadUsers()
}

const handlePasswordReset = () => {
  showResetPasswordDialog.value = false
  selectedUser.value = null
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
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Load users on mount
onMounted(() => {
  loadUsers()
})
</script>