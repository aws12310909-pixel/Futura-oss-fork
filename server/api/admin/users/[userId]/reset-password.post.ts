import { AdminSetUserPasswordCommand } from '@aws-sdk/client-cognito-identity-provider'
import { createCognitoClient } from '~/server/utils/client-factory'
import { getDynamoDBService } from '~/server/utils/dynamodb'

export default defineEventHandler(async (event) => {
  try {
    // 管理者権限が必要
    await requirePermission(event, 'user:update')

    const userId = getRouterParam(event, 'userId')
    const body = await readBody<{ temporary_password: string }>(event)
    
    if (!userId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'User ID is required'
      })
    }

    if (!body.temporary_password) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Temporary password is required'
      })
    }

    const config = useRuntimeConfig()
    const cognitoClient = createCognitoClient()

    const dynamodb = getDynamoDBService()
    const tableName = dynamodb.getTableName('users')

    // メールアドレス取得のためDynamoDBからユーザーを取得
    const user = await dynamodb.get(tableName, { user_id: userId })
    
    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      })
    }

    if (user.status === 'deleted') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot reset password for deleted user'
      })
    }

    // Cognitoでテンポラリパスワードを設定
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: config.cognitoUserPoolId as string,
      Username: user.email,
      Password: body.temporary_password,
      Permanent: false // 次回ログイン時にユーザーは変更が必要
    })

    await cognitoClient.send(setPasswordCommand)

    return {
      success: true,
      message: 'Temporary password set successfully'
    }
  } catch (error: unknown) {
    console.error('Reset password error:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to reset password'
    })
  }
})