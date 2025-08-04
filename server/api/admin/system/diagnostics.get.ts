import { requireAdministrator } from '~/server/utils/auth'
import { getEnvironmentDiagnostics, testAWSConnections } from '~/server/utils/client-factory'
import type { ApiResponse } from '~/types'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  try {
    // administrator権限チェック
    await requireAdministrator(event)

    const query = getQuery(event)
    const includeConnectionTest = query.test === 'true'

    let diagnostics = getEnvironmentDiagnostics()
    let connectionTest = null

    if (includeConnectionTest) {
      connectionTest = await testAWSConnections()
    }

    return {
      success: true,
      data: {
        diagnostics,
        connectionTest,
        timestamp: new Date().toISOString()
      },
      message: 'System diagnostics retrieved successfully'
    }
  } catch (error: any) {
    console.error('Failed to get system diagnostics:', error)

    // 認証/認可エラーはそのまま投げる
    if (error.statusCode === 401 || error.statusCode === 403) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve system diagnostics'
    })
  }
})