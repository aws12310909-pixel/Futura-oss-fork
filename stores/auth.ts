import { defineStore } from 'pinia'
import type { AuthUser } from '~/types'

const logger = useLogger({ prefix: '[STORE-AUTH]' })

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AuthUser | null,
    isLoading: false,
    isInitialized: false
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    isAdmin: (state) => state.user?.groups.includes('administrator') ?? false,
    userPermissions: (state) => state.user?.permissions ?? [],
    userGroups: (state) => state.user?.groups ?? []
  },

  actions: {
    setUser(user: AuthUser | null) {
      this.user = user
    },

    setLoading(loading: boolean) {
      this.isLoading = loading
    },

    setInitialized(initialized: boolean) {
      this.isInitialized = initialized
    },

    hasPermission(permission: string): boolean {
      return this.userPermissions.includes(permission)
    },

    hasGroup(group: string): boolean {
      return this.userGroups.includes(group)
    },

    async initializeAuth() {
      if (this.isInitialized || !import.meta.client) return

      this.setLoading(true)
      try {
        const { data } = await $fetch<{ success: boolean; data: AuthUser }>('/api/auth/me')
        if (data) {
          this.setUser(data)
        }
      } catch (error) {
        logger.error('認証の初期化に失敗しました:', error)
      } finally {
        this.setLoading(false)
        this.setInitialized(true)
      }
    },

    clearAuth() {
      this.user = null
      this.isInitialized = false
    }
  }
})