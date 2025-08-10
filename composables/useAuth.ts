import type { AuthUser, LoginCredentials, ChangePasswordRequest } from '~/types'

// SessionStorage key for user cache
const USER_CACHE_KEY = 'btc_mock_app_user'

// Global state (singleton pattern)
const globalUser = ref<AuthUser | null>(null)
const globalIsLoading = ref(false)
const globalIsInitialized = ref(false)

export const useAuth = () => {
  const logger = useLogger({ prefix: '[AUTH]' })
  const apiClient = useApiClient()
  
  // Use global state to ensure singleton behavior
  const user = globalUser
  const isAuthenticated = computed(() => !!user.value)
  const isLoading = globalIsLoading
  const isInitialized = globalIsInitialized

  // Cache management functions
  const saveToCache = (userData: AuthUser | null) => {
    if (import.meta.client) {
      try {
        if (userData) {
          sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData))
          logger.debug('ユーザーデータをキャッシュに保存しました:', userData.email)
        } else {
          sessionStorage.removeItem(USER_CACHE_KEY)
          logger.debug('ユーザーデータをキャッシュから削除しました')
        }
      } catch (error) {
        logger.error('ユーザーデータのキャッシュ保存に失敗しました:', error)
      }
    }
  }

  const loadFromCache = (): AuthUser | null => {
    if (import.meta.client) {
      try {
        const cached = sessionStorage.getItem(USER_CACHE_KEY)
        if (cached) {
          const userData = JSON.parse(cached) as AuthUser
          logger.debug('ユーザーデータをキャッシュから読み込みました:', userData.email)
          return userData
        }
      } catch (error) {
        logger.error('キャッシュからのユーザーデータ読み込みに失敗しました:', error)
        // Clear corrupted cache
        sessionStorage.removeItem(USER_CACHE_KEY)
      }
    }
    return null
  }

  const clearCache = () => {
    if (import.meta.client) {
      sessionStorage.removeItem(USER_CACHE_KEY)
      logger.debug('ユーザーキャッシュをクリアしました')
    }
  }

  // Login function with challenge support
  const login = async (credentials: LoginCredentials, authResult?: any): Promise<any> => {
    isLoading.value = true
    try {
      // If authResult is provided, process it directly (from password change)
      if (authResult) {
        const processedUser = await processAuthenticationResult(authResult, credentials.email)
        if (processedUser) {
          user.value = processedUser
          saveToCache(processedUser)
          await navigateTo('/dashboard')
          return { success: true, data: processedUser }
        }
        return { success: false }
      }

      // Normal login flow
      const response = await apiClient.post<{ 
        data?: AuthUser | {
          challenge: string;
          session: string;
          message: string;
        }; 
        message?: string 
      }>('/auth/login', credentials)

      console.log('response', response)
      
      if (response.data && !('challenge' in response.data)) {
        // 成功時: dataがAuthUserの場合
        user.value = response.data as AuthUser
        saveToCache(response.data as AuthUser)
        // Ensure auth state is properly synchronized before navigation
        await nextTick()
        await navigateTo('/dashboard')
        return { success: true, data: response.data }
      } else if (response.data && 'challenge' in response.data) {
        // チャレンジ時: dataがchallenge情報の場合
        const challengeData = response.data as { challenge: string; session: string; message: string }
        if (challengeData.challenge === 'NEW_PASSWORD_REQUIRED') {
          // 初回パスワード変更が必要な場合
          return {
            success: false,
            challenge: challengeData.challenge,
            session: challengeData.session,
            message: challengeData.message,
            requiresPasswordChange: true
          }
        } else {
          // その他のチャレンジ
          return {
            success: false,
            challenge: challengeData.challenge,
            session: challengeData.session,
            message: challengeData.message
          }
        }
      }
      
      return { success: false }
    } catch (error) {
      logger.auth.login(credentials.email)
      logger.error('ログインエラー:', error)
      return { success: false, error }
    } finally {
      isLoading.value = false
    }
  }

  // Process authentication result from Cognito
  const processAuthenticationResult = async (authResult: any, email: string): Promise<AuthUser | null> => {
    try {
      // Create session and return user data
      const response = await apiClient.post<AuthUser>('/auth/process-auth-result', {
        authResult,
        email
      })
      
      const userData = response.data || null
      if (userData) {
        saveToCache(userData)
      }
      return userData
    } catch (error) {
      logger.error('認証結果処理エラー:', error)
      return null
    }
  }

  // Logout function
  const logout = async () => {
    isLoading.value = true
    try {
      const currentUserEmail = user.value?.email || 'unknown'
      await apiClient.post('/auth/logout')
      logger.auth.logout(currentUserEmail)
      user.value = null
      clearCache()
      await navigateTo('/login')
  } catch (error) {
    logger.error('ログアウトエラー:', error)
      // Force logout even if API call fails
      user.value = null
      clearCache()
      await navigateTo('/login')
    } finally {
      isLoading.value = false
    }
  }

  // Get current user (with cache support)
  const getCurrentUser = async (forceRefresh = false): Promise<AuthUser | null> => {
    try {
      // If not forcing refresh and user is already loaded, return it
      if (!forceRefresh && user.value) {
        logger.debug('リアクティブ状態からキャッシュユーザーを返します:', user.value.email)
        return user.value
      }

      // Server-side: use session utilities directly
      if (import.meta.server) {
        logger.debug('サーバーサイドgetCurrentUserが呼び出されました')
        try {
          // Import server utilities dynamically
          const { getCurrentUserFromEvent } = await import('~/server/utils/session')
          const event = useRequestEvent()
          
          if (!event) {
            logger.warn('サーバーサイドでrequestイベントが利用できません')
            return null
          }
          
          const authUser = await getCurrentUserFromEvent(event)
          
          if (authUser) {
            user.value = authUser
            logger.info('サーバーサイドsessionからユーザー認証しました:', authUser.email)
            return authUser
          }
          
          logger.debug('サーバーサイドで有効なsessionが見つかりませんでした')
          user.value = null
          return null
        } catch (error) {
          logger.error('サーバーサイドgetCurrentUserエラー:', error)
          user.value = null
          return null
        }
      }

      // Client-side: use cache and API
      // Try to load from sessionStorage cache first (if not forcing refresh)
      if (!forceRefresh) {
        const cachedUser = loadFromCache()
        if (cachedUser) {
          user.value = cachedUser
          logger.info('キャッシュからユーザーを読み込みました:', cachedUser.email)
          return cachedUser
        }
      }

      // Fetch from API
      logger.debug('APIから現在のユーザーを取得中...')
      const response = await apiClient.get<AuthUser>('/auth/me')
      logger.debug('認証チェックレスポンス:', response)
      
      if (response?.data) {
        user.value = response.data
        saveToCache(response.data)
        logger.info('APIからユーザー認証しました:', response.data.email)
        return response.data
      }
      
      logger.warn('レスポンスに有効なユーザーデータがありません')
      // Clear cache if API says no user
      user.value = null
      clearCache()
      return null
    } catch (error: any) {
      // 401エラー（未認証）は正常な動作なのでinfoレベル
      if (error?.statusCode === 401 || error?.status === 401) {
        logger.info('ユーザーが未認証です')
      } else {
        // その他のエラーは実際のエラーなのでerrorレベル
        logger.error('現在のユーザー取得でエラーが発生しました:', error?.message || error)
      }
      
      // On API error, clear cache to be safe
      user.value = null
      clearCache()
      return null
    }
  }

  // Change password
  const changePassword = async (passwordData: ChangePasswordRequest): Promise<boolean> => {
    isLoading.value = true
    try {
      await apiClient.post('/auth/change-password', passwordData)
      return true
    } catch (error) {
      logger.error('パスワード変更エラー:', error)
      return false
    } finally {
      isLoading.value = false
    }
  }

  // Check if user has permission
  const hasPermission = (permission: string): boolean => {
    return user.value?.permissions.includes(permission) ?? false
  }

  // Check if user is in group
  const hasGroup = (group: string): boolean => {
    return user.value?.groups.includes(group) ?? false
  }

  // Check if user is admin
  const isAdmin = computed(() => hasGroup('administrator'))

  // Initialize auth state on app start
  const initAuth = async (): Promise<void> => {
    logger.info('=== 認証初期化開始 ===')
    logger.info('環境:', {
      client: import.meta.client,
      server: import.meta.server,
      isInitialized: isInitialized.value
    })
    
    if (import.meta.client && !isInitialized.value) {
      logger.info('クライアントサイド認証初期化を開始します...')
      
      try {
        // Check if server-side auth user is available in payload
        const nuxtApp = useNuxtApp()
        const serverAuthUser = nuxtApp.payload.authUser as AuthUser | undefined
        logger.info('サーバーpayload authUser:', serverAuthUser ? `存在: ${serverAuthUser.email}` : '存在しません')
        
        if (serverAuthUser) {
          user.value = serverAuthUser
          saveToCache(serverAuthUser)
          logger.success('サーバーpayloadから認証を初期化しました:', serverAuthUser.email)
        } else {
          // Fallback to cache if no server data
          logger.info('サーバーpayloadがありません、キャッシュを確認中...')
          const cachedUser = loadFromCache()
          if (cachedUser) {
            user.value = cachedUser
            logger.success('キャッシュから認証を初期化しました:', cachedUser.email)
          } else {
            logger.info('キャッシュされたユーザーが見つかりませんでした')
          }
        }
        
        // Always verify with server (but don't block UI for cache/payload users)
        // This ensures cache is up-to-date with server state
        if (!serverAuthUser) {
          logger.info('サーバーで検証中（強制更新）...')
          const currentUser = await getCurrentUser(true) // force refresh
          
          if (currentUser) {
            logger.success('認証を初期化してサーバーで検証しました:', currentUser.email)
          } else {
            logger.info('サーバー検証で認証されたユーザーが見つかりませんでした')
          }
        } else {
          logger.info('サーバー検証をスキップ - サーバーpayloadデータを使用')
        }
      } catch (error) {
        logger.error('認証初期化エラー:', error)
      } finally {
        isInitialized.value = true
        logger.success('=== 認証初期化完了 ===')
        logger.info('最終認証状態:', {
          isAuthenticated: isAuthenticated.value,
          isAdmin: isAdmin.value,
          userEmail: user.value?.email || 'ユーザーなし'
        })
      }
    } else if (import.meta.server) {
      logger.info('サーバーサイドでinitAuthをスキップします')
    } else if (isInitialized.value) {
      logger.info('認証は既に初期化済み、スキップします')
    }
  }



  return {
    user,
    isAuthenticated,
    isLoading,
    isInitialized,
    isAdmin,
    login,
    logout,
    getCurrentUser,
    changePassword,
    hasPermission,
    hasGroup,
    initAuth
  }
}