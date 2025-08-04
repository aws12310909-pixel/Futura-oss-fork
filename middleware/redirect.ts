export default defineNuxtRouteMiddleware(async (to) => {
  const logger = useLogger({ prefix: '[REDIRECT-MIDDLEWARE]' })
  const { isAuthenticated, getCurrentUser, isAdmin, isInitialized, initAuth } = useAuth()
  
  logger.info('=== リダイレクトミドルウェア開始 ===')
  logger.info('ターゲットパス:', to.path)
  logger.info('サーバーサイド:', import.meta.server)
  logger.info('初期状態:', {
    isAuthenticated: isAuthenticated.value,
    isAdmin: isAdmin.value,
    isInitialized: isInitialized.value
  })
  
  // Skip redirect check on server side (SSR)
  if (import.meta.server) {
    logger.debug('サーバーサイドでリダイレクトミドルウェアをスキップします')
    return
  }
  
  // Ensure auth is initialized before proceeding (シリアル実行)
  if (!isInitialized.value) {
    logger.info('認証未初期化のため、初期化を実行します...')
    try {
      await initAuth()
      logger.success('ミドルウェアでの認証初期化が完了しました')
    } catch (error) {
      logger.error('ミドルウェアでの認証初期化に失敗しました:', error)
    }
  } else {
    logger.info('認証は既に初期化済みです')
  }
  
  logger.info('初期化後の状態:', {
    isAuthenticated: isAuthenticated.value,
    isAdmin: isAdmin.value,
    isInitialized: isInitialized.value
  })
  
  // If not authenticated after initialization, try to get current user
  if (!isAuthenticated.value) {
    logger.info('ユーザーが認証されていません、現在のユーザー取得を試行中...')
    const user = await getCurrentUser()
    logger.info('getCurrentUser結果:', user ? `ユーザー: ${user.email}` : 'ユーザーが見つかりません')
    
    // If still no user after check, redirect to login
    if (!user) {
      // 匿名ユーザーの場合、どこであれloginにリダイレクト
      if (to.path !== '/login') {
        logger.info('匿名ユーザーをログインにリダイレクトします、元のパス:', to.path)
        return navigateTo('/login')
      }
      logger.debug('既にログインページにいます、リダイレクトは不要です')
      return
    }
  }
  
  // ここから先は認証済みユーザーの処理
  if (isAuthenticated.value) {
    logger.info('ユーザーが認証されています、リダイレクトルールを確認中...')
    
    // 管理者の場合のリダイレクトルール
    if (isAdmin.value) {
      logger.info('ユーザーは管理者です、管理者リダイレクトルールを適用中')
      // ログインページにいるなら/adminにリダイレクト
      if (to.path === '/login') {
        logger.info('管理者をログインから/adminにリダイレクトします')
        return navigateTo('/admin')
      }
      // トップページにいるなら/adminにリダイレクト
      if (to.path === '/') {
        logger.info('管理者を/から/adminにリダイレクトします')
        return navigateTo('/admin')
      }
    } else {
      logger.info('ユーザーは一般ユーザーです、ユーザーリダイレクトルールを適用中')
      // 一般ユーザーの場合のリダイレクトルール
      // ログインページにいるなら/dashboardにリダイレクト
      if (to.path === '/login') {
        logger.info('ユーザーをログインから/dashboardにリダイレクトします')
        return navigateTo('/dashboard')
      }
      // /adminにアクセスした場合（権限が不足しているので）/dashboardにリダイレクト
      if (to.path.startsWith('/admin')) {
        logger.info('ユーザーをadminから/dashboardにリダイレクトします（権限不足）')
        return navigateTo('/dashboard')
      }
      // トップページにいるなら/dashboardにリダイレクト
      if (to.path === '/') {
        logger.info('ユーザーを/から/dashboardにリダイレクトします')
        return navigateTo('/dashboard')
      }
    }
  }
  
  logger.info('=== リダイレクトミドルウェア終了（リダイレクトなし） ===')
})