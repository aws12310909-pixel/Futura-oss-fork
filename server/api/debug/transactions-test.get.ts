import { getDynamoDBService } from '~/server/utils/dynamodb'
import { useLogger } from '~/composables/useLogger'

export default defineEventHandler(async (event) => {
  const logger = useLogger({ prefix: '[TransactionsDebug]' })
  
  try {
    // 認証確認
    const currentUser = await requireAuth(event)
    logger.debug('認証されたユーザー:', { 
      userId: currentUser.user_id, 
      email: currentUser.email,
      groups: currentUser.groups,
      permissions: currentUser.permissions 
    })

    const dynamodb = getDynamoDBService()
    
    // テーブル名確認
    const transactionsTableName = dynamodb.getTableName('transactions')
    const usersTableName = dynamodb.getTableName('users')
    
    logger.debug('テーブル名:', { transactionsTableName, usersTableName })

    // トランザクションテーブルのスキャン（最大10件）
    const scanResult = await dynamodb.scan(transactionsTableName, { limit: 10 })
    logger.debug('transactionsテーブル スキャン結果:', {
      itemCount: scanResult.items.length,
      items: scanResult.items
    })

    // ユーザーの存在確認
    const userCheck = await dynamodb.get(usersTableName, { user_id: currentUser.user_id })
    logger.debug('ユーザー存在確認:', { exists: !!userCheck, user: userCheck })

    // 特定ユーザーのトランザクション取得テスト
    let userTransactions: any[] = []
    try {
      const queryResult = await dynamodb.query(
        transactionsTableName,
        'user_id = :user_id',
        { ':user_id': currentUser.user_id },
        {
          indexName: 'UserTimestampIndex',
          scanIndexForward: false
        }
      )
      userTransactions = queryResult.items
      logger.debug('ユーザートランザクションクエリ結果:', {
        userId: currentUser.user_id,
        count: userTransactions.length,
        items: userTransactions
      })
    } catch (queryError) {
      logger.error('ユーザートランザクションクエリエラー:', queryError)
    }

    return {
      success: true,
      data: {
        user: {
          userId: currentUser.user_id,
          email: currentUser.email,
          groups: currentUser.groups,
          permissions: currentUser.permissions
        },
        tables: {
          transactionsTableName,
          usersTableName
        },
        debug: {
          allTransactionsCount: scanResult.items.length,
          userTransactionsCount: userTransactions.length,
          userExists: !!userCheck,
          hasTransactionReadPermission: currentUser.permissions.includes('transaction:read')
        },
        data: {
          allTransactions: scanResult.items,
          userTransactions
        }
      }
    }
  } catch (error: unknown) {
    logger.error('デバッグエラー:', error)
    
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error
      }
    }
  }
})