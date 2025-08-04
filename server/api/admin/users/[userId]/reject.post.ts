import { getDynamoDBService } from '~/server/utils/dynamodb'
import { useLogger } from '~/composables/useLogger'

type DynamoDBValue = string | number | boolean | null | DynamoDBValue[] | { [key: string]: DynamoDBValue }
type DynamoDBRecord = Record<string, DynamoDBValue>

export default defineEventHandler(async (event) => {
  const logger = useLogger({ prefix: '[AdminRejectUser]' })
  try {
    // Require admin permission
    await requirePermission(event, 'profile:approve')

    const userId = getRouterParam(event, 'userId')
    const body = await readBody<{ reason?: string }>(event)
    
    if (!userId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'User ID is required'
      })
    }

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

    if (user.status === 'deleted') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot reject deleted user'
      })
    }

    if (!user.profile_approved) {
      throw createError({
        statusCode: 400,
        statusMessage: 'User profile is already not approved'
      })
    }

    // Update user approval status
    let updateExpression = 'SET profile_approved = :approved, updated_at = :updated_at'
    const expressionAttributeValues: DynamoDBRecord = {
      ':approved': false,
      ':updated_at': new Date().toISOString()
    }

    // Add rejection reason if provided
    if (body.reason) {
      updateExpression += ', rejection_reason = :reason'
      expressionAttributeValues[':reason'] = body.reason
    }

    const updatedUser = await dynamodb.update(
      tableName,
      { user_id: userId },
      updateExpression,
      expressionAttributeValues
    )

    return {
      success: true,
      data: updatedUser,
      message: 'User profile approval revoked successfully'
    }
  } catch (error: unknown) {
    logger.error('ユーザープロフィール拒否エラー:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to reject user profile'
    })
  }
})