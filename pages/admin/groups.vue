<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2">グループ管理</h1>
        <p class="text-gray-600">Cognitoユーザーグループを管理し、権限制御を行います</p>
      </div>
      <v-btn
        color="primary"
        prepend-icon="mdi-account"
        @click="showCreateDialog = true"
      >
        新規グループ作成
      </v-btn>
    </div>

    <!-- Filters -->
    <v-card class="mb-6">
      <v-card-text class="py-4">
        <div class="flex items-center space-x-4">
          <v-text-field
            v-model="searchQuery"
            label="グループ名検索"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="compact"
            clearable
            class="w-64"
          />
          <v-btn
            variant="outlined"
            prepend-icon="mdi-refresh"
            @click="loadGroups"
          >
            更新
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <v-card class="card-shadow">
        <v-card-text class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-gray-600">総グループ数</h3>
            <Icon name="mdi:account-group" class="text-2xl text-blue-500" />
          </div>
          <p class="text-2xl font-bold text-gray-900">{{ totalGroups }}</p>
        </v-card-text>
      </v-card>

      <v-card class="card-shadow">
        <v-card-text class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-gray-600">管理者グループ</h3>
            <Icon name="mdi:shield-account" class="text-2xl text-orange-500" />
          </div>
          <p class="text-2xl font-bold text-orange-600">{{ administratorGroupExists ? '設定済み' : '未設定' }}</p>
        </v-card-text>
      </v-card>

      <v-card class="card-shadow">
        <v-card-text class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-gray-600">カスタムグループ</h3>
            <Icon name="mdi:account-multiple" class="text-2xl text-green-500" />
          </div>
          <p class="text-2xl font-bold text-green-600">{{ customGroupsCount }}</p>
        </v-card-text>
      </v-card>
    </div>

    <!-- Groups Table -->
    <v-card>
      <v-card-title class="px-6 py-4 border-b">
        <h3 class="text-lg font-semibold text-gray-900">グループ一覧</h3>
      </v-card-title>

      <v-data-table
        :headers="headers"
        :items="filteredGroups"
        :loading="loading"
        :items-per-page="15"
        class="elevation-0"
        no-data-text="グループが見つかりません"
        loading-text="読み込み中..."
      >
        <template #[`item.GroupName`]="{ item }">
          <div class="flex items-center space-x-2">
            <v-chip
              v-if="item.GroupName === 'administrator'"
              color="warning"
              size="small"
              variant="flat"
            >
              <Icon name="mdi:shield" class="mr-1" />
              管理者
            </v-chip>
            <v-chip
              v-else-if="item.GroupName === 'user'"
              color="primary"
              size="small"
              variant="flat"
            >
              <Icon name="mdi:account" class="mr-1" />
              一般ユーザー
            </v-chip>
            <span class="font-medium">{{ item.GroupName }}</span>
          </div>
        </template>

        <template #[`item.Description`]="{ item }">
          <div class="max-w-xs">
            <p class="truncate" :title="item.Description || '説明なし'">
              {{ item.Description || '説明なし' }}
            </p>
          </div>
        </template>

        <template #[`item.Precedence`]="{ item }">
          <v-chip
            :color="getPrecedenceColor(item.Precedence)"
            size="small"
            variant="flat"
          >
            {{ item.Precedence || 0 }}
          </v-chip>
        </template>

        <template #[`item.CreationDate`]="{ item }">
          {{ formatDate(item.CreationDate) }}
        </template>

        <template #[`item.actions`]="{ item }">
          <div class="flex items-center space-x-1">
            <v-btn
              size="small"
              variant="text"
              color="purple"
              prepend-icon="mdi-eye"
              @click="openPermissionViewerDialog(item)"
            />
            <v-btn
              size="small"
              variant="text"
              color="info"
              prepend-icon="mdi-account-group"
              @click="openUserManagementDialog(item)"
            />
            <v-btn
              v-if="!isSystemGroup(item.GroupName)"
              size="small"
              variant="text"
              color="primary"
              prepend-icon="mdi-pencil"
              @click="openEditDialog(item)"
            />
            <v-btn
              v-if="!isSystemGroup(item.GroupName)"
              size="small"
              variant="text"
              color="error"
              prepend-icon="mdi-delete"
              @click="deleteGroup(item)"
            />
            <v-tooltip v-else>
              <template #activator="{ props: tooltipProps }">
                <v-btn
                  v-bind="tooltipProps"
                  size="small"
                  variant="text"
                  color="grey"
                  icon="mdi-lock"
                  disabled
                />
              </template>
              システムグループは編集・削除できません
            </v-tooltip>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- Group Management Dialog -->
    <AdminGroupManagementDialog
      v-model="showCreateDialog"
      :group="selectedGroup"
      @created="handleGroupCreated"
      @updated="handleGroupUpdated"
    />

    <!-- User Group Assignment Dialog -->
    <AdminUserGroupAssignmentDialog
      v-model="showUserManagementDialog"
      :group="selectedGroup"
      @updated="handleUserGroupUpdated"
    />

    <!-- Group Permission Viewer Dialog -->
    <AdminGroupPermissionViewer
      v-model="showPermissionViewerDialog"
      :group="selectedGroup"
    />
  </div>
</template>

<script setup lang="ts">
import type { CognitoGroup } from '~/types'

definePageMeta({
  middleware: 'auth',
  requireAdmin: true,
  layout: 'default'
})

useHead({
  title: 'グループ管理 - BTC Mock App'
})

const logger = useLogger({ prefix: '[AdminGroups]' })
const { showSuccess, showError } = useNotification()

// State
const groups = ref<CognitoGroup[]>([])
const loading = ref(false)
const searchQuery = ref('')
const showCreateDialog = ref(false)
const showUserManagementDialog = ref(false)
const showPermissionViewerDialog = ref(false)
const selectedGroup = ref<CognitoGroup | null>(null)

// Table headers
const headers = [
  { title: 'グループ名', key: 'GroupName', sortable: true },
  { title: '説明', key: 'Description', sortable: false },
  { title: '優先度', key: 'Precedence', sortable: true },
  { title: '作成日', key: 'CreationDate', sortable: true },
  { title: 'アクション', key: 'actions', sortable: false, width: 160 }
]

// Computed
const filteredGroups = computed(() => {
  if (!searchQuery.value) return groups.value
  
  const query = searchQuery.value.toLowerCase()
  return groups.value.filter(group => 
    group.GroupName.toLowerCase().includes(query) ||
    (group.Description && group.Description.toLowerCase().includes(query))
  )
})

const totalGroups = computed(() => groups.value.length)

const administratorGroupExists = computed(() => 
  groups.value.some(group => group.GroupName === 'administrator')
)

const customGroupsCount = computed(() => 
  groups.value.filter(group => !isSystemGroup(group.GroupName)).length
)

// Methods
const loadGroups = async () => {
  loading.value = true
  try {
    const { data } = await $fetch<{ success: boolean; data: CognitoGroup[] }>('/api/admin/groups')
    groups.value = data || [] // APIから直接配列が返される。万が一undefinedの場合は空配列
  } catch (error) {
    logger.error('グループ一覧の読み込みに失敗しました:', error)
    showError('グループ一覧の取得に失敗しました')
    groups.value = [] // エラー時も空配列で初期化
  } finally {
    loading.value = false
  }
}

const openEditDialog = (group: CognitoGroup) => {
  selectedGroup.value = group
  showCreateDialog.value = true
}

const openUserManagementDialog = (group: CognitoGroup) => {
  selectedGroup.value = group
  showUserManagementDialog.value = true
}

const openPermissionViewerDialog = (group: CognitoGroup) => {
  selectedGroup.value = group
  showPermissionViewerDialog.value = true
}

const deleteGroup = async (group: CognitoGroup) => {
  if (!confirm(`グループ「${group.GroupName}」を削除してもよろしいですか？この操作は取り消せません。`)) {
    return
  }

  try {
    await $fetch(`/api/admin/groups/${group.GroupName}`, { method: 'DELETE' })
    showSuccess(`グループ「${group.GroupName}」を削除しました`)
    await loadGroups()
  } catch (error) {
    logger.error('グループの削除に失敗しました:', error)
    showError('グループの削除に失敗しました')
  }
}

const handleGroupCreated = () => {
  showCreateDialog.value = false
  selectedGroup.value = null
  loadGroups()
}

const handleGroupUpdated = () => {
  showCreateDialog.value = false
  selectedGroup.value = null
  loadGroups()
}

const handleUserGroupUpdated = () => {
  showUserManagementDialog.value = false
  selectedGroup.value = null
  // User group assignment doesn't affect group list, so no need to reload
}

// Utility functions
const isSystemGroup = (groupName: string): boolean => {
  return groupName === 'administrator' || groupName === 'user'
}

const getPrecedenceColor = (precedence?: number) => {
  if (!precedence) return 'grey'
  if (precedence <= 10) return 'error'
  if (precedence <= 50) return 'warning'
  return 'success'
}

const formatDate = (date?: Date) => {
  if (!date) return '不明'
  return new Date(date).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Load groups on mount
onMounted(() => {
  loadGroups()
})
</script>