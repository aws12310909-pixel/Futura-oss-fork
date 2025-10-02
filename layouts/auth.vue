<template>
  <v-app>
    <v-main>
      <div class="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 flex items-center justify-center p-4">
        <div class="w-full max-w-md">
          <div class="text-center mb-8">
            <Icon name="mdi:bitcoin" class="text-6xl text-primary-500 mb-4" />
            <h1 class="text-3xl font-bold text-gray-900 mb-2">M・S CFD App</h1>
            <p class="text-gray-600">Portfolio Management System</p>
          </div>
          
          <v-card class="card-shadow-lg">
            <v-card-text class="p-8">
              <slot />
            </v-card-text>
          </v-card>
        </div>
      </div>
    </v-main>
  </v-app>
</template>
