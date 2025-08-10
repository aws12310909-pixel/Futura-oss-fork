import type { NotificationState } from '~/types'

// Global notification state
const globalNotification = ref<NotificationState>({
  show: false,
  type: 'info',
  message: ''
})

export const useNotification = () => {
  const notification = globalNotification

  const showNotification = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    duration = 5000
  ) => {
    notification.value = {
      show: true,
      type,
      message
    }

    if (duration > 0) {
      setTimeout(() => {
        hideNotification()
      }, duration)
    }
  }

  const hideNotification = () => {
    notification.value.show = false
  }

  const showSuccess = (message: string, duration?: number) => {
    showNotification(message, 'success', duration)
  }

  const showError = (message: string, duration?: number) => {
    showNotification(message, 'error', duration)
  }

  const showWarning = (message: string, duration?: number) => {
    showNotification(message, 'warning', duration)
  }

  const showInfo = (message: string, duration?: number) => {
    showNotification(message, 'info', duration)
  }

  return {
    notification: readonly(notification),
    showNotification,
    hideNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo
  }
}