import { updateCognitoGroup } from '~/server/utils/cognito-groups'
import { requireAdministrator } from '~/server/utils/auth'
import { getDynamoDBService } from '~/server/utils/dynamodb'
import { validatePermissions } from '~/server/utils/permission-definitions'
import { useLogger } from '~/composables/useLogger'
import type { ApiResponse, CognitoGroup, GroupUpdateForm } from '~/types'

export default defineEventHandler(async (event): Promise<ApiResponse<CognitoGroup>> => {
  const logger = useLogger({ prefix: '[AdminUpdateGroup]' })
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

    const body = await readBody<GroupUpdateForm>(event)

    // 少なくとも1つのフィールドが更新されることを確認
    if (!body.description && body.precedence === undefined && !body.permissions) {
      throw createError({
        statusCode: 400,
        statusMessage: 'At least one field (description, precedence, or permissions) must be provided'
      })
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

    const groupData: GroupUpdateForm = {
      description: body.description?.trim(),
      precedence: body.precedence,
      permissions: body.permissions
    }

    const group = await updateCognitoGroup(groupName, groupData)

    // 権限が指定されている場合はpermissionsテーブルを更新
    if (body.permissions !== undefined) {
      const dynamodb = getDynamoDBService()
      const permissionsTableName = dynamodb.getTableName('permissions')
      
      if (body.permissions.length === 0) {
        // 権限を空にする場合はレコードを削除
        try {
          await dynamodb.delete(permissionsTableName, { group_name: groupName })
          logger.info(`グループ権限を削除しました: ${groupName}`)
        } catch (error) {
          // レコードが存在しない場合は無視
          logger.info(`グループ権限レコードが見つかりませんでした: ${groupName}`)
        }
      } else {
        // 既存の権限レコードを取得
        const existingPermission = await dynamodb.get(permissionsTableName, { group_name: groupName })
        
        const permissionRecord = {
          group_name: groupName,
          permissions: body.permissions,
          description: body.description?.trim() || existingPermission?.description || '',
          created_at: existingPermission?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        await dynamodb.put(permissionsTableName, permissionRecord)
        logger.info(`グループ権限を更新しました: ${groupName}`)
      }
    }

    return {
      success: true,
      data: group,
      message: 'Group updated successfully'
    }
  } catch (error: any) {
    console.error(`Failed to update group ${getRouterParam(event, 'groupName')}:`, error)

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
      statusMessage: 'Failed to update group'
    })
  }
})