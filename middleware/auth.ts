export default defineNuxtRouteMiddleware(async (to, from) => {
  const logger = useLogger({ prefix: '[AUTH-MIDDLEWARE]' })
  
  logger.debug('認証ミドルウェアが開始されました、パス:', to.path, 'サイド:', import.meta.client ? 'client' : 'server')
  
  // Skip auth check for login page
  if (to.path === '/login') {
    logger.debug('ログインページの認証チェックをスキップします')
    return
  }

  // Extract auth options from page meta
  const requireAdmin = to.meta?.requireAdmin === true

  // Server-side authentication check using cookies
  if (import.meta.server) {
    logger.debug('サーバーサイド認証チェックを実行中...')
    
    try {
      logger.info('ステップ1: サーバーサイド認証チェックを開始...')
      
      // Import server utilities dynamically on server side
      logger.info('ステップ2: sessionユーティリティの動的インポートを試行中...')
      const { getCurrentUserFromEvent } = await import('~/server/utils/session')
      logger.success('ステップ2: 動的インポートが成功しました')
      
      logger.info('ステップ3: requestイベントを取得中...')
      const event = useRequestEvent()
      logger.info('ステップ3: requestイベント結果:', event ? '見つかりました' : '見つかりません')
      
      if (!event) {
        logger.error('サーバーサイドでrequestイベントが利用できません')
        throw createError({
          statusCode: 500,
          statusMessage: 'Internal server error'
        })
      }
      
      logger.info('ステップ4: getCurrentUserFromEventを呼び出し中...')
      const authUser = await getCurrentUserFromEvent(event)
      logger.info('ステップ4: getCurrentUserFromEvent結果:', authUser ? `ユーザー: ${authUser.email}` : 'ユーザーなし')
      
      if (!authUser) {
        logger.warn('サーバーサイドで有効なsessionが見つかりません')
        
        // セッションCookieをクリア
        const { clearSessionCookie } = await import('~/server/utils/session')
        clearSessionCookie(event)
        
        throw createError({
          statusCode: 401,
          statusMessage: 'Session invalid or expired - Please login again'
        })
      }

      // Check admin privileges if required
      logger.info('ステップ5: 管理者権限をチェック中...', { requireAdmin, userGroups: authUser.groups })
      if (requireAdmin && !authUser.groups.includes('administrator')) {
        logger.warn('管理者権限が必要です:', to.path)
        throw createError({
          statusCode: 403,
          statusMessage: 'Admin privileges required'
        })
      }

      logger.info('ステップ6: Nuxtアプリインスタンスを取得中...')
      const nuxtApp = useNuxtApp()
      logger.info('ステップ6: Nuxtアプリインスタンスを取得しました')
      
      logger.info('ステップ7: payloadに認証ユーザーを設定中...')
      nuxtApp.payload.authUser = authUser
      logger.success('ステップ7: payloadに認証ユーザーを正常に設定しました')

      logger.success('サーバーサイド認証が成功しました、ユーザー:', authUser.email)
      return
    } catch (error) {
      logger.error('=== サーバーサイド認証エラー ===')
      logger.error('エラータイプ:', typeof error)
      logger.error('エラーメッセージ:', error instanceof Error ? error.message : String(error))
      logger.error('エラースタック:', error instanceof Error ? error.stack : 'スタックトレースなし')
      logger.error('エラーオブジェクト:', JSON.stringify(error, null, 2))
      
      // For auth errors, throw the error (will show error page or redirect)
      if (error && typeof error === 'object' && 'statusCode' in error) {
        logger.error('ステータスコード付きcreateErrorを再スロー:', (error as any).statusCode)
        throw error
      }
      
      logger.error('新しい認証エラーを作成中（401）')
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication failed'
      })
    }
  }

  // Client-side authentication check
  const { isAuthenticated, getCurrentUser, isAdmin } = useAuth()

  logger.debug('現在の認証状態:', { isAuthenticated: isAuthenticated.value })
  
  // If not authenticated, try to get current user from server
  if (!isAuthenticated.value) {
    logger.debug('ミドルウェアでユーザーが認証されていません、サーバーを確認中...')
    const user = await getCurrentUser()
    
    // If still not authenticated after server check, redirect to login
    if (!user) {
      logger.warn('有効なsessionが見つかりません、ログインにリダイレクトします、元のパス:', to.path)
      return navigateTo('/login')
    }
    
    logger.info('ミドルウェアでユーザーが認証されました:', user.email)
  }

  // Check admin privileges if required (client-side)
  if (requireAdmin && !isAdmin.value) {
    logger.warn('管理者権限が必要です:', to.path, 'ダッシュボードにリダイレクトします')
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin privileges required'
    })
  }

  logger.debug('クライアントサイド認証チェックが正常に完了しました')
})