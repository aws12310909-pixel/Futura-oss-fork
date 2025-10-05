import { getDynamoDBService } from '~/server/utils/dynamodb'
import { calculateBalance, validateAdminTransaction, validateAdminWithdrawalBalance } from '~/server/utils/transaction-helpers'
import { generateTransactionId } from '~/server/utils/uuid'
import { useLogger } from '~/composables/useLogger'
import type { Transaction, TransactionCreateForm, User as _User } from '~/types'

export default defineEventHandler(async (event) => {
  const logger = useLogger({ prefix: '[AdminCreateTransaction]' })
  try {
    // Require admin permission
    const currentUser = await requirePermission(event, 'transaction:create')

    const body = await readBody<TransactionCreateForm>(event)
    const { user_id, amount, transaction_type, memo, reason } = body

    // 共通バリデーション関数を使用
    validateAdminTransaction(body)

    const dynamodb = getDynamoDBService()
    const usersTableName = dynamodb.getTableName('users')
    const transactionsTableName = dynamodb.getTableName('transactions')

    // Verify user exists and is not deleted
    const user = await dynamodb.get(usersTableName, { user_id })
    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      })
    }

    if (user.status === 'deleted') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot create transaction for deleted user'
      })
    }

    // For withdrawals, check if user has sufficient balance
    if (transaction_type === 'withdrawal') {
      await validateAdminWithdrawalBalance(user_id, amount, calculateUserBalance)
    }

    // Create transaction record
    const transactionId = generateTransactionId()
    const now = new Date().toISOString()

    const transaction: Transaction = {
      transaction_id: transactionId,
      user_id,
      amount,
      transaction_type,
      timestamp: now,
      created_by: currentUser.user_id,
      memo,
      reason
    }

    await dynamodb.put(transactionsTableName, transaction as unknown as Record<string, unknown>)

    // Calculate new balance
    const newBalance = await calculateUserBalance(user_id)

    return {
      success: true,
      data: {
        ...transaction,
        user_name: user.name,
        user_email: user.email,
        new_balance: newBalance
      },
      message: `Transaction created successfully. New balance: ${newBalance} BTC`
    }
  } catch (error: unknown) {
    logger.error('取引作成エラー:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create transaction'
    })
  }
})

// Helper function to calculate user's current balance
async function calculateUserBalance(userId: string): Promise<number> {
  const logger = useLogger({ prefix: '[AdminCreateTransaction-Helper]' })
  const dynamodb = getDynamoDBService()
  const transactionsTableName = dynamodb.getTableName('transactions')

  try {
    const result = await dynamodb.query(
      transactionsTableName,
      'user_id = :user_id',
      { ':user_id': userId },
      {
        indexName: 'UserTimestampIndex'
      }
    )

    const transactions = result.items as Transaction[]
    
    // 承認済み取引のみを対象とする（statusが未設定の場合は承認済みとして扱う）
    return calculateBalance(transactions)
  } catch (error: unknown) {
    logger.error('残高計算に失敗:', error)
    return 0
  }
}