import { getUserSessions } from '~/server/utils/session'
import { requireAdministrator } from '~/server/utils/auth'
import type { ApiResponse, Session } from '~/types'

export default defineEventHandler(async (event): Promise<ApiResponse<Session[]>> => {
  try {
    // administrator権限チェック
    await requireAdministrator(event)

    const userId = getRouterParam(event, 'userId')

    if (!userId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'User ID is required'
      })
    }

    const sessions = await getUserSessions(userId)

    // 機密情報を除去（トークンを含まない）
    const safeSessions = sessions.map(session => ({
      ...session,
      cognito_access_token: '[REDACTED]',
      cognito_id_token: '[REDACTED]',
      cognito_refresh_token: session.cognito_refresh_token ? '[REDACTED]' : undefined
    }))

    return {
      success: true,
      data: safeSessions,
      message: 'User sessions retrieved successfully'
    }
  } catch (error: any) {
    console.error(`Failed to get sessions for user ${getRouterParam(event, 'userId')}:`, error)

    // 認証/認可エラーはそのまま投げる
    if (error.statusCode === 401 || error.statusCode === 403) {
      throw error
    }

    // バリデーションエラーや404エラーもそのまま投げる
    if (error.statusCode === 400 || error.statusCode === 404) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve user sessions'
    })
  }
})