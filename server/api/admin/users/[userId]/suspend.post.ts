import { CognitoIdentityProviderClient, AdminDisableUserCommand } from '@aws-sdk/client-cognito-identity-provider'
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

    // Get user from DynamoDB to get email
    const user = await dynamodb.get(tableName, { user_id: userId })
    
    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      })
    }

    if (user.status === 'suspended') {
      throw createError({
        statusCode: 400,
        statusMessage: 'User is already suspended'
      })
    }

    // Disable user in Cognito
    const disableUserCommand = new AdminDisableUserCommand({
      UserPoolId: config.public.cognitoUserPoolId,
      Username: user.email
    })

    await cognitoClient.send(disableUserCommand)

    // Update user status in DynamoDB
    const updatedUser = await dynamodb.update(
      tableName,
      { user_id: userId },
      'SET #status = :status, updated_at = :updated_at',
      {
        ':status': 'suspended',
        ':updated_at': new Date().toISOString()
      },
      {
        '#status': 'status'
      }
    )

    return {
      success: true,
      data: updatedUser,
      message: 'User suspended successfully'
    }
  } catch (error: unknown) {
    console.error('Suspend user error:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to suspend user'
    })
  }
})