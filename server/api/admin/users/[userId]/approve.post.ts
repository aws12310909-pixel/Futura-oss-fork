import { getDynamoDBService } from '~/server/utils/dynamodb'
import { useLogger } from '~/composables/useLogger'

export default defineEventHandler(async (event) => {
  const logger = useLogger({ prefix: '[AdminApproveUser]' })
  try {
    // Require admin permission
    await requirePermission(event, 'profile:approve')

    const userId = getRouterParam(event, 'userId')
    
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
        statusMessage: 'Cannot approve deleted user'
      })
    }

    if (user.profile_approved) {
      throw createError({
        statusCode: 400,
        statusMessage: 'User profile is already approved'
      })
    }

    // Update user approval status
    const updatedUser = await dynamodb.update(
      tableName,
      { user_id: userId },
      'SET profile_approved = :approved, updated_at = :updated_at',
      {
        ':approved': true,
        ':updated_at': new Date().toISOString()
      }
    )

    return {
      success: true,
      data: updatedUser,
      message: 'User profile approved successfully'
    }
  } catch (error: unknown) {
    logger.error('ユーザープロフィール承認エラー:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to approve user profile'
    })
  }
})