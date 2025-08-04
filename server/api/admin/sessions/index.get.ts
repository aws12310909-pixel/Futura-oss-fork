import { getAllSessions, getActiveSessionCount } from '~/server/utils/session'
import { requireAdministrator } from '~/server/utils/auth'
import type { ApiResponse, Session } from '~/types'

export default defineEventHandler(async (event): Promise<ApiResponse<{
  sessions: Session[]
  totalCount: number
  activeCount: number
}>> => {
  try {
    // administrator権限チェック
    await requireAdministrator(event)

    const query = getQuery(event)
    const status = query.status as 'active' | 'expired' | 'revoked' | undefined
    const limit = query.limit ? Number(query.limit) : undefined

    // セッション一覧を取得
    const sessions = await getAllSessions({ status, limit })
    
    // アクティブセッション数を取得
    const activeCount = await getActiveSessionCount()

    // 機密情報を除去（トークンを含まない）
    const safeSessions = sessions.map(session => ({
      ...session,
      cognito_access_token: '[REDACTED]',
      cognito_id_token: '[REDACTED]',
      cognito_refresh_token: session.cognito_refresh_token ? '[REDACTED]' : undefined
    }))

    return {
      success: true,
      data: {
        sessions: safeSessions,
        totalCount: safeSessions.length,
        activeCount
      },
      message: 'Sessions retrieved successfully'
    }
  } catch (error: any) {
    console.error('Failed to get sessions:', error)

    // 認証/認可エラーはそのまま投げる
    if (error.statusCode === 401 || error.statusCode === 403) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve sessions'
    })
  }
})