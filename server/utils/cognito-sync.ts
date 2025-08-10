import { ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider'
import { createCognitoClient } from './client-factory'
import { getDynamoDBService } from './dynamodb'
import { getCognitoGroups, listCognitoGroups, createCognitoGroup } from './cognito-groups'
import { DEFAULT_GROUP_PERMISSIONS } from './permission-definitions'
import { useLogger } from '~/composables/useLogger'
import type { User } from '~/types'

/**
 * CognitoとDynamoDBの同期を実行
 * 初回デプロイ時や構成変更時に使用
 */
export async function syncCognitoToDatabase(): Promise<{
  users: { synced: number; errors: number }
  permissions: { synced: number; errors: number }
  groups: { synced: number; errors: number }
}> {
  const logger = useLogger({ prefix: '[CognitoSync]' })
  
  logger.info('Cognito同期処理開始')
  
  const syncResults = {
    users: { synced: 0, errors: 0 },
    permissions: { synced: 0, errors: 0 },
    groups: { synced: 0, errors: 0 }
  }
  
  // 1. Usersテーブル同期
  logger.info('Usersテーブル同期開始')
  syncResults.users = await syncUsersFromCognito()
  
  // 2. Permissionsテーブル同期
  logger.info('Permissionsテーブル同期開始')
  syncResults.permissions = await syncPermissionsFromCognito()
  
  // 3. グループ同期
  logger.info('グループ同期開始')
  syncResults.groups = await syncGroupsWithCognito()
  
  logger.info('Cognito同期処理完了:', syncResults)
  return syncResults
}

/**
 * 初回同期が必要かチェックし、必要に応じて実行
 * 管理者ユーザーの初回ログイン時に呼び出し
 */
export async function ensureInitialSync(): Promise<boolean> {
  const logger = useLogger({ prefix: '[InitialSync]' })
  
  try {
    const dynamodb = getDynamoDBService()
    const usersTableName = dynamodb.getTableName('users')
    
    // Usersテーブルが空かチェック
    const usersResult = await dynamodb.scan(usersTableName, { limit: 1 })
    
    if (usersResult.items.length === 0) {
      logger.info('Usersテーブルが空です。初回同期を実行します。')
      await syncCognitoToDatabase()
      logger.info('初回同期が完了しました。')
      return true
    }
    
    logger.debug('Usersテーブルにデータが存在します。初回同期は不要です。')
    return false
    
  } catch (error) {
    logger.error('初回同期チェック中にエラー:', error)
    // エラーが発生してもログイン処理は継続
    return false
  }
}

/**
 * CognitoからUsersテーブルを同期
 */
async function syncUsersFromCognito(): Promise<{ synced: number; errors: number }> {
  const logger = useLogger({ prefix: '[UserSync]' })
  
  try {
    const config = useRuntimeConfig()
    const client = createCognitoClient()
    const dynamodb = getDynamoDBService()
    
    // Cognitoからユーザー一覧を取得
    const command = new ListUsersCommand({
      UserPoolId: config.cognitoUserPoolId as string,
      Limit: 60
    })
    
    const response = await client.send(command)
    
    if (!response.Users) {
      logger.info('Cognitoにユーザーが見つかりません')
      return { synced: 0, errors: 0 }
    }
    
    logger.info(`Cognitoから${response.Users.length}人のユーザーを取得しました`)
    
    const usersTableName = dynamodb.getTableName('users')
    let syncedCount = 0
    let errorsCount = 0
    
    for (const cognitoUser of response.Users) {
      try {
        // ユーザー属性を取得
        const attributes = cognitoUser.Attributes?.reduce((acc, attr) => {
          if (attr.Name && attr.Value) {
            acc[attr.Name] = attr.Value
          }
          return acc
        }, {} as Record<string, string>) || {}
        
        if (!attributes.sub || !attributes.email) {
          logger.warn('無効なCognitoユーザー（sub/emailなし）をスキップしました')
          continue
        }
        
        // グループ情報を取得
        const groups = await getCognitoGroups(attributes.email)
        
        // ステータスをマップ
        let status: 'active' | 'deleted' | 'suspended' = 'active'
        if (cognitoUser.UserStatus === 'FORCE_CHANGE_PASSWORD') {
          status = 'active' // 初回パスワード変更が必要でもactiveとする
        } else if (cognitoUser.UserStatus !== 'CONFIRMED') {
          status = 'suspended'
        }
        
        // Userオブジェクトを作成
        const user: User = {
          user_id: attributes.sub,
          email: attributes.email,
          name: attributes.name || attributes.email,
          status,
          address: '',
          phone_number: '',
          profile_image_url: attributes.picture || undefined,
          profile_approved: false,
          btc_address: '',
          created_at: cognitoUser.UserCreateDate?.toISOString() || new Date().toISOString(),
          updated_at: cognitoUser.UserLastModifiedDate?.toISOString() || new Date().toISOString()
        }
        
        // 既存ユーザーをチェック
        const existingUser = await dynamodb.get(usersTableName, { user_id: user.user_id })
        
        if (!existingUser) {
          // ユーザーが存在しない場合は新規作成
          await dynamodb.put(usersTableName, user as any)
          logger.info(`新規ユーザーを同期しました: ${user.email}`)
          syncedCount++
        } else {
          // 既存ユーザーがある場合は必要に応じて更新
          if (existingUser.status !== user.status || existingUser.name !== user.name) {
            await dynamodb.put(usersTableName, {
              ...existingUser,
              name: user.name,
              status: user.status,
              updated_at: new Date().toISOString()
            })
            logger.info(`既存ユーザーを更新しました: ${user.email}`)
            syncedCount++
          }
        }
      } catch (error) {
        logger.error(`ユーザーの同期中にエラー:`, error)
        errorsCount++
      }
    }
    
    logger.info(`ユーザー同期完了: ${syncedCount}人同期、${errorsCount}件エラー`)
    return { synced: syncedCount, errors: errorsCount }
    
  } catch (error) {
    logger.error('ユーザー同期エラー:', error)
    throw error
  }
}

/**
 * Permissionsテーブルのグループ権限を確認・同期
 */
async function syncPermissionsFromCognito(): Promise<{ synced: number; errors: number }> {
  const logger = useLogger({ prefix: '[PermissionSync]' })
  
  try {
    const dynamodb = getDynamoDBService()
    const permissionsTableName = dynamodb.getTableName('permissions')
    
    // デフォルトグループ権限の定義を使用
    
    const requiredGroups = [
      {
        group_name: 'administrator',
        permissions: DEFAULT_GROUP_PERMISSIONS.administrator,
        description: 'Full system administrator permissions - all features accessible'
      },
      {
        group_name: 'user',
        permissions: DEFAULT_GROUP_PERMISSIONS.user,
        description: 'Standard user permissions for profile and transaction access'
      }
    ]
    
    let syncedCount = 0
    let errorsCount = 0
    
    for (const groupDef of requiredGroups) {
      try {
        // 既存のグループ権限をチェック
        const existingPermission = await dynamodb.get(permissionsTableName, { 
          group_name: groupDef.group_name 
        })
        
        if (!existingPermission) {
          // グループ権限が存在しない場合は作成
          const permissionRecord = {
            group_name: groupDef.group_name,
            permissions: groupDef.permissions,
            description: groupDef.description,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          
          await dynamodb.put(permissionsTableName, permissionRecord)
          logger.info(`グループ権限を作成しました: ${groupDef.group_name}`)
          syncedCount++
        } else {
          // 既存権限と比較して更新が必要かチェック
          const existingPerms = JSON.stringify(existingPermission.permissions?.sort())
          const newPerms = JSON.stringify(groupDef.permissions.sort())
          
          if (existingPerms !== newPerms) {
            const updatedRecord = {
              ...existingPermission,
              permissions: groupDef.permissions,
              description: groupDef.description,
              updated_at: new Date().toISOString()
            }
            
            await dynamodb.put(permissionsTableName, updatedRecord)
            logger.info(`グループ権限を更新しました: ${groupDef.group_name}`)
            syncedCount++
          }
        }
        
      } catch (error) {
        logger.error(`グループ権限同期中にエラー (${groupDef.group_name}):`, error)
        errorsCount++
      }
    }
    
    logger.info(`グループ権限同期完了: ${syncedCount}件同期、${errorsCount}件エラー`)
    return { synced: syncedCount, errors: errorsCount }
    
  } catch (error) {
    logger.error('グループ権限同期エラー:', error)
    throw error
  }
}

/**
 * CognitoとPermissionsテーブル間でグループを双方向同期
 */
async function syncGroupsWithCognito(): Promise<{ synced: number; errors: number }> {
  const logger = useLogger({ prefix: '[GroupSync]' })
  
  try {
    const dynamodb = getDynamoDBService()
    const permissionsTableName = dynamodb.getTableName('permissions')
    
    let syncedCount = 0
    let errorsCount = 0
    
    // 1. Permissionsテーブルから全グループを取得
    logger.info('Permissionsテーブルからグループ一覧を取得中...')
    const permissionGroupsResult = await dynamodb.scan(permissionsTableName)
    const permissionGroups = permissionGroupsResult.items
    const permissionGroupNames = permissionGroups.map((item: any) => item.group_name as string)
    logger.info(`Permissionsテーブルに${permissionGroupNames.length}個のグループが見つかりました: ${permissionGroupNames.join(', ')}`)
    
    // 2. Cognitoから全グループを取得
    logger.info('Cognitoからグループ一覧を取得中...')
    const cognitoGroups = await listCognitoGroups()
    const cognitoGroupNames = cognitoGroups.map(group => group.GroupName)
    logger.info(`Cognitoに${cognitoGroupNames.length}個のグループが見つかりました: ${cognitoGroupNames.join(', ')}`)
    
    // 3. Permission側にあってCognito側にないグループ → Cognitoで作成
    const missingInCognito = permissionGroupNames.filter((name: string) => !cognitoGroupNames.includes(name))
    logger.info(`Cognitoに作成が必要なグループ: ${missingInCognito.length}個`)
    
    for (const groupName of missingInCognito) {
      try {
        const permissionGroup = permissionGroups.find((item: any) => item.group_name === groupName)
        const description = permissionGroup?.description || `${groupName}グループ (自動同期で作成)`
        
        await createCognitoGroup({
          groupName,
          description,
          precedence: groupName === 'administrator' ? 1 : 10
        })
        
        logger.info(`Cognitoにグループを作成しました: ${groupName}`)
        syncedCount++
      } catch (error: any) {
        if (error.name === 'GroupExistsException') {
          logger.info(`グループ${groupName}は既にCognitoに存在します`)
        } else {
          logger.error(`Cognitoグループ作成エラー (${groupName}):`, error)
          errorsCount++
        }
      }
    }
    
    // 4. Cognito側にあってPermission側にないグループ → 権限なしでレコード作成
    const missingInPermissions = cognitoGroupNames.filter(name => !permissionGroupNames.includes(name))
    logger.info(`Permissionsテーブルに作成が必要なグループ: ${missingInPermissions.length}個`)
    
    for (const groupName of missingInPermissions) {
      try {
        const cognitoGroup = cognitoGroups.find(group => group.GroupName === groupName)
        const description = cognitoGroup?.Description || `${groupName}グループ (Cognitoから同期)`
        
        const permissionRecord = {
          group_name: groupName,
          permissions: [], // 権限なしで作成
          description,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        await dynamodb.put(permissionsTableName, permissionRecord)
        logger.info(`Permissionsテーブルにグループを作成しました: ${groupName} (権限なし)`)
        syncedCount++
      } catch (error) {
        logger.error(`Permissionsテーブルグループ作成エラー (${groupName}):`, error)
        errorsCount++
      }
    }
    
    logger.info(`グループ同期完了: ${syncedCount}件同期、${errorsCount}件エラー`)
    return { synced: syncedCount, errors: errorsCount }
    
  } catch (error) {
    logger.error('グループ同期エラー:', error)
    throw error
  }
}
