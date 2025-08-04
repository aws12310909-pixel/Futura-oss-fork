import { validateSession } from '~/server/utils/session'
import { useLogger } from '~/composables/useLogger'

const logger = useLogger({ prefix: '[API-AUTH-ME]' })

export default defineEventHandler(async (event) => {
  logger.debug('/api/auth/me が呼び出されました')
  try {
    const sessionId = getCookie(event, 'session_id')
    logger.debug('cookieからのセッションID:', sessionId ? '***存在***' : '見つかりません')
    
    if (!sessionId) {
      logger.warn('セッションIDのcookieが見つかりません')
      throw createError({
        statusCode: 401,
        statusMessage: 'Not authenticated'
      })
    }

    // validateSessionが既にCognitoからユーザー情報を取得・検証済み
    logger.debug('セッションを検証中...')
    const authUser = await validateSession(sessionId)
    
    if (!authUser) {
      logger.warn('セッション検証に失敗しました')
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid session'
      })
    }

    logger.info('ユーザーのセッション検証が成功しました:', authUser.email)
    return {
      success: true,
      data: authUser
    }
  } catch (error: unknown) {
    logger.error('現在のユーザー取得エラー:', error)

    // Clear invalid cookies
    deleteCookie(event, 'session_id')
    deleteCookie(event, 'access_token')
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication failed'
    })
  }
})