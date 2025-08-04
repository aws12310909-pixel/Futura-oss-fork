import { deleteCognitoGroup } from '~/server/utils/cognito-groups'
import { requireAdministrator } from '~/server/utils/auth'
import type { ApiResponse } from '~/types'

export default defineEventHandler(async (event): Promise<ApiResponse<void>> => {
  try {
    // administrator権限チェック
    await requireAdministrator(event)

    const groupName = getRouterParam(event, 'groupName')

    if (!groupName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Group name is required'
      })
    }

    // administratorグループの削除を防ぐ
    if (groupName === 'administrator') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot delete the administrator group'
      })
    }

    await deleteCognitoGroup(groupName)

    return {
      success: true,
      message: 'Group deleted successfully'
    }
  } catch (error: any) {
    console.error(`Failed to delete group ${getRouterParam(event, 'groupName')}:`, error)

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
      statusMessage: 'Failed to delete group'
    })
  }
})