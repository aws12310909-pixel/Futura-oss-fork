import { getCognitoGroups } from '~/server/utils/cognito-groups'
import { requireAdministrator } from '~/server/utils/auth'
import { getUserEmailById } from '~/server/utils/user-helpers'
import type { ApiResponse } from '~/types'

export default defineEventHandler(async (event): Promise<ApiResponse<string[]>> => {
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

    // DynamoDBからuser_idでユーザーのemailを取得
    const userEmail = await getUserEmailById(userId)
    
    // Cognitoグループ取得（emailを使用）
    const groups = await getCognitoGroups(userEmail)

    return {
      success: true,
      data: groups,
      message: 'User groups retrieved successfully'
    }
  } catch (error: any) {
    console.error(`Failed to get groups for user ${getRouterParam(event, 'userId')}:`, error)

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
      statusMessage: 'Failed to retrieve user groups'
    })
  }
})