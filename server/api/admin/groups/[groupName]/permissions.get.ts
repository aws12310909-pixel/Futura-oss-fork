import { requireAdministrator } from '~/server/utils/auth'
import { getDynamoDBService } from '~/server/utils/dynamodb'
import type { ApiResponse } from '~/types'

export default defineEventHandler(async (event): Promise<ApiResponse<{ permissions: string[] }>> => {
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

    const dynamodb = getDynamoDBService()
    const permissionsTableName = dynamodb.getTableName('permissions')
    
    try {
      const permissionRecord = await dynamodb.get(permissionsTableName, { group_name: groupName })
      
      return {
        success: true,
        data: {
          permissions: permissionRecord?.permissions || []
        }
      }
    } catch (error) {
      // Group has no permissions set
      return {
        success: true,
        data: {
          permissions: []
        }
      }
    }

  } catch (error: any) {
    console.error(`Failed to get permissions for group ${getRouterParam(event, 'groupName')}:`, error)

    // 認証/認可エラーはそのまま投げる
    if (error.statusCode === 401 || error.statusCode === 403) {
      throw error
    }

    // バリデーションエラーもそのまま投げる
    if (error.statusCode === 400) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get group permissions'
    })
  }
})