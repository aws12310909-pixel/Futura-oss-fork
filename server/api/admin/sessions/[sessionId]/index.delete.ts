import { invalidateSession, getSessionDetails } from '~/server/utils/session'
import { requireAdministrator } from '~/server/utils/auth'
import type { ApiResponse } from '~/types'

export default defineEventHandler(async (event): Promise<ApiResponse<void>> => {
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

    // セッションの存在確認
    const session = await getSessionDetails(sessionId)

    if (!session) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Session not found'
      })
    }

    // 既に無効化済みの場合のチェック
    if (session.status !== 'active') {
      throw createError({
        statusCode: 400,
        statusMessage: `Session is already ${session.status}`
      })
    }

    // セッションを強制無効化
    await invalidateSession(sessionId, 'revoked')

    return {
      success: true,
      message: 'Session revoked successfully'
    }
  } catch (error: any) {
    console.error(`Failed to revoke session ${getRouterParam(event, 'sessionId')}:`, error)

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
      statusMessage: 'Failed to revoke session'
    })
  }
})