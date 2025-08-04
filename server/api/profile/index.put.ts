import { getDynamoDBService } from '~/server/utils/dynamodb'
import { useLogger } from '~/composables/useLogger'
import type { UserUpdateForm } from '~/types'

type DynamoDBValue = string | number | boolean | null | DynamoDBValue[] | { [key: string]: DynamoDBValue }
type DynamoDBRecord = Record<string, DynamoDBValue>

export default defineEventHandler(async (event) => {
  const logger = useLogger({ prefix: '[ProfileUpdate]' })
  try {
    const currentUser = await requireAuth(event)
    const body = await readBody<UserUpdateForm>(event)
    
    // Validation
    if (body.name && body.name.length < 2) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Name must be at least 2 characters'
      })
    }

    if (body.address && body.address.length < 10) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Address must be at least 10 characters'
      })
    }

    if (body.phone_number && !/^[\d-+()]+$/.test(body.phone_number)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid phone number format'
      })
    }

    const dynamodb = getDynamoDBService()
    const tableName = dynamodb.getTableName('users')

    // Build update expression
    const updateExpressions: string[] = []
    const expressionAttributeValues: DynamoDBRecord = {}
    const expressionAttributeNames: Record<string, string> = {}

    if (body.name) {
      updateExpressions.push('#name = :name')
      expressionAttributeNames['#name'] = 'name'
      expressionAttributeValues[':name'] = body.name
    }

    if (body.address) {
      updateExpressions.push('address = :address')
      expressionAttributeValues[':address'] = body.address
    }

    if (body.phone_number) {
      updateExpressions.push('phone_number = :phone_number')
      expressionAttributeValues[':phone_number'] = body.phone_number
    }

    if (updateExpressions.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No valid fields to update'
      })
    }

    // Always update the updated_at timestamp
    updateExpressions.push('updated_at = :updated_at')
    expressionAttributeValues[':updated_at'] = new Date().toISOString()

    const updateExpression = 'SET ' + updateExpressions.join(', ')

    // Update user profile
    const updatedUser = await dynamodb.update(
      tableName,
      { user_id: currentUser.user_id },
      updateExpression,
      expressionAttributeValues,
      Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined
    )

    return {
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully'
    }
  } catch (error: unknown) {
    logger.error('プロフィール更新エラー:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update profile'
    })
  }
})