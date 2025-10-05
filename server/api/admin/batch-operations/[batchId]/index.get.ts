import { getDynamoDBService } from '~/server/utils/dynamodb'
import { useLogger } from '~/composables/useLogger'
import type { BatchOperation, Transaction } from '~/types'

export default defineEventHandler(async (event) => {
  const logger = useLogger({ prefix: '[AdminBatchOperations-Detail-GET]' })

  try {
    // Require batch:read permission
    await requirePermission(event, 'batch:read')

    const batchId = getRouterParam(event, 'batchId')
    if (!batchId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'batchId is required'
      })
    }

    const dynamodb = getDynamoDBService()
    const batchOperationsTableName = dynamodb.getTableName('batch_operations')
    const transactionsTableName = dynamodb.getTableName('transactions')

    // Get batch operation record
    const batchOperation = await dynamodb.get(batchOperationsTableName, {
      batch_id: batchId
    })

    if (!batchOperation) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Batch operation not found'
      })
    }

    // Get all transactions for this batch
    const result = await dynamodb.query(
      transactionsTableName,
      'transaction_id = :transaction_id',
      { ':transaction_id': batchId }
    )

    const transactions = result.items as Transaction[]

    // Sort by timestamp descending
    transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return {
      success: true,
      data: {
        operation: batchOperation as BatchOperation,
        transactions
      }
    }
  } catch (error: unknown) {
    logger.error('一括処理詳細取得エラー:', error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch batch operation details'
    })
  }
})
