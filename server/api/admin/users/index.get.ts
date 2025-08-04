import { getDynamoDBService } from '~/server/utils/dynamodb'
import { useLogger } from '~/composables/useLogger'
import type { User, PaginatedResponse } from '~/types'

type DynamoDBValue = string | number | boolean | null | DynamoDBValue[] | { [key: string]: DynamoDBValue }
type DynamoDBRecord = Record<string, DynamoDBValue>

export default defineEventHandler(async (event) => {
  const logger = useLogger({ prefix: '[AdminUsersGet]' })
  try {
    // Require admin permission
    await requirePermission(event, 'user:read')

    const query = getQuery(event)
    const page = Number(query.page) || 1
    const limit = Math.min(Number(query.limit) || 20, 100)
    const status = query.status as string
    
    logger.debug('ユーザー取得リクエスト:', { page, limit, status })

    const dynamodb = getDynamoDBService()
    const tableName = dynamodb.getTableName('users')

    // Build filter expression
    let filterExpression = '#status <> :deleted'
    const expressionAttributeNames = { '#status': 'status' }
    const expressionAttributeValues: DynamoDBRecord = { ':deleted': 'deleted' }

    if (status && status !== 'all') {
      filterExpression += ' AND #status = :status'
      expressionAttributeValues[':status'] = status
    }

    // Scan users table (in production, consider using pagination with LastEvaluatedKey)
    const result = await dynamodb.scan(tableName, {
      filterExpression,
      expressionAttributeNames,
      expressionAttributeValues,
      limit: limit * page // Simple pagination
    })

    const users = result.items as User[]
    
    // Simple pagination logic
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedUsers = users.slice(startIndex, endIndex)

    const response: PaginatedResponse<User> = {
      items: paginatedUsers,
      total: users.length,
      page,
      limit,
      hasMore: endIndex < users.length
    }
    
    logger.info(`ユーザー取得完了: 総数${users.length}件, 返却${paginatedUsers.length}件`)

    return {
      success: true,
      data: response
    }
  } catch (error: unknown) {
    logger.error('ユーザー取得エラー:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch users'
    })
  }
})