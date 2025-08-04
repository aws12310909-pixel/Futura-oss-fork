import { getSessionDetails } from '~/server/utils/session'
import { requireAdministrator } from '~/server/utils/auth'
import type { ApiResponse, Session } from '~/types'

export default defineEventHandler(async (event): Promise<ApiResponse<Session>> => {
  try {
    // administrator権限チェック
    await requireAdministrator(event)

    const sessionId = getRouterParam(event, 'sessionId')

    if (!sessionId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Session ID is required'
      })
    }

    const session = await getSessionDetails(sessionId)

    if (!session) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Session not found'
      })
    }

    // 機密情報を除去（トークンを含まない）
    const safeSession = {
      ...session,
      cognito_access_token: '[REDACTED]',
      cognito_id_token: '[REDACTED]',
      cognito_refresh_token: session.cognito_refresh_token ? '[REDACTED]' : undefined
    }

    return {
      success: true,
      data: safeSession,
      message: 'Session retrieved successfully'
    }
  } catch (error: any) {
    console.error(`Failed to get session ${getRouterParam(event, 'sessionId')}:`, error)

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
      statusMessage: 'Failed to retrieve session'
    })
  }
})