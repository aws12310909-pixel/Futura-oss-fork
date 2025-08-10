import { requirePermission } from '~/server/utils/auth'
import { syncCognitoToDatabase } from '~/server/utils/cognito-sync'
import { useLogger } from '~/composables/useLogger'

export default defineEventHandler(async (event) => {
  const logger = useLogger({ prefix: '[SystemCognitoSync]' })
  
  try {
    // Require admin permission
    await requirePermission(event, 'admin:access')
    
    logger.info('Cognito同期処理開始')
    
    const syncResults = await syncCognitoToDatabase()
    
    logger.info('Cognito同期処理完了:', syncResults)
    
    return {
      success: true,
      data: {
        syncResults,
        message: `同期完了: ユーザー${syncResults.users.synced}人、権限${syncResults.permissions.synced}件、グループ${syncResults.groups.synced}件`
      }
    }
  } catch (error: unknown) {
    logger.error('Cognito同期エラー:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to sync with Cognito'
    })
  }
})