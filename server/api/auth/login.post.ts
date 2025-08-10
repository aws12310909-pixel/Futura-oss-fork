import { InitiateAuthCommand, GetUserCommand } from '@aws-sdk/client-cognito-identity-provider'
import type { AuthUser, LoginCredentials } from '~/types'
import { createSessionFromEvent } from '~/server/utils/session'
import { getCognitoGroups } from '~/server/utils/cognito-groups'
import { createCognitoClient } from '~/server/utils/client-factory'
import { getUserPermissionsByGroups } from '~/server/utils/permission-helpers'
import { syncCognitoToDatabase } from '~/server/utils/cognito-sync'
import { getDynamoDBService } from '~/server/utils/dynamodb'
import { useLogger } from '~/composables/useLogger'

const logger = useLogger({ prefix: '[API-AUTH-LOGIN]' })

/**
 * 初回ログイン時の自動同期チェック
 * 管理者ユーザーが初回ログインした際に、DBが空かどうかをチェックして自動的に同期を実行
 */
async function checkAndSyncIfNeeded(groups: string[], email: string): Promise<void> {
  // 管理者ユーザーのみチェック
  if (!groups.includes('administrator')) {
    return
  }

  try {
    logger.info('管理者ユーザーの初回ログインを検出、DB状態をチェック中...')
    
    const dynamoDB = getDynamoDBService()
    
    // ユーザーテーブルの件数をチェック
    const usersScanResult = await dynamoDB.scan('users', {
      select: 'COUNT'
    })
    
    // ユーザーが存在しない場合は初回デプロイと判断
    if (usersScanResult.count === 0) {
      logger.info('DBが空のため、初回デプロイと判断。Cognito同期を実行中...')
      
      try {
        const syncResults = await syncCognitoToDatabase()
        logger.info('初回同期完了:', syncResults)
      } catch (syncError) {
        logger.error('初回同期エラー:', syncError)
        // 同期エラーでもログインは続行（フォールバック）
      }
    } else {
      logger.debug('DBにユーザーが存在するため、同期は不要')
    }
  } catch (error) {
    logger.warn('DB状態チェックエラー、同期はスキップ:', error)
    // エラーが発生してもログインは続行
  }
}

export default defineEventHandler(async (event) => {
  try {
    logger.debug('ログインリクエストが開始されました')
    const body = await readBody<LoginCredentials>(event)
    const { email, password } = body
    logger.info('ログイン試行:', email)

    if (!email || !password) {
      logger.warn('メールアドレスまたはパスワードが不足しています')
      throw createError({
        statusCode: 400,
        statusMessage: 'Email and password are required'
      })
    }

    const config = useRuntimeConfig()
    logger.debug('設定 ClientId:', config.cognitoClientId as string)
    const client = createCognitoClient()
    logger.debug('Cognitoクライアントが作成されました')

    // Authenticate with Cognito
    const authCommand = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: config.cognitoClientId as string,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    })

    logger.debug('Cognitoに認証コマンドを送信中...')
    const authResponse = await client.send(authCommand)
    logger.debug('認証レスポンスを受信:', authResponse.ChallengeName || 'SUCCESS')
    logger.debug('セッション作成を開始...')
    
    // Handle password challenge (FORCE_CHANGE_PASSWORD)
    if (authResponse.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      return {
        success: false,
        challenge: 'NEW_PASSWORD_REQUIRED',
        session: authResponse.Session,
        message: 'Password change required'
      }
    }
    
    if (!authResponse.AuthenticationResult?.AccessToken || !authResponse.AuthenticationResult?.IdToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid credentials'
      })
    }
    
    const { AccessToken, IdToken, RefreshToken } = authResponse.AuthenticationResult

    // Get user details
    const getUserCommand = new GetUserCommand({
      AccessToken: AccessToken
    })

    const userResponse = await client.send(getUserCommand)
    
    if (!userResponse.UserAttributes) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to get user details'
      })
    }

    // Extract user attributes
    const attributes = userResponse.UserAttributes.reduce((acc, attr) => {
      if (attr.Name && attr.Value) {
        acc[attr.Name] = attr.Value
      }
      return acc
    }, {} as Record<string, string>)

    // Get user groups from Cognito (with fallback for AWS auth errors)
    let groups: string[] = []
    
    try {
      groups = await getCognitoGroups(attributes.email || '')
      logger.debug('ユーザーグループの取得に成功:', groups)
    } catch (error) {
      logger.warn('ユーザーグループの取得に失敗、デフォルトの権限を使用:', error)
      
      // Fallback: Check if email suggests admin access
      if (attributes.email?.includes('admin')) {
        groups = ['administrator']
        logger.debug('フォールバック: メールパターンから管理者ユーザーを検出')
      } else {
        groups = []
        logger.debug('フォールバック: 標準ユーザー権限を使用')
      }
    }

    // 初回ログイン時の自動同期チェック
    await checkAndSyncIfNeeded(groups, attributes.email || '')

    // Get permissions dynamically from permission table
    logger.debug('権限を取得中...')
    const permissions = await getUserPermissionsByGroups(groups)
    logger.debug(`権限取得完了: ${permissions.length}個の権限`)

    // Create DynamoDB session with tokens and client info
    logger.debug('ユーザーのセッションを作成中:', attributes.sub)
    const sessionId = await createSessionFromEvent(
      event,
      attributes.sub || '',
      AccessToken,
      IdToken,
      RefreshToken,
      permissions,
      groups
    )
    logger.info('セッションが作成されました ID:', sessionId)
    
    // Set HTTP-only session cookie (only session_id, no tokens)
    logger.debug('セッションcookieを設定中...')
    setCookie(event, 'session_id', sessionId, {
      httpOnly: true,
      secure: false, // localhost環境ではfalse
      sameSite: 'lax', // strictからlaxに変更
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/' // パスを明示的に設定
    })
    logger.debug('セッションcookieが正常に設定されました')

    const authUser: AuthUser = {
      user_id: attributes.sub || '',
      email: attributes.email || '',
      name: attributes.name || '',
      groups,
      permissions
    }

    return {
      success: true,
      data: authUser
    }
  } catch (error: unknown) {
    logger.error('ログインエラー:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})