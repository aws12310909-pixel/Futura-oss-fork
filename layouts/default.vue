<template>
  <v-app>
    <LayoutAppNavigation 
      v-if="isAuthenticated" 
      :is-mobile="isMobile"
      :drawer="drawer"
      @update:drawer="drawer = $event"
    />
    
    <!-- Mobile Header with Hamburger Menu -->
    <v-app-bar 
      v-if="isAuthenticated && isMobile"
      app
      color="white"
      elevation="1"
      height="56"
      class="border-b border-gray-200"
    >
      <v-app-bar-nav-icon @click="drawer = !drawer">
        <Icon name="mdi:menu" class="text-xl" />
      </v-app-bar-nav-icon>
      
      <v-toolbar-title class="flex items-center space-x-2">
        <Icon name="mdi:bitcoin" class="text-xl text-primary-500" />
        <span class="text-base font-semibold text-gray-900">BTC Mock App</span>
      </v-toolbar-title>
    </v-app-bar>
    
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
// Drawer state for mobile navigation
const drawer = ref(false)

// Setup mobile detection
onMounted(() => {
  if (import.meta.client) {
    const updateMobile = () => {
      const wasMobile = isMobile.value
      isMobile.value = window.innerWidth < 768
      
      // Close drawer when switching from desktop to mobile
      if (!wasMobile && isMobile.value) {
        drawer.value = false
      }
    }
    
    updateMobile()
    window.addEventListener('resize', updateMobile)
    
    onUnmounted(() => {
      window.removeEventListener('resize', updateMobile)
    })
  }
})
</script>

