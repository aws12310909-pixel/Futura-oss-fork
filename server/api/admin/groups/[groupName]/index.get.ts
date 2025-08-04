import { getCognitoGroup } from '~/server/utils/cognito-groups'
import { requireAdministrator } from '~/server/utils/auth'
import type { ApiResponse, CognitoGroup } from '~/types'

export default defineEventHandler(async (event): Promise<ApiResponse<CognitoGroup>> => {
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

    const group = await getCognitoGroup(groupName)

    if (!group) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Group not found'
      })
    }

    return {
      success: true,
      data: group,
      message: 'Group retrieved successfully'
    }
  } catch (error: any) {
    console.error(`Failed to get group ${getRouterParam(event, 'groupName')}:`, error)

    // 認証/認可エラーはそのまま投げる
    if (error.statusCode === 401 || error.statusCode === 403) {
      throw error
    }

    // 404エラーもそのまま投げる
    if (error.statusCode === 404) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve group'
    })
  }
})