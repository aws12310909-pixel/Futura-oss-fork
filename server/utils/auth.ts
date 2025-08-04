// 1. 外部ライブラリ
import { GetUserCommand } from '@aws-sdk/client-cognito-identity-provider'

// 2. Nuxt/H3関連
import type { H3Event } from 'h3'
import { getRequestURL } from 'h3'

// 3. 内部server utils
import { getCognitoGroups, isUserAdministrator } from './cognito-groups'
import { validateSession } from './session'
import { createCognitoClient } from './client-factory'
import { getUserPermissionsByGroups } from './permission-helpers'
import { getCachedUserInfo, setCachedUserInfo } from './request-cache'

// 4. 内部composables（ユニバーサル）
import { useLogger } from '~/composables/useLogger'

// 5. Types
import type { AuthUser } from '~/types'

// Server-side logger (useLogger composable使用)
const logger = useLogger({ prefix: '[SERVER-AUTH]' })

export const verifyAuthToken = async (accessToken: string): Promise<AuthUser | null> => {
  try {
    const client = createCognitoClient()

    const getUserCommand = new GetUserCommand({
      AccessToken: accessToken
    })

    const userResponse = await client.send(getUserCommand)
    
    if (!userResponse.UserAttributes) {
      return null
    }

    // Extract user attributes
    const attributes = userResponse.UserAttributes.reduce((acc, attr) => {
      if (attr.Name && attr.Value) {
        acc[attr.Name] = attr.Value
      }
      return acc
    }, {} as Record<string, string>)

    // Get user groups from Cognito
    const groups = await getCognitoGroups(attributes.email || '')
    
    // Get permissions dynamically from permission table
    const permissions = await getUserPermissionsByGroups(groups)

    return {
      user_id: attributes.sub || '',
      email: attributes.email || '',
      name: attributes.name || '',
      groups,
      permissions
    }
  } catch (error) {
    logger.auth.tokenVerification(false)
    logger.error('token検証エラー:', error)
    return null
  }
}

export const requireAuth = async (event: H3Event): Promise<AuthUser> => {
  logger.debug('requireAuthがURLに対して呼び出されました:', getRequestURL(event).pathname)
  
  // 1. セッションIDベースの認証を優先
  const sessionId = getCookie(event, 'session_id')
  logger.debug('cookieからのsession ID:', sessionId ? '***存在***' : '見つかりません')
  
  if (sessionId) {
    // リクエストスコープキャッシュを確認
    const cachedUser = getCachedUserInfo(event, sessionId)
    if (cachedUser) {
      logger.debug('キャッシュからユーザー情報を取得:', cachedUser.email)
      return cachedUser
    }
    
    logger.debug('sessionを検証中...')
    const user = await validateSession(sessionId)
    if (user) {
      logger.auth.sessionValidation(true, sessionId)
      logger.debug('ユーザーのsession検証が成功しました:', user.email)
      
      // キャッシュに保存
      setCachedUserInfo(event, sessionId, user)
      
      return user
    } else {
      logger.auth.sessionValidation(false, sessionId)
      logger.debug('session検証に失敗しました')
    }
  }
  
  // 2. フォールバック：従来のaccess_tokenベース認証（互換性維持）
  const accessToken = getCookie(event, 'access_token')
  logger.debug('cookieからのaccess token:', accessToken ? '***存在***' : '見つかりません')
  if (accessToken) {
    // アクセストークンベースのキャッシュもチェック
    const cachedUser = getCachedUserInfo(event, accessToken)
    if (cachedUser) {
      logger.debug('キャッシュからユーザー情報を取得（トークンベース）:', cachedUser.email)
      return cachedUser
    }
    
    logger.debug('access tokenを検証中...')
    const user = await verifyAuthToken(accessToken)
    if (user) {
      logger.auth.tokenVerification(true)
      logger.debug('ユーザーのaccess token検証が成功しました:', user.email)
      
      // キャッシュに保存
      setCachedUserInfo(event, accessToken, user)
      
      return user
    } else {
      logger.auth.tokenVerification(false)
      logger.debug('access token検証に失敗しました')
    }
  }
  
  logger.warn('有効な認証が見つかりません「401をスローします')
  throw createError({
    statusCode: 401,
    statusMessage: 'Authentication required'
  })
}

export const requirePermission = async (event: H3Event, permission: string): Promise<AuthUser> => {
  const user = await requireAuth(event)
  
  if (!user.permissions.includes(permission)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Insufficient permissions'
    })
  }

  return user
}

export const requireGroup = async (event: H3Event, group: string): Promise<AuthUser> => {
  const user = await requireAuth(event)
  
  if (!user.groups.includes(group)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Access denied'
    })
  }

  return user
}

/**
 * administratorグループのメンバーかチェック
 */
export const requireAdministrator = async (event: H3Event): Promise<AuthUser> => {
  const user = await requireAuth(event)
  
  if (!user.groups.includes('administrator')) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Administrator access required'
    })
  }

  return user
}