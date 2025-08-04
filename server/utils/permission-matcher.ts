import { API_PERMISSIONS, type PermissionConfig } from './api-permissions'

export function getRequiredPermissions(
  path: string, 
  method: string
): PermissionConfig | null {
  // 完全一致チェック
  const exactMatch = API_PERMISSIONS[path]
  if (exactMatch) {
    return resolvePermissionConfig(exactMatch, method)
  }
  
  // パターンマッチング（具体的なパターンから順にチェック）
  const patterns = Object.keys(API_PERMISSIONS).sort((a, b) => {
    // ワイルドカードが少ない方を優先（具体的なパターンを先に）
    const aWildcards = (a.match(/\*/g) || []).length
    const bWildcards = (b.match(/\*/g) || []).length
    return aWildcards - bWildcards
  })
  
  for (const pattern of patterns) {
    if (matchesPattern(path, pattern)) {
      const config = API_PERMISSIONS[pattern]
      return resolvePermissionConfig(config, method)
    }
  }
  
  return null
}

function matchesPattern(path: string, pattern: string): boolean {
  // ワイルドカード (*) とダブルワイルドカード (**) をサポート
  const regex = pattern
    .replace(/\*\*/g, '.*')  // ** -> .*
    .replace(/\*/g, '[^/]*') // * -> [^/]*
    
  return new RegExp(`^${regex}$`).test(path)
}

function resolvePermissionConfig(
  config: PermissionConfig | Record<string, PermissionConfig>,
  method: string
): PermissionConfig | null {
  // 直接的なPermissionConfigの場合
  if ('permissions' in config || 'authOnly' in config) {
    return config as PermissionConfig
  }
  
  // HTTPメソッド別設定の場合
  const methodConfigs = config as Record<string, PermissionConfig>
  const methodConfig = methodConfigs[method]
  return methodConfig || null
}