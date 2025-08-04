<template>
  <v-dialog 
    :model-value="modelValue" 
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="600"
    persistent
  >
    <v-card>
      <v-card-title class="px-6 py-4 border-b">
        <h3 class="text-lg font-semibold text-gray-900">
          {{ isEdit ? 'グループ編集' : '新規グループ作成' }}
        </h3>
      </v-card-title>

      <v-card-text class="px-6 py-6">
        <v-form ref="formRef" v-model="valid" @submit.prevent="submit">
          <div class="space-y-4">
            <!-- Group Name -->
            <v-text-field
              v-model="form.groupName"
              label="グループ名 *"
              variant="outlined"
              :readonly="isEdit"
              :rules="groupNameRules"
              :hint="isEdit ? 'グループ名は変更できません' : 'アルファベット、数字、ハイフン、アンダースコアのみ使用可能'"
              persistent-hint
            />

            <!-- Description -->
            <v-textarea
              v-model="form.description"
              label="説明"
              variant="outlined"
              rows="3"
              :rules="descriptionRules"
              hint="グループの用途や権限について説明してください"
            />

            <!-- Precedence -->
            <v-text-field
              v-model.number="form.precedence"
              label="優先度"
              variant="outlined"
              type="number"
              :rules="precedenceRules"
              hint="数値が小さいほど高優先度（0-9999）"
            />

            <!-- Admin Group Warning -->
            <v-alert
              v-if="form.groupName === 'administrator'"
              type="warning"
              variant="tonal"
              class="mt-4"
            >
              <template #prepend>
                <Icon name="mdi:shield-alert" />
              </template>
              <div>
                <strong>管理者グループ</strong><br>
                このグループは特別な権限を持ちます。削除や重要な変更を行う際は十分ご注意ください。
              </div>
            </v-alert>

            <!-- Permissions Selection -->
            <div>
              <label class="text-sm font-medium text-gray-700 mb-3 block">権限設定</label>
              <v-btn
                variant="outlined"
                prepend-icon="mdi-shield-check"
                @click="showPermissionDialog = true"
                :disabled="loading"
                class="mb-2"
              >
                権限を選択 ({{ selectedPermissions.length }}個選択中)
              </v-btn>
              
              <!-- Selected Permissions Preview -->
              <div v-if="selectedPermissions.length > 0" class="mt-2">
                <div class="flex flex-wrap gap-2">
                  <v-chip
                    v-for="permission in selectedPermissions.slice(0, 5)"
                    :key="permission"
                    size="small"
                    color="primary"
                    variant="tonal"
                  >
                    {{ getPermissionLabel(permission) }}
                  </v-chip>
                  <v-chip
                    v-if="selectedPermissions.length > 5"
                    size="small"
                    variant="outlined"
                  >
                    他 {{ selectedPermissions.length - 5 }}個
                  </v-chip>
                </div>
              </div>
            </div>

            <!-- Precedence Info -->
            <v-alert
              type="info"
              variant="tonal"
              class="mt-4"
            >
              <template #prepend>
                <Icon name="mdi:information" />
              </template>
              <div>
                <strong>優先度について</strong><br>
                • 0-10: 最高権限（管理者レベル）<br>
                • 11-50: 高権限（マネージャーレベル）<br>
                • 51-100: 通常権限（ユーザーレベル）
              </div>
            </v-alert>
          </div>
        </v-form>
      </v-card-text>

      <v-card-actions class="px-6 py-4 border-t">
        <v-spacer />
        <v-btn 
          variant="outlined" 
          @click="closeDialog"
        >
          キャンセル
        </v-btn>
        <v-btn
          color="primary"
          :loading="loading"
          :disabled="!valid"
          @click="submit"
        >
          {{ isEdit ? '更新' : '作成' }}
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Permission Selection Dialog -->
    <v-dialog
      v-model="showPermissionDialog"
      max-width="800"
      persistent
    >
      <v-card>
        <v-card-title class="px-6 py-4 border-b">
          <h3 class="text-lg font-semibold text-gray-900">権限選択</h3>
        </v-card-title>

        <v-card-text class="px-6 py-6">
          <!-- Permission Templates -->
          <div class="mb-6">
            <h4 class="text-md font-medium text-gray-800 mb-3">権限テンプレート</h4>
            <div class="flex flex-wrap gap-2">
              <v-btn
                size="small"
                variant="outlined"
                color="info"
                @click="applyTemplate('basicUser')"
              >
                基本ユーザー
              </v-btn>
              <v-btn
                size="small"
                variant="outlined"
                color="warning"
                @click="applyTemplate('powerUser')"
              >
                パワーユーザー
              </v-btn>
              <v-btn
                size="small"
                variant="outlined"
                color="orange"
                @click="applyTemplate('manager')"
              >
                マネージャー
              </v-btn>
              <v-btn
                size="small"
                variant="outlined"
                color="error"
                @click="clearAllPermissions()"
              >
                全てクリア
              </v-btn>
            </div>
          </div>

          <v-divider class="my-4" />

          <!-- User Level Permissions -->
          <div class="mb-6">
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-lg font-semibold text-blue-700">👤 一般ユーザー向け権限</h4>
              <v-btn
                size="small"
                variant="outlined"
                color="blue"
                @click="toggleLevelPermissions('user')"
              >
                {{ isLevelSelected('user') ? '全解除' : '全選択' }}
              </v-btn>
            </div>
            
            <div class="space-y-4">
              <div v-for="(category, categoryKey) in userCategories" :key="categoryKey">
                <div class="flex items-center justify-between mb-2">
                  <h5 class="text-sm font-medium text-gray-700">{{ category.label }}</h5>
                  <v-btn
                    size="x-small"
                    variant="text"
                    @click="toggleCategoryPermissions(String(categoryKey), category.permissions)"
                  >
                    {{ isCategorySelected(category.permissions) ? '解除' : '選択' }}
                  </v-btn>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 ml-4">
                  <v-checkbox
                    v-for="permission in category.permissions"
                    :key="permission.key"
                    :model-value="selectedPermissions.includes(permission.key)"
                    @update:model-value="togglePermission(permission.key)"
                    density="compact"
                    hide-details
                  >
                    <template #label>
                      <div>
                        <div class="font-medium text-sm">{{ permission.label }}</div>
                        <div class="text-xs text-gray-500">{{ permission.description }}</div>
                      </div>
                    </template>
                  </v-checkbox>
                </div>
              </div>
            </div>
          </div>

          <v-divider class="my-4" />

          <!-- Admin Level Permissions -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-lg font-semibold text-red-700">🔧 管理者向け権限</h4>
              <v-btn
                size="small"
                variant="outlined"
                color="red"
                @click="toggleLevelPermissions('admin')"
              >
                {{ isLevelSelected('admin') ? '全解除' : '全選択' }}
              </v-btn>
            </div>
            
            <div class="space-y-4">
              <div v-for="(category, categoryKey) in adminCategories" :key="categoryKey">
                <div class="flex items-center justify-between mb-2">
                  <h5 class="text-sm font-medium text-gray-700">{{ category.label }}</h5>
                  <v-btn
                    size="x-small"
                    variant="text"
                    @click="toggleCategoryPermissions(String(categoryKey), category.permissions)"
                  >
                    {{ isCategorySelected(category.permissions) ? '解除' : '選択' }}
                  </v-btn>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 ml-4">
                  <v-checkbox
                    v-for="permission in category.permissions"
                    :key="permission.key"
                    :model-value="selectedPermissions.includes(permission.key)"
                    @update:model-value="togglePermission(permission.key)"
                    density="compact"
                    hide-details
                  >
                    <template #label>
                      <div>
                        <div class="font-medium text-sm">{{ permission.label }}</div>
                        <div class="text-xs text-gray-500">{{ permission.description }}</div>
                      </div>
                    </template>
                  </v-checkbox>
                </div>
              </div>
            </div>
          </div>
        </v-card-text>

        <v-card-actions class="px-6 py-4 border-t">
          <div class="text-sm text-gray-600">
            {{ selectedPermissions.length }}個の権限が選択されています
          </div>
          <v-spacer />
          <v-btn 
            variant="outlined" 
            @click="showPermissionDialog = false"
          >
            キャンセル
          </v-btn>
          <v-btn
            color="primary"
            @click="showPermissionDialog = false"
          >
            確定
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script setup lang="ts">
import type { CognitoGroup, GroupCreateForm, GroupUpdateForm } from '~/types'

interface Props {
  modelValue: boolean
  group?: CognitoGroup | null
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'created'): void
  (e: 'updated'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const logger = useLogger({ prefix: '[GroupManagementDialog]' })
const { showSuccess, showError } = useNotification()

// State
const loading = ref(false)
const valid = ref(false)
const formRef = ref()

const form = ref<GroupCreateForm>({
  groupName: '',
  description: '',
  precedence: 100,
  permissions: []
})

// Permission management
const showPermissionDialog = ref(false)
const selectedPermissions = ref<string[]>([])
const permissionCategories = ref<any>({})
const userCategories = ref<any>({})
const adminCategories = ref<any>({})
const permissionTemplates = ref<any>({})

// Computed
const isEdit = computed(() => !!props.group)

// Validation rules
const groupNameRules = [
  (v: string) => !!v || 'グループ名は必須です',
  (v: string) => v.length >= 3 || 'グループ名は3文字以上で入力してください',
  (v: string) => v.length <= 50 || 'グループ名は50文字以下で入力してください',
  (v: string) => /^[a-zA-Z0-9_-]+$/.test(v) || 'アルファベット、数字、ハイフン、アンダースコアのみ使用可能です'
]

const descriptionRules = [
  (v: string) => !v || v.length <= 200 || '説明は200文字以下で入力してください'
]

const precedenceRules = [
  (v: number) => v >= 0 || '優先度は0以上の数値で入力してください',
  (v: number) => v <= 9999 || '優先度は9999以下の数値で入力してください'
]

// Permission methods
const getPermissionLabel = (permissionKey: string) => {
  for (const category of Object.values(permissionCategories.value)) {
    const permission = (category as any).permissions?.find((p: any) => p.key === permissionKey)
    if (permission) return permission.label
  }
  return permissionKey
}

const togglePermission = (permissionKey: string) => {
  const index = selectedPermissions.value.indexOf(permissionKey)
  if (index > -1) {
    selectedPermissions.value.splice(index, 1)
  } else {
    selectedPermissions.value.push(permissionKey)
  }
}

const toggleCategoryPermissions = (categoryKey: string, permissions: any[]) => {
  const categoryPermissionKeys = permissions.map(p => p.key)
  const allSelected = categoryPermissionKeys.every(key => selectedPermissions.value.includes(key))
  
  if (allSelected) {
    // Remove all category permissions
    selectedPermissions.value = selectedPermissions.value.filter(key => !categoryPermissionKeys.includes(key))
  } else {
    // Add all category permissions
    categoryPermissionKeys.forEach(key => {
      if (!selectedPermissions.value.includes(key)) {
        selectedPermissions.value.push(key)
      }
    })
  }
}

const isCategorySelected = (permissions: any[]) => {
  const categoryPermissionKeys = permissions.map(p => p.key)
  return categoryPermissionKeys.every(key => selectedPermissions.value.includes(key))
}

const toggleLevelPermissions = (level: 'user' | 'admin') => {
  const categories = level === 'user' ? userCategories.value : adminCategories.value
  const levelPermissionKeys = Object.values(categories).flatMap((category: any) => 
    category.permissions.map((p: any) => p.key)
  )
  
  const allSelected = levelPermissionKeys.every(key => selectedPermissions.value.includes(key))
  
  if (allSelected) {
    // Remove all level permissions
    selectedPermissions.value = selectedPermissions.value.filter(key => !levelPermissionKeys.includes(key))
  } else {
    // Add all level permissions
    levelPermissionKeys.forEach(key => {
      if (!selectedPermissions.value.includes(key)) {
        selectedPermissions.value.push(key)
      }
    })
  }
}

const isLevelSelected = (level: 'user' | 'admin') => {
  const categories = level === 'user' ? userCategories.value : adminCategories.value
  const levelPermissionKeys = Object.values(categories).flatMap((category: any) => 
    category.permissions.map((p: any) => p.key)
  )
  
  return levelPermissionKeys.every(key => selectedPermissions.value.includes(key))
}

const applyTemplate = (templateName: string) => {
  if (permissionTemplates.value[templateName]) {
    selectedPermissions.value = [...permissionTemplates.value[templateName]]
  }
}

const clearAllPermissions = () => {
  selectedPermissions.value = []
}

// Load permissions data
const loadPermissions = async () => {
  try {
    const response = await $fetch('/api/admin/permissions')
    if (response.success) {
      permissionCategories.value = response.data.categories
      userCategories.value = response.data.userCategories
      adminCategories.value = response.data.adminCategories
      permissionTemplates.value = response.data.templates
    }
  } catch (error) {
    logger.error('Failed to load permissions:', error)
  }
}

// Methods
const resetForm = () => {
  form.value = {
    groupName: '',
    description: '',
    precedence: 100,
    permissions: []
  }
  selectedPermissions.value = []
}

const loadGroupData = async () => {
  if (props.group) {
    form.value = {
      groupName: props.group.GroupName,
      description: props.group.Description || '',
      precedence: props.group.Precedence || 100,
      permissions: []
    }
    
    // Load existing permissions for this group
    try {
      const response = await $fetch(`/api/admin/groups/${props.group.GroupName}/permissions`)
      if (response.success && response.data?.permissions) {
        selectedPermissions.value = response.data.permissions
      }
    } catch (error) {
      // Group might not have permissions set yet, which is fine
      selectedPermissions.value = []
    }
  } else {
    resetForm()
  }
}

const closeDialog = () => {
  emit('update:modelValue', false)
  resetForm()
}

const submit = async () => {
  if (!formRef.value?.validate()) return

  loading.value = true
  
  try {
    if (isEdit.value) {
      // Update existing group
      const updateData: GroupUpdateForm = {
        description: form.value.description,
        precedence: form.value.precedence,
        permissions: selectedPermissions.value
      }
      
      await $fetch(`/api/admin/groups/${props.group!.GroupName}`, {
        method: 'PUT',
        body: updateData
      })
      
      showSuccess(`グループ「${form.value.groupName}」を更新しました`)
      emit('updated')
    } else {
      // Create new group
      const createData: GroupCreateForm = {
        ...form.value,
        permissions: selectedPermissions.value
      }
      
      await $fetch('/api/admin/groups', {
        method: 'POST',
        body: createData
      })
      
      showSuccess(`グループ「${form.value.groupName}」を作成しました`)
      emit('created')
    }
    
    closeDialog()
  } catch (error: any) {
    logger.error('グループの保存に失敗しました:', error)
    
    // Extract error message
    let errorMessage = '操作に失敗しました'
    if (error?.data?.message) {
      errorMessage = error.data.message
    } else if (error?.statusMessage) {
      errorMessage = error.statusMessage
    }
    
    showError(errorMessage)
  } finally {
    loading.value = false
  }
}

// Watch for dialog open/close
watch(() => props.modelValue, async (newValue) => {
  if (newValue) {
    await loadPermissions()
    await loadGroupData()
  }
})

// Watch for group changes
watch(() => props.group, async () => {
  if (props.modelValue) {
    await loadGroupData()
  }
})
</script>