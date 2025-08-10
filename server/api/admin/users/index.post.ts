import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider'
import { getDynamoDBService } from '~/server/utils/dynamodb'
import { useLogger } from '~/composables/useLogger'
import type { User, UserCreateForm } from '~/types'

export default defineEventHandler(async (event) => {
  const logger = useLogger({ prefix: '[AdminCreateUser]' })
  try {
    // Require admin permission
    const _currentUser = await requirePermission(event, 'user:create')

    const body = await readBody<UserCreateForm>(event)
    const { email, name, address, phone_number, temporary_password } = body

    // Validation
    if (!email || !name || !address || !phone_number || !temporary_password) {
      throw createError({
        statusCode: 400,
        statusMessage: 'All fields are required'
      })
    }

    const config = useRuntimeConfig()
    const cognitoClient = new CognitoIdentityProviderClient({
      region: config.awsRegion
    })

    // Create user in Cognito
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: config.cognitoUserPoolId as string,
      Username: email,
      TemporaryPassword: temporary_password,
      MessageAction: 'SUPPRESS', // Don't send email
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: name },
        { Name: 'email_verified', Value: 'true' }
      ]
    })

    const cognitoResponse = await cognitoClient.send(createUserCommand)
    
    if (!cognitoResponse.User?.Username) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create user in Cognito'
      })
    }

    // Add user to default group
    const addToGroupCommand = new AdminAddUserToGroupCommand({
      UserPoolId: config.cognitoUserPoolId as string,
      Username: email,
      GroupName: 'user'
    })

    await cognitoClient.send(addToGroupCommand)

    // Get user details including sub from Cognito
    const getUserCommand = new AdminGetUserCommand({
      UserPoolId: config.cognitoUserPoolId as string,
      Username: email
    })

    const userDetailsResponse = await cognitoClient.send(getUserCommand)
    
    if (!userDetailsResponse.UserAttributes) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to get user details from Cognito'
      })
    }

    // Extract sub (user ID) from user attributes
    const userAttributes = userDetailsResponse.UserAttributes.reduce((acc, attr) => {
      if (attr.Name && attr.Value) {
        acc[attr.Name] = attr.Value
      }
      return acc
    }, {} as Record<string, string>)

    const userId = userAttributes.sub
    if (!userId) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to get user sub from Cognito'
      })
    }

    // Generate dummy BTC address
    const btcAddress = `1${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`
    
    // Create user record in DynamoDB
    const dynamodb = getDynamoDBService()
    const tableName = dynamodb.getTableName('users')
    
    const now = new Date().toISOString()

    const user: User = {
      user_id: userId,
      email,
      name,
      address,
      phone_number,
      status: 'active',
      profile_approved: false,
      btc_address: btcAddress,
      created_at: now,
      updated_at: now
    }

    await dynamodb.put(tableName, user as unknown as Record<string, unknown>)

    return {
      success: true,
      data: user,
      message: 'User created successfully'
    }
  } catch (error: unknown) {
    logger.error('ユーザー作成エラー:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    // Handle Cognito specific errors
    if (error && typeof error === 'object' && 'name' in error && error.name === 'UsernameExistsException') {
      throw createError({
        statusCode: 400,
        statusMessage: 'User already exists'
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create user'
    })
  }
})