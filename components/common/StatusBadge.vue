<template>
  <span 
    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    :class="badgeClasses"
  >
    <Icon v-if="iconName" :name="iconName" class="w-3 h-3 mr-1" />
    {{ statusText }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TRANSACTION_STATUS } from '~/types'

const props = defineProps<{
  status: 'pending' | 'approved' | 'rejected'
}>()

const statusConfig = {
  [TRANSACTION_STATUS.PENDING]: {
    text: '承認待ち',
    classes: 'bg-orange-100 text-orange-800',
    icon: 'mdi:clock-outline'
  },
  [TRANSACTION_STATUS.APPROVED]: {
    text: '承認済み',
    classes: 'bg-green-100 text-green-800',
    icon: 'mdi:check-circle'
  },
  [TRANSACTION_STATUS.REJECTED]: {
    text: '拒否済み',
    classes: 'bg-red-100 text-red-800',
    icon: 'mdi:close-circle'
  }
}

const statusText = computed(() => {
  return statusConfig[props.status]?.text || props.status
})

const badgeClasses = computed(() => {
  return statusConfig[props.status]?.classes || 'bg-gray-100 text-gray-800'
})

const iconName = computed(() => {
  return statusConfig[props.status]?.icon
})
</script>