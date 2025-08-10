import { CognitoIdentityProviderClient, AdminSetUserPasswordCommand } from '@aws-sdk/client-cognito-identity-provider'
import { getDynamoDBService } from '~/server/utils/dynamodb'

export default defineEventHandler(async (event) => {
  try {
    // Require admin permission
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
    const cognitoClient = new CognitoIdentityProviderClient({
      region: config.awsRegion
    })

    const dynamodb = getDynamoDBService()
    const tableName = dynamodb.getTableName('users')

    // Get user from DynamoDB to get email
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

    // Set temporary password in Cognito
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: config.cognitoUserPoolId as string,
      Username: user.email,
      Password: body.temporary_password,
      Permanent: false // User must change on next login
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