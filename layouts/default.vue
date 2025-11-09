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
        <CommonAppLogo size="md" :centered="false" />
        <span class="text-base font-semibold text-gray-900">M・S CFD App</span>
      </v-toolbar-title>
    </v-app-bar>
    
    <v-main>
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
const drawer = ref(true)

// Setup mobile detection
onMounted(() => {
  if (import.meta.client) {
    const updateMobile = () => {
      const wasMobile = isMobile.value
      isMobile.value = window.innerWidth < 768
      
      // Adjust drawer state based on screen size
      if (isMobile.value) {
        // On mobile, close drawer by default
        drawer.value = false
      } else {
        // On desktop, open drawer by default
        drawer.value = true
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

