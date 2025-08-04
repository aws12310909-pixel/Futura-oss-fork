<template>
  <v-dialog
    :model-value="modelValue"
    max-width="800"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-lg font-semibold flex items-center justify-between">
        <span>免許証画像</span>
        <v-btn
          variant="text"
          size="small"
          icon="mdi-close"
          @click="$emit('update:modelValue', false)"
        />
      </v-card-title>

      <v-card-text class="p-4">
        <div v-if="imageUrl" class="text-center">
          <img 
            :src="imageUrl" 
            alt="免許証画像"
            class="max-w-full h-auto max-h-96 mx-auto rounded-lg shadow-lg"
            @error="handleImageError"
          >
        </div>
        <div v-else class="text-center py-8">
          <Icon name="mdi:image-off" class="text-4xl text-gray-400 mb-2" />
          <p class="text-gray-500">画像がありません</p>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
// Props & Emits
const _props = defineProps<{
  modelValue: boolean
  imageUrl: string
}>()

const _emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { showError } = useNotification()

const handleImageError = () => {
  showError('画像の読み込みに失敗しました')
}
</script>