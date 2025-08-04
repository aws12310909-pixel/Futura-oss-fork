import { getDynamoDBService } from '~/server/utils/dynamodb'
import { useLogger } from '~/composables/useLogger'
import type { MarketRate } from '~/types'

export default defineEventHandler(async (_event) => {
  const logger = useLogger({ prefix: '[LatestMarketRate]' })
  try {
    const dynamodb = getDynamoDBService()
    const tableName = dynamodb.getTableName('market_rates')

    // Get the latest market rate
    const result = await dynamodb.scan(tableName)
    const rates = result.items as MarketRate[]

    if (rates.length === 0) {
      return {
        success: true,
        data: [],
        message: 'No market rates found'
      }
    }

    // Sort by timestamp descending and get the latest
    const latestRate = rates.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0]

    return {
      success: true,
      data: latestRate
    }
  } catch (error: unknown) {
    logger.error('最新市場レート取得エラー:', error)
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch latest market rate'
    })
  }
})