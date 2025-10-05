import { getDynamoDBService } from '~/server/utils/dynamodb'
import { useLogger } from '~/composables/useLogger'
import type { BatchOperation, PaginatedResponse } from '~/types'

export default defineEventHandler(async (event) => {
  const logger = useLogger({ prefix: '[AdminBatchOperations-GET]' })

  try {
    // Require batch:read permission
    await requirePermission(event, 'batch:read')

    const query = getQuery(event)
    const status = query.status as string | undefined
    const limit = query.limit ? Number(query.limit) : 20
    const offset = query.offset ? Number(query.offset) : 0

    const dynamodb = getDynamoDBService()
    const batchOperationsTableName = dynamodb.getTableName('batch_operations')

    let items: BatchOperation[] = []

    if (status) {
      // Query by status using GSI
      const result = await dynamodb.query(
        batchOperationsTableName,
        '#status = :status',
        { ':status': status },
        {
          indexName: 'StatusTimestampIndex',
          scanIndexForward: false, // Sort by created_at descending
          expressionAttributeNames: {
            '#status': 'status'
          }
        }
      )
      items = result.items as BatchOperation[]
    } else {
      // Scan all
      const result = await dynamodb.scan(batchOperationsTableName)
      items = result.items as BatchOperation[]

      // Sort by created_at descending
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    const total = items.length
    const paginatedItems = items.slice(offset, offset + limit)

    const response: PaginatedResponse<BatchOperation> = {
      items: paginatedItems,
      total,
      page: Math.floor(offset / limit) + 1,
      limit,
      hasMore: offset + limit < total
    }

    return {
      success: true,
      data: response
    }
  } catch (error: unknown) {
    logger.error('一括処理履歴取得エラー:', error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch batch operations'
    })
  }
})
