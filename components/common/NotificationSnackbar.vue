<template>
  <v-snackbar
    v-model="notification.show"
    :color="notificationColor"
    :timeout="5000"
    location="top right"
    vertical
  >
    <div class="flex items-center space-x-3">
      <Icon :name="notificationIcon" class="text-xl flex-shrink-0" />
      <span class="text-sm font-medium">{{ notification.message }}</span>
    </div>
    
    <template #actions>
      <v-btn
        variant="text"
        size="small"
        icon
        @click="hideNotification"
      >
        <Icon name="mdi:close" />
      </v-btn>
    </template>
  </v-snackbar>
</template>

<script setup>
const { notification, hideNotification } = useNotification()

const notificationColor = computed(() => {
  switch (notification.value.type) {
    case 'success':
      return 'success'
    case 'error':
      return 'error'
    case 'warning':
      return 'warning'
    case 'info':
    default:
      return 'info'
  }
})

const notificationIcon = computed(() => {
  switch (notification.value.type) {
    case 'success':
      return 'mdi:check-circle'
    case 'error':
      return 'mdi:alert-circle'
    case 'warning':
      return 'mdi:alert'
    case 'info':
    default:
      return 'mdi:information'
  }
})
</script>