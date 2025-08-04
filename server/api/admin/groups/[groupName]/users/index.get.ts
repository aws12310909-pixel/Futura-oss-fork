import { requireAdministrator } from '~/server/utils/auth'
import { listUsersInGroup } from '~/server/utils/cognito-groups'

export default defineEventHandler(async (event) => {
  try {
    // 管理者権限チェック
    await requireAdministrator(event)
    
    const groupName = getRouterParam(event, 'groupName')
    
    if (!groupName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Group name is required'
      })
    }
    
    // Cognitoからグループのユーザー一覧を取得
    const users = await listUsersInGroup(groupName)
    
    return {
      success: true,
      data: {
        users,
        count: users.length
      },
      message: `Group '${groupName}' users retrieved successfully`
    }
  } catch (error: any) {
    console.error('Failed to get group users:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to retrieve group users'
    })
  }
})