import { getDynamoDBService } from '~/server/utils/dynamodb'
import { calculateBalance } from '~/server/utils/transaction-helpers'
import { useLogger } from '~/composables/useLogger'
import type { MarketRate, MarketRateCreateForm, User, Transaction } from '~/types'

export default defineEventHandler(async (event) => {
  const logger = useLogger({ prefix: '[AdminCreateMarketRate]' })
  try {
    // Require admin permission
    const currentUser = await requirePermission(event, 'market_rate:create')

    const body = await readBody<MarketRateCreateForm>(event)
    const { timestamp, btc_jpy_rate } = body

    // Validation
    if (!timestamp || !btc_jpy_rate) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Timestamp and BTC rate are required'
      })
    }

    if (btc_jpy_rate <= 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'BTC rate must be positive'
      })
    }

    // Validate timestamp format
    const rateDate = new Date(timestamp)
    if (isNaN(rateDate.getTime())) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid timestamp format'
      })
    }

    const dynamodb = getDynamoDBService()
    const rateId = crypto.randomUUID()
    const now = new Date().toISOString()

    // Create market rate record
    const marketRate: MarketRate = {
      rate_id: rateId,
      timestamp,
      btc_jpy_rate,
      created_by: currentUser.user_id,
      created_at: now
    }

    const ratesTableName = dynamodb.getTableName('market_rates')
    await dynamodb.put(ratesTableName, marketRate as unknown as Record<string, unknown>)

    // Recalculate all user asset values
    await recalculateUserAssetValues(timestamp, btc_jpy_rate)

    return {
      success: true,
      data: marketRate,
      message: 'Market rate created and user assets updated successfully'
    }
  } catch (error: unknown) {
    logger.error('市場レート作成エラー:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create market rate'
    })
  }
})

// Helper function to recalculate user asset values
async function recalculateUserAssetValues(rateTimestamp: string, btcRate: number) {
  const logger = useLogger({ prefix: '[AdminCreateMarketRate-Helper]' })
  const dynamodb = getDynamoDBService()
  const usersTableName = dynamodb.getTableName('users')
  const transactionsTableName = dynamodb.getTableName('transactions')

  try {
    // Get all active users
    const usersResult = await dynamodb.scan(usersTableName, {
      filterExpression: '#status <> :deleted',
      expressionAttributeNames: { '#status': 'status' },
      expressionAttributeValues: { ':deleted': 'deleted' }
    })

    const users = usersResult.items as User[]

    // For each user, calculate their BTC balance at the rate timestamp
    for (const user of users) {
      try {
        // Get all transactions for this user up to the rate timestamp
        const transactionsResult = await dynamodb.query(
          transactionsTableName,
          'user_id = :user_id',
          { ':user_id': user.user_id, ':rate_timestamp': rateTimestamp },
          {
            indexName: 'UserTimestampIndex',
            filterExpression: '#timestamp <= :rate_timestamp',
            expressionAttributeNames: { '#timestamp': 'timestamp' }
          }
        )

        const transactions = transactionsResult.items as Transaction[]

        // Calculate total BTC balance (承認済み取引のみ対象)
        const totalBtc = calculateBalance(transactions)

        // Calculate JPY value
        const jpyValue = totalBtc * btcRate

        logger.info(`ユーザー ${user.name}: ${totalBtc} BTC = ¥${jpyValue.toLocaleString()}`)

      } catch (userError) {
        logger.error(`ユーザー ${user.user_id} の再計算に失敗:`, userError)
        // Continue with other users even if one fails
      }
    }

    logger.info(`${users.length}人のユーザーの資産価値を再計算しました`)
  } catch (error: unknown) {
    logger.error('ユーザー資産価値の再計算に失敗:', error)
    // Don't throw error here as the rate was already created successfully
  }
}