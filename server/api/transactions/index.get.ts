import { getDynamoDBService } from '~/server/utils/dynamodb'
import { useLogger } from '~/composables/useLogger'
import type { Transaction, User, PaginatedResponse } from '~/types'

type EnrichedTransaction = Transaction & {
  user_name: string
  user_email: string
}

export default defineEventHandler(async (event) => {
  const logger = useLogger({ prefix: '[TransactionsGet]' })
  try {
    logger.debug('取引履歴API呼び出し開始')
    // Require permission to read transactions
    const currentUser = await requirePermission(event, 'transaction:read')
    logger.debug('ユーザー認証成功:', { userId: currentUser.user_id, permissions: currentUser.permissions })
    
    const query = getQuery(event)
    const page = Number(query.page) || 1
    const limit = Math.min(Number(query.limit) || 20, 100)
    const transactionType = query.transaction_type as string

    const dynamodb = getDynamoDBService()
    const transactionsTableName = dynamodb.getTableName('transactions')
    logger.debug('使用するテーブル名:', transactionsTableName)
    
    // Always get transactions for the authenticated user only
    logger.debug('認証ユーザーの取引履歴を取得中:', { userId: currentUser.user_id, indexName: 'UserTimestampIndex' })
    const result = await dynamodb.query(
      transactionsTableName,
      'user_id = :user_id',
      { ':user_id': currentUser.user_id },
      {
        indexName: 'UserTimestampIndex',
        scanIndexForward: false // Sort by timestamp descending
      }
    )
    let transactions = result.items as Transaction[]
    logger.debug('取引履歴クエリ結果:', { count: transactions.length })

    // Filter by transaction type if specified
    if (transactionType && ['deposit', 'withdrawal'].includes(transactionType)) {
      transactions = transactions.filter(t => t.transaction_type === transactionType)
    }

    // Get user information for the authenticated user
    const usersTableName = dynamodb.getTableName('users')
    let userName = 'Unknown User'
    let userEmail = 'Unknown Email'
    
    try {
      const user = await dynamodb.get(usersTableName, { user_id: currentUser.user_id })
      if (user) {
        const userData = user as User
        userName = userData.name || 'Unknown User'
        userEmail = userData.email || 'Unknown Email'
      }
    } catch (error: unknown) {
      logger.error(`ユーザー ${currentUser.user_id} の取得に失敗:`, error)
    }

    // Enrich transactions with user data
    const enrichedTransactions = transactions.map(transaction => ({
      ...transaction,
      user_name: userName,
      user_email: userEmail
    }))

    // Simple pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedTransactions = enrichedTransactions.slice(startIndex, endIndex)

    const response: PaginatedResponse<EnrichedTransaction> = {
      items: paginatedTransactions,
      total: enrichedTransactions.length,
      page,
      limit,
      hasMore: endIndex < enrichedTransactions.length
    }

    logger.debug('最終レスポンス:', { 
      totalItems: enrichedTransactions.length,
      paginatedItems: paginatedTransactions.length,
      response 
    })

    return {
      success: true,
      data: response
    }
  } catch (error: unknown) {
    logger.error('取引取得エラー:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch transactions'
    })
  }
})