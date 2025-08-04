import { getDynamoDBService } from '~/server/utils/dynamodb'
import { useLogger } from '~/composables/useLogger'
import { DEFAULT_GROUP_PERMISSIONS } from '~/server/utils/permission-definitions'
import type { Permission } from '~/types'

const logger = useLogger({ prefix: '[PermissionHelpers]' })

/**
 * ユーザーのグループリストから動的に権限を取得
 * @param groups ユーザーが所属するCognitoグループのリスト
 * @returns マージされた権限リスト
 */
export async function getUserPermissionsByGroups(groups: string[]): Promise<string[]> {
  if (!groups || groups.length === 0) {
    logger.warn('グループが指定されていません')
    return []
  }

  try {
    const dynamodb = getDynamoDBService()
    const permissionsTableName = dynamodb.getTableName('permissions')
    
    logger.info(`グループの権限を取得中: ${groups.join(', ')}`)
    
    // 各グループの権限を並列で取得
    const permissionPromises = groups.map(async (groupName) => {
      try {
        const result = await dynamodb.get(permissionsTableName, { group_name: groupName })
        const permissions = result?.permissions || []
        logger.debug(`グループ "${groupName}" の権限: ${permissions.length}個`)
        return permissions
      } catch (error) {
        logger.warn(`グループ "${groupName}" の権限取得に失敗:`, error)
        return []
      }
    })

    // 全ての権限を取得
    const allPermissions = await Promise.all(permissionPromises)
    
    // 権限をマージして重複を排除
    const mergedPermissions = [...new Set(allPermissions.flat())]
    
    logger.success(`権限取得完了: ${mergedPermissions.length}個の権限をマージしました`)
    logger.debug('マージされた権限:', mergedPermissions)
    
    return mergedPermissions
  } catch (error) {
    logger.error('権限取得でエラーが発生:', error)
    // エラー時はフォールバック権限を返す
    return getDefaultPermissions(groups)
  }
}

/**
 * 指定されたグループの権限を取得
 * @param groupName グループ名
 * @returns そのグループの権限リスト
 */
export async function getGroupPermissions(groupName: string): Promise<string[]> {
  try {
    const dynamodb = getDynamoDBService()
    const permissionsTableName = dynamodb.getTableName('permissions')
    
    const result = await dynamodb.get(permissionsTableName, { group_name: groupName })
    return result?.permissions || []
  } catch (error) {
    logger.error(`グループ "${groupName}" の権限取得に失敗:`, error)
    return []
  }
}

/**
 * グループの権限を更新
 * @param groupName グループ名
 * @param permissions 権限リスト
 * @param description グループ説明
 */
export async function updateGroupPermissions(
  groupName: string, 
  permissions: string[], 
  description?: string
): Promise<void> {
  try {
    const dynamodb = getDynamoDBService()
    const permissionsTableName = dynamodb.getTableName('permissions')
    
    const now = new Date().toISOString()
    
    // 既存レコードを取得して更新か新規作成かを判定
    const existingRecord = await dynamodb.get(permissionsTableName, { group_name: groupName })
    
    const permissionRecord: Permission = {
      group_name: groupName,
      permissions,
      description: description || existingRecord?.description || `Permissions for ${groupName} group`,
      created_at: existingRecord?.created_at || now,
      updated_at: now
    }
    
    await dynamodb.put(permissionsTableName, permissionRecord as unknown as Record<string, unknown>)
    logger.success(`グループ "${groupName}" の権限を更新しました`)
  } catch (error) {
    logger.error(`グループ "${groupName}" の権限更新に失敗:`, error)
    throw error
  }
}

/**
 * フォールバック用のデフォルト権限
 * permissionテーブルが利用できない場合の権限
 * permission-definitions.tsの定義を参照
 */
function getDefaultPermissions(groups: string[]): string[] {
  logger.warn('フォールバック権限を使用します')
  
  const isAdmin = groups.includes('administrator')
  
  if (isAdmin) {
    return DEFAULT_GROUP_PERMISSIONS.administrator
  } else {
    return DEFAULT_GROUP_PERMISSIONS.user
  }
}

/**
 * 全権限の一覧を取得（システム管理用）
 */
export async function getAllGroupPermissions(): Promise<Record<string, string[]>> {
  try {
    const dynamodb = getDynamoDBService()
    const permissionsTableName = dynamodb.getTableName('permissions')
    
    const result = await dynamodb.scan(permissionsTableName)
    const permissions: Record<string, string[]> = {}
    
    for (const item of result.items) {
      permissions[item.group_name] = item.permissions || []
    }
    
    return permissions
  } catch (error) {
    logger.error('全権限の取得に失敗:', error)
    return {}
  }
}