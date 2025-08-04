import { addUserToGroup } from '~/server/utils/cognito-groups'
import { requireAdministrator } from '~/server/utils/auth'
import { getUserEmailById } from '~/server/utils/user-helpers'
import type { ApiResponse, UserGroupRequest } from '~/types'

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

    const body = await readBody<{ groupName: string }>(event)

    if (!body.groupName || body.groupName.trim() === '') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Group name is required'
      })
    }

    // DynamoDBからuser_idでユーザーのemailを取得
    const userEmail = await getUserEmailById(userId)
    
    // Cognitoグループ追加（emailを使用）
    await addUserToGroup(userEmail, body.groupName.trim())

    return {
      success: true,
      message: `User successfully added to group: ${body.groupName}`
    }
  } catch (error: any) {
    console.error(`Failed to add user ${getRouterParam(event, 'userId')} to group:`, error)

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
      statusMessage: 'Failed to add user to group'
    })
  }
})