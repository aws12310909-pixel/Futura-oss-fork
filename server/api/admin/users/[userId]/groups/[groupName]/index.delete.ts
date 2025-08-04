import { removeUserFromGroup } from '~/server/utils/cognito-groups'
import { requireAdministrator } from '~/server/utils/auth'
import { getUserEmailById } from '~/server/utils/user-helpers'
import type { ApiResponse } from '~/types'

export default defineEventHandler(async (event): Promise<ApiResponse<void>> => {
  try {
    // administrator権限チェック
    await requireAdministrator(event)

    const userId = getRouterParam(event, 'userId')
    const groupName = getRouterParam(event, 'groupName')

    if (!userId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'User ID is required'
      })
    }

    if (!groupName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Group name is required'
      })
    }

    // DynamoDBからuser_idでユーザーのemailを取得
    const userEmail = await getUserEmailById(userId)
    
    // Cognitoグループ削除（emailを使用）
    await removeUserFromGroup(userEmail, groupName)

    return {
      success: true,
      message: `User successfully removed from group: ${groupName}`
    }
  } catch (error: any) {
    console.error(`Failed to remove user ${getRouterParam(event, 'userId')} from group ${getRouterParam(event, 'groupName')}:`, error)

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
      statusMessage: 'Failed to remove user from group'
    })
  }
})