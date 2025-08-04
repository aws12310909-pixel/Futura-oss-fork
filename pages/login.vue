<template>
  <div>
    <AuthLoginForm />
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'auth',
  middleware: 'redirect'
})

// Redirect if already authenticated
const { isAuthenticated } = useAuth()

watch(isAuthenticated, (authenticated) => {
  if (authenticated) {
    navigateTo('/dashboard')
  }
})

// Check on mount as well
onMounted(() => {
  if (isAuthenticated.value) {
    navigateTo('/dashboard')
  }
})
</script>