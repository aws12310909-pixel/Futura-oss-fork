import { requireAuth, requireAdministrator } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  
  // 管理者用APIの自動権限チェック
  if (url.pathname.startsWith('/api/admin/')) {
    try {
      const user = await requireAdministrator(event)
      // コンテキストにユーザー情報を設定
      event.context.user = user
    } catch (error) {
      // エラーをそのまま投げて適切なHTTPレスポンスを返す
      throw error
    }
    return
  }
  
  // 認証が必要なAPIの自動チェック
  const protectedPaths = [
    '/api/profile',
    '/api/dashboard',
    '/api/transactions',
    '/api/upload'
  ]
  
  if (protectedPaths.some(path => url.pathname.startsWith(path))) {
    try {
      const user = await requireAuth(event)
      event.context.user = user
    } catch (error) {
      // エラーをそのまま投げて適切なHTTPレスポンスを返す
      throw error
    }
  }
})