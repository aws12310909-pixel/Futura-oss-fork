import { createCognitoGroup } from '~/server/utils/cognito-groups'
import { requireAdministrator } from '~/server/utils/auth'
import { getDynamoDBService } from '~/server/utils/dynamodb'
import { validatePermissions } from '~/server/utils/permission-definitions'
import { useLogger } from '~/composables/useLogger'
import type { ApiResponse, CognitoGroup, GroupCreateForm } from '~/types'

export default defineEventHandler(async (event): Promise<ApiResponse<CognitoGroup>> => {
  const logger = useLogger({ prefix: '[AdminCreateGroup]' })
  try {
    // administrator権限チェック
    await requireAdministrator(event)

    const body = await readBody<GroupCreateForm>(event)

    // バリデーション
    if (!body.groupName || body.groupName.trim() === '') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Group name is required'
      })
    }

    // グループ名の検証（英数字、ハイフン、アンダースコアのみ）
    if (!/^[a-zA-Z0-9_-]+$/.test(body.groupName)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Group name can only contain letters, numbers, hyphens, and underscores'
      })
    }

    const groupData: GroupCreateForm = {
      groupName: body.groupName.trim(),
      description: body.description?.trim(),
      precedence: body.precedence,
      permissions: body.permissions
    }

    // 権限のバリデーション
    if (body.permissions && body.permissions.length > 0) {
      const { invalid } = validatePermissions(body.permissions)
      
      if (invalid.length > 0) {
        throw createError({
          statusCode: 400,
          statusMessage: `Invalid permissions: ${invalid.join(', ')}`
        })
      }
    }

    const group = await createCognitoGroup(groupData)

    // 権限がある場合はpermissionsテーブルに保存
    if (body.permissions && body.permissions.length > 0) {
      const dynamodb = getDynamoDBService()
      const permissionsTableName = dynamodb.getTableName('permissions')
      
      const permissionRecord = {
        group_name: body.groupName.trim(),
        permissions: body.permissions,
        description: body.description?.trim() || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      await dynamodb.put(permissionsTableName, permissionRecord)
      logger.info(`グループ権限を作成しました: ${body.groupName}`)
    }

    return {
      success: true,
      data: group,
      message: 'Group created successfully'
    }
  } catch (error: any) {
    logger.error('グループ作成に失敗:', error)

    // 認証/認可エラーはそのまま投げる
    if (error.statusCode === 401 || error.statusCode === 403) {
      throw error
    }

    // バリデーションエラーやCognitoエラーもそのまま投げる
    if (error.statusCode === 400 || error.statusCode === 409) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create group'
    })
  }
})