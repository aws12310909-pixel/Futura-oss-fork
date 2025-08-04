<template>
  <v-app>
    <LayoutAppNavigation v-if="isAuthenticated" />
    
    <v-main :class="{ 'pl-64': isAuthenticated && !isMobile }">
      <div class="min-h-screen bg-gray-50">
        <slot />
      </div>
    </v-main>
  </v-app>
</template>

<script setup>
const { isAuthenticated } = useAuth()

// Mobile detection without Vuetify dependency
const isMobile = ref(false)

// Setup mobile detection
onMounted(() => {
  if (import.meta.client) {
    const updateMobile = () => {
      isMobile.value = window.innerWidth < 768
    }
    
    updateMobile()
    window.addEventListener('resize', updateMobile)
    
    onUnmounted(() => {
      window.removeEventListener('resize', updateMobile)
    })
  }
})
</script>

