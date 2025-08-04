import { getDynamoDBService } from '~/server/utils/dynamodb'
import { calculateBalance } from '~/server/utils/transaction-helpers'
import { useLogger } from '~/composables/useLogger'
import type { TransactionApprovalForm, EnhancedTransaction, User } from '~/types'
import { TRANSACTION_STATUS } from '~/types'

export default defineEventHandler(async (event) => {
  const logger = useLogger({ prefix: '[AdminTransactionApproval]' })
  
  try {
    // 権限チェック: transaction:approve
    const currentUser = await requirePermission(event, 'transaction:approve')
    
    const transactionId = getRouterParam(event, 'transactionId')
    if (!transactionId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Transaction ID is required'
      })
    }
    
    // リクエストボディの取得とバリデーション
    const body = await readBody<TransactionApprovalForm>(event)
    
    const validStatuses = [TRANSACTION_STATUS.APPROVED, TRANSACTION_STATUS.REJECTED]
    if (!body.status || !validStatuses.includes(body.status)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Status must be ${validStatuses.join(' or ')}`
      })
    }
    
    if (body.status === TRANSACTION_STATUS.REJECTED && !body.rejection_reason) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Rejection reason is required when rejecting'
      })
    }
    
    const dynamodb = getDynamoDBService()
    const transactionsTableName = dynamodb.getTableName('transactions')
    const usersTableName = dynamodb.getTableName('users')
    
    // 1. 既存のトランザクションを取得
    const existingTransactions = await dynamodb.query(
      transactionsTableName,
      'transaction_id = :transaction_id',
      { ':transaction_id': transactionId }
    )
    
    if (existingTransactions.items.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Transaction not found'
      })
    }
    
    const transaction = existingTransactions.items[0] as EnhancedTransaction
    
    // 2. ステータスチェック（pending状態のみ処理可能）
    if (transaction.status !== TRANSACTION_STATUS.PENDING) {
      throw createError({
        statusCode: 409,
        statusMessage: `Transaction is already ${transaction.status}`
      })
    }
    
    // 3. ユーザー情報を取得
    const user = await dynamodb.get(usersTableName, { user_id: transaction.user_id }) as User
    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      })
    }
    
    const now = new Date().toISOString()
    
    // 4. トランザクションを更新
    const updatedTransaction: EnhancedTransaction = {
      ...transaction,
      status: body.status,
      processed_at: now,
      processed_by: currentUser.user_id,
      timestamp: body.status === TRANSACTION_STATUS.APPROVED ? now : transaction.timestamp, // 承認時のみタイムスタンプ更新
      rejection_reason: body.status === TRANSACTION_STATUS.REJECTED ? body.rejection_reason : undefined
    }
    
    await dynamodb.put(transactionsTableName, updatedTransaction as any)
    
    // 5. 承認時の残高計算
    let newBalance: number | undefined
    if (body.status === TRANSACTION_STATUS.APPROVED) {
      // ユーザーの現在の残高を再計算
      const userTransactionsResult = await dynamodb.query(
        transactionsTableName,
        'user_id = :user_id',
        { ':user_id': transaction.user_id },
        {
          indexName: 'UserTimestampIndex'
        }
      )
      
      const userTransactions = userTransactionsResult.items as EnhancedTransaction[]
      newBalance = calculateBalance(userTransactions)
      
      logger.info(`取引承認完了: ${transactionId} - ${user.email} - ${transaction.amount} BTC - 新残高: ${newBalance} BTC`)
    } else {
      logger.info(`取引拒否完了: ${transactionId} - ${user.email} - ${transaction.amount} BTC - 理由: ${body.rejection_reason}`)
    }
    
    return {
      success: true,
      data: {
        transaction_id: transactionId,
        status: body.status,
        processed_at: now,
        processed_by: currentUser.user_id,
        user_name: user.name,
        user_email: user.email,
        new_balance: newBalance,
        rejection_reason: body.status === TRANSACTION_STATUS.REJECTED ? body.rejection_reason : undefined
      },
      message: `Transaction ${body.status} successfully`
    }
    
  } catch (error: unknown) {
    logger.error('取引承認/拒否エラー:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to process transaction approval'
    })
  }
})