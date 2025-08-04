import { invalidateAllUserSessions } from '~/server/utils/session'
import { requireAdministrator } from '~/server/utils/auth'
import type { ApiResponse } from '~/types'

export default defineEventHandler(async (event): Promise<ApiResponse<void>> => {
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

    // ユーザーの全セッションを無効化
    await invalidateAllUserSessions(userId)

    return {
      success: true,
      message: 'All user sessions revoked successfully'
    }
  } catch (error: any) {
    console.error(`Failed to revoke all sessions for user ${getRouterParam(event, 'userId')}:`, error)

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
      statusMessage: 'Failed to revoke user sessions'
    })
  }
})