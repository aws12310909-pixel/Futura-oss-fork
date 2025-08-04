import { CognitoIdentityProviderClient, AdminEnableUserCommand } from '@aws-sdk/client-cognito-identity-provider'
import { getDynamoDBService } from '~/server/utils/dynamodb'

export default defineEventHandler(async (event) => {
  try {
    // Require admin permission
    await requirePermission(event, 'user:update')

    const userId = getRouterParam(event, 'userId')
    
    if (!userId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'User ID is required'
      })
    }

    const config = useRuntimeConfig()
    const cognitoClient = new CognitoIdentityProviderClient({
      region: config.awsRegion
    })

    const dynamodb = getDynamoDBService()
    const tableName = dynamodb.getTableName('users')

    // Get user from DynamoDB
    const user = await dynamodb.get(tableName, { user_id: userId })
    
    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      })
    }

    if (user.status === 'active') {
      throw createError({
        statusCode: 400,
        statusMessage: 'User is already active'
      })
    }

    if (user.status === 'deleted') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot activate deleted user'
      })
    }

    // Enable user in Cognito
    const enableUserCommand = new AdminEnableUserCommand({
      UserPoolId: config.public.cognitoUserPoolId,
      Username: user.email
    })

    await cognitoClient.send(enableUserCommand)

    // Update user status in DynamoDB
    const updatedUser = await dynamodb.update(
      tableName,
      { user_id: userId },
      'SET #status = :status, updated_at = :updated_at',
      {
        ':status': 'active',
        ':updated_at': new Date().toISOString()
      },
      {
        '#status': 'status'
      }
    )

    return {
      success: true,
      data: updatedUser,
      message: 'User activated successfully'
    }
  } catch (error: unknown) {
    console.error('Activate user error:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to activate user'
    })
  }
})