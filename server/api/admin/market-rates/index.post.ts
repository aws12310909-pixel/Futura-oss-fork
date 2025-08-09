import { getDynamoDBService } from '~/server/utils/dynamodb'
import { calculateBalance } from '~/server/utils/transaction-helpers'
import { useLogger } from '~/composables/useLogger'
import type { MarketRate, MarketRateCreateForm, MarketRateBulkCreateForm, User, Transaction, CSVUploadResponse, AuthUser } from '~/types'

export default defineEventHandler(async (event) => {
  const logger = useLogger({ prefix: '[AdminCreateMarketRate]' })
  try {
    // Require admin permission
    const currentUser = await requirePermission(event, 'market_rate:create')

    const body = await readBody<MarketRateCreateForm | MarketRateBulkCreateForm>(event)
    
    // Check if this is a bulk create request
    if ('rates' in body) {
      return await handleBulkCreate(body as MarketRateBulkCreateForm, currentUser, logger)
    }
    
    // Single rate creation (legacy support)
    return await handleSingleCreate(body as MarketRateCreateForm, currentUser, logger)
    
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

// Handle single rate creation
async function handleSingleCreate(body: MarketRateCreateForm, currentUser: AuthUser, logger: any) {
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
  const rateId = Math.floor(rateDate.getTime() / 1000).toString() // Unix timestamp as string
  const now = new Date().toISOString()

  // Check for duplicate
  const ratesTableName = dynamodb.getTableName('market_rates')
  logger.info(`Checking for duplicate rate with rate_id: ${rateId} (type: ${typeof rateId})`)
  const existingRate = await dynamodb.get(ratesTableName, { rate_id: rateId, timestamp })
  
  if (existingRate) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Market rate for this timestamp already exists'
    })
  }

  // Create market rate record
  const marketRate: MarketRate = {
    rate_id: rateId,
    timestamp,
    btc_jpy_rate,
    created_by: currentUser.user_id,
    created_at: now
  }

  logger.info(`Creating market rate with rate_id: ${marketRate.rate_id} (type: ${typeof marketRate.rate_id})`)
  await dynamodb.put(ratesTableName, marketRate as unknown as Record<string, unknown>)

  // Recalculate all user asset values
  await recalculateUserAssetValues(timestamp, btc_jpy_rate)

  return {
    success: true,
    data: marketRate,
    message: 'Market rate created and user assets updated successfully'
  }
}

// Handle bulk rate creation
async function handleBulkCreate(body: MarketRateBulkCreateForm, currentUser: AuthUser, logger: any): Promise<CSVUploadResponse> {
  const { rates } = body

  if (!rates || !Array.isArray(rates) || rates.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No rates provided'
    })
  }

  const dynamodb = getDynamoDBService()
  const ratesTableName = dynamodb.getTableName('market_rates')
  const now = new Date().toISOString()
  
  const duplicates: MarketRateCreateForm[] = []
  const errors: string[] = []
  const createdRates: MarketRate[] = []

  for (const rateData of rates) {
    try {
      const { timestamp, btc_jpy_rate } = rateData

      // Validation
      if (!timestamp || !btc_jpy_rate) {
        errors.push(`Invalid data: timestamp and BTC rate are required for ${timestamp}`)
        continue
      }

      if (btc_jpy_rate <= 0) {
        errors.push(`Invalid data: BTC rate must be positive for ${timestamp}`)
        continue
      }

      // Validate timestamp format
      const rateDate = new Date(timestamp)
      if (isNaN(rateDate.getTime())) {
        errors.push(`Invalid timestamp format: ${timestamp}`)
        continue
      }

      const rateId = Math.floor(rateDate.getTime() / 1000).toString() // Unix timestamp as string

      // Check for duplicate
      logger.info(`Checking for duplicate rate with rate_id: ${rateId} (type: ${typeof rateId})`)
      const existingRate = await dynamodb.get(ratesTableName, { rate_id: rateId, timestamp })
      
      if (existingRate) {
        duplicates.push(rateData)
        continue
      }

      // Create market rate record
      const marketRate: MarketRate = {
        rate_id: rateId,
        timestamp,
        btc_jpy_rate,
        created_by: currentUser.user_id,
        created_at: now
      }

      logger.info(`Creating market rate with rate_id: ${marketRate.rate_id} (type: ${typeof marketRate.rate_id})`)
      await dynamodb.put(ratesTableName, marketRate as unknown as Record<string, unknown>)
      createdRates.push(marketRate)

      logger.info(`Created market rate for ${timestamp}: ¥${btc_jpy_rate}`)

    } catch (error) {
      logger.error(`Failed to create rate for ${rateData.timestamp}:`, error)
      errors.push(`Failed to create rate for ${rateData.timestamp}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Recalculate user asset values for all created rates
  for (const rate of createdRates) {
    try {
      await recalculateUserAssetValues(rate.timestamp, rate.btc_jpy_rate)
    } catch (error) {
      logger.error(`Failed to recalculate asset values for ${rate.timestamp}:`, error)
      // Continue with other rates even if recalculation fails
    }
  }

  return {
    success: true,
    created_count: createdRates.length,
    duplicates,
    errors,
    message: `Successfully created ${createdRates.length} market rates${duplicates.length > 0 ? `, ${duplicates.length} duplicates skipped` : ''}${errors.length > 0 ? `, ${errors.length} errors occurred` : ''}`
  }
}

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