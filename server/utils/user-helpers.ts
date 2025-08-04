// 1. 内部server utils
import { getDynamoDBService } from './dynamodb'

// 2. 内部composables（ユニバーサル）
import { useLogger } from '~/composables/useLogger'

// 3. Types
import type { User } from '~/types'

// Server-side logger
const logger = useLogger({ prefix: '[USER-HELPERS]' })

/**
 * DynamoDBからuser_idでユーザーのemailを取得
 * @param userId - DynamoDBのuser_id（UUID）
 * @returns ユーザーのemail
 * @throws エラー: ユーザーが見つからない場合やemailが存在しない場合
 */
export const getUserEmailById = async (userId: string): Promise<string> => {
  try {
    const dynamodb = getDynamoDBService()
    const usersTableName = dynamodb.getTableName('users')
    
    logger.info(`DynamoDBからユーザー情報を取得中: userId=${userId}`)
    const user = await dynamodb.get(usersTableName, { user_id: userId }) as User | null
    
    if (!user) {
      logger.error(`DynamoDBにユーザーが見つかりません: userId=${userId}`)
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found in database'
      })
    }
    
    if (!user.email) {
      logger.error(`ユーザーのemailが見つかりません: userId=${userId}`)
      throw createError({
        statusCode: 400,
        statusMessage: 'User email not found'
      })
    }
    
    logger.info(`ユーザーのemail取得成功: userId=${userId}, email=${user.email}`)
    return user.email
  } catch (error) {
    logger.error(`getUserEmailById失敗: userId=${userId}`, error)
    throw error
  }
}

/**
 * DynamoDBからuser_idでユーザー情報を取得
 * @param userId - DynamoDBのuser_id（UUID）
 * @returns ユーザー情報
 * @throws エラー: ユーザーが見つからない場合
 */
export const getUserById = async (userId: string): Promise<User> => {
  try {
    const dynamodb = getDynamoDBService()
    const usersTableName = dynamodb.getTableName('users')
    
    logger.info(`DynamoDBからユーザー情報を取得中: userId=${userId}`)
    const user = await dynamodb.get(usersTableName, { user_id: userId }) as User | null
    
    if (!user) {
      logger.error(`DynamoDBにユーザーが見つかりません: userId=${userId}`)
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found in database'
      })
    }
    
    logger.info(`ユーザー情報取得成功: userId=${userId}`)
    return user
  } catch (error) {
    logger.error(`getUserById失敗: userId=${userId}`, error)
    throw error
  }
}