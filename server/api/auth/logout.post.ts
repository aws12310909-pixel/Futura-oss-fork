import { invalidateSession } from '~/server/utils/session'
import { useLogger } from '~/composables/useLogger'

const logger = useLogger({ prefix: '[API-LOGOUT]' })

export default defineEventHandler(async (event) => {
  try {
    const sessionId = getCookie(event, 'session_id')
    
    // Invalidate session in DynamoDB if session exists
    if (sessionId) {
      try {
        await invalidateSession(sessionId, 'revoked')
      } catch (error) {
        // Log error but continue with logout process
        logger.error('DynamoDBでのセッション無効化に失敗:', error)
      }
    }
    
    // Clear session cookies
    deleteCookie(event, 'session_id')
    deleteCookie(event, 'access_token') // Remove legacy cookie if exists

    return {
      success: true,
      message: 'Logged out successfully'
    }
  } catch (error: unknown) {
    logger.error('ログアウトエラー:', error)
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})