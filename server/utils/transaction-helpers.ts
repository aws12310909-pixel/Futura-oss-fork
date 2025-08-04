import type { Transaction } from '~/types'
import { TRANSACTION_STATUS } from '~/types'
import { getDynamoDBService } from '~/server/utils/dynamodb'

/**
 * 取引が承認済みかどうかを判定
 * statusが未設定の場合は承認済みとして扱う（下位互換性）
 */
export function isApprovedTransaction(transaction: Transaction): boolean {
  return !transaction.status || transaction.status === TRANSACTION_STATUS.APPROVED
}

/**
 * 承認済み取引のみを抽出
 */
export function filterApprovedTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter(isApprovedTransaction)
}

/**
 * 取引リストから残高を計算
 * 承認済み取引のみを対象とする
 */
export function calculateBalance(transactions: Transaction[]): number {
  return filterApprovedTransactions(transactions).reduce((balance, transaction) => {
    return transaction.transaction_type === 'deposit' 
      ? balance + transaction.amount 
      : balance - transaction.amount
  }, 0)
}

/**
 * 指定日時以前の取引をフィルター
 */
export function filterTransactionsByDate(
  transactions: Transaction[], 
  endDate: Date
): Transaction[] {
  return transactions.filter(t => new Date(t.timestamp) <= endDate)
}

/**
 * 指定日時以前の承認済み取引から残高を計算
 */
export function calculateBalanceAtDate(
  transactions: Transaction[], 
  endDate: Date
): number {
  const relevantTransactions = filterTransactionsByDate(transactions, endDate)
  return calculateBalance(relevantTransactions)
}

/**
 * ユーザーの現在の残高を取得
 * 承認済み取引のみを対象とする
 */
export async function getTotalBalance(userId: string): Promise<number> {
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
    console.error('[TransactionHelpers-Balance] 残高計算に失敗:', error)
    return 0
  }
}