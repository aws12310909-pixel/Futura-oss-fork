export interface PermissionConfig {
  permissions?: string[]
  operator?: 'AND' | 'OR'
  authOnly?: boolean
}

export interface APIPermissions {
  [path: string]: PermissionConfig | Record<string, PermissionConfig>
}

export const API_PERMISSIONS: APIPermissions = {
  // 管理者API全般
  '/api/admin/**': {
    permissions: ['admin:access'],
    operator: 'AND'
  },
  
  // 個別API権限（HTTPメソッド別）
  '/api/admin/users': {
    'GET': { permissions: ['user:read'] },
    'POST': { permissions: ['user:create'] }
  },
  
  '/api/admin/users/*/approve': {
    'POST': { permissions: ['profile:approve'] }
  },
  
  '/api/admin/users/*/reject': {
    'POST': { permissions: ['profile:approve'] }
  },
  
  '/api/admin/users/*/reset-password': {
    'POST': { permissions: ['user:update'] }
  },
  
  '/api/admin/users/*/suspend': {
    'POST': { permissions: ['user:update'] }
  },
  
  '/api/admin/users/*/activate': {
    'POST': { permissions: ['user:update'] }
  },
  
  '/api/admin/users/*/delete': {
    'POST': { permissions: ['user:delete'] }
  },
  
  '/api/admin/transactions': {
    'GET': { permissions: ['admin:transaction:read'] },
    'POST': { permissions: ['transaction:create'] }
  },
  
  '/api/admin/transactions/*/status': {
    'PATCH': { permissions: ['transaction:approve'] }
  },
  
  '/api/admin/market-rates': {
    'POST': { permissions: ['market_rate:create'] }
  },
  
  '/api/admin/market-rates/*': {
    'GET': { permissions: ['market_rate:read'] },
    'PUT': { permissions: ['market_rate:create'] }
  },
  
  '/api/admin/groups': {
    'POST': { permissions: ['group:create'] }
  },
  
  '/api/admin/groups/*': {
    'PUT': { permissions: ['group:update'] }
  },
  
  '/api/admin/system/sync-cognito': {
    'POST': { permissions: ['admin:access'] }
  },
  
  // ユーザーAPI
  '/api/transactions': {
    'GET': { permissions: ['transaction:read'] }
  },
  
  '/api/transactions/request': {
    'POST': { permissions: ['transaction:request'] }
  },
  
  '/api/profile': {
    'GET': { permissions: ['profile:read'] },
    'PUT': { permissions: ['profile:update'] }
  },
  
  '/api/market-rates': {
    'GET': { permissions: ['market_rate:read'] }
  },
  
  // 認証のみ（権限チェックなし）
  '/api/dashboard': {
    authOnly: true
  },
  
  '/api/upload/image': {
    authOnly: true
  }
}