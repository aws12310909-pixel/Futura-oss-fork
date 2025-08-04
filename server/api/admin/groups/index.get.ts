import { listCognitoGroups } from '~/server/utils/cognito-groups'
import { requireAdministrator } from '~/server/utils/auth'
import { useLogger } from '~/composables/useLogger'
import type { ApiResponse, CognitoGroup } from '~/types'

export default defineEventHandler(async (event): Promise<ApiResponse<CognitoGroup[]>> => {
  const logger = useLogger({ prefix: '[AdminGroupsGet]' })
  try {
    // administrator権限チェック
    await requireAdministrator(event)

    const groups = await listCognitoGroups()

    return {
      success: true,
      data: groups,
      message: 'Groups retrieved successfully'
    }
  } catch (error: any) {
    logger.error('グループ取得に失敗:', error)

    // 認証/認可エラーはそのまま投げる
    if (error.statusCode === 401 || error.statusCode === 403) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve groups'
    })
  }
})