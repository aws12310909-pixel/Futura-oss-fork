# 権限制御ミドルウェア実装計画書

## 概要

現在の権限制御システムを改善し、ミドルウェアベースでの自動権限チェックシステムを実装する。
これにより、各APIエンドポイントでの権限チェックの統一化・自動化を実現し、保守性とセキュリティの向上を図る。

## 現在の問題点

### 1. 分散した権限チェック
- 各APIファイルで個別に`requireAuth()`や`requirePermission()`を実装
- 権限チェックの漏れやミスが発生しやすい
- 一貫性のない実装パターン

### 2. 未定義権限の使用
- `profile:approve`権限が定義ファイルに存在しない（✅修正済み）
- 実行時エラーのリスク

### 3. 保守性の問題
- 権限要件の変更時に複数ファイルの修正が必要
- 権限とAPIエンドポイントの対応関係が不明確

## 新しい設計方針

### 1. ミドルウェアベース権限制御
- URLパターンとHTTPメソッドベースでの自動権限チェック
- 権限設定の一元管理
- 既存コードへの最小限の影響

### 2. 段階的移行
- 既存システムとの併用期間を設ける
- 影響範囲を限定した段階的な実装

### 3. 型安全性の確保
- TypeScriptによる権限キーの型チェック
- コンパイル時の権限定義検証

## 実装詳細

### 1. 権限設定ファイル (`/server/utils/api-permissions.ts`)

```typescript
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
```

### 2. 権限マッチング関数

```typescript
// /server/utils/permission-matcher.ts
import { API_PERMISSIONS } from './api-permissions'

export function getRequiredPermissions(
  path: string, 
  method: string
): PermissionConfig | null {
  // 完全一致チェック
  const exactMatch = API_PERMISSIONS[path]
  if (exactMatch) {
    return resolvePermissionConfig(exactMatch, method)
  }
  
  // パターンマッチング
  for (const [pattern, config] of Object.entries(API_PERMISSIONS)) {
    if (matchesPattern(path, pattern)) {
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
  if ('permissions' in config || 'authOnly' in config) {
    return config
  }
  
  return config[method] || null
}
```

### 3. ミドルウェア実装 (`/server/middleware/permissions.ts`)

```typescript
import { getRequiredPermissions } from '~/server/utils/permission-matcher'
import { requireAuth } from '~/server/utils/auth'
import { getUserPermissionsByGroups } from '~/server/utils/permission-helpers'
import { validatePermissions } from '~/server/utils/permission-definitions'

export default defineEventHandler(async (event) => {
  const logger = useLogger({ prefix: '[PermissionMiddleware]' })
  const path = getRequestURL(event).pathname
  const method = getMethod(event)
  
  // API以外はスキップ
  if (!path.startsWith('/api/')) {
    return
  }
  
  // 認証API（login, logout等）はスキップ
  if (path.startsWith('/api/auth/')) {
    return
  }
  
  logger.debug(`権限チェック開始: ${method} ${path}`)
  
  try {
    const permissionConfig = getRequiredPermissions(path, method)
    
    if (!permissionConfig) {
      logger.warn(`権限設定が見つかりません: ${method} ${path}`)
      // 設定なしの場合は認証のみ要求（安全側に倒す）
      await requireAuth(event)
      return
    }
    
    // 認証のみの場合
    if (permissionConfig.authOnly) {
      logger.debug('認証のみチェック')
      await requireAuth(event)
      return
    }
    
    // 権限チェック
    if (permissionConfig.permissions && permissionConfig.permissions.length > 0) {
      logger.debug(`権限チェック: ${permissionConfig.permissions.join(', ')}`)
      
      const user = await requireAuth(event)
      
      // 権限バリデーション
      const { valid, invalid } = validatePermissions(permissionConfig.permissions)
      if (invalid.length > 0) {
        logger.error(`無効な権限が指定されています: ${invalid.join(', ')}`)
        throw createError({
          statusCode: 500,
          statusMessage: `Invalid permissions specified: ${invalid.join(', ')}`
        })
      }
      
      // 権限チェック
      const hasPermissions = permissionConfig.permissions.map(permission => 
        user.permissions.includes(permission)
      )
      
      const operator = permissionConfig.operator || 'AND'
      const isAuthorized = operator === 'OR'
        ? hasPermissions.some(Boolean)
        : hasPermissions.every(Boolean)
      
      if (!isAuthorized) {
        logger.warn(`権限不足: ${user.email}, 必要権限: ${permissionConfig.permissions.join(` ${operator} `)}`)
        throw createError({
          statusCode: 403,
          statusMessage: `Insufficient permissions. Required: ${permissionConfig.permissions.join(` ${operator} `)}`
        })
      }
      
      logger.success(`権限チェック成功: ${user.email}`)
    }
    
  } catch (error) {
    logger.error(`権限チェックエラー: ${method} ${path}`, error)
    throw error
  }
})
```

## 移行手順

### Phase 1: ミドルウェア実装
1. ✅ 権限定義ファイルに`profile:approve`を追加（完了）
2. 🔄 権限設定ファイル作成
3. 🔄 権限マッチング関数実装
4. 🔄 ミドルウェア実装

### Phase 2: 動作検証
1. 既存APIとの並行動作確認
2. 権限チェックの重複実行テスト
3. 管理者権限の自動継承確認

### Phase 3: 既存コード削除
1. 各APIファイルから`requireAuth`/`requirePermission`削除
2. 動作確認
3. 不要なimport文削除

### Phase 4: 最適化
1. パフォーマンス測定
2. ログ出力の調整
3. エラーハンドリングの改善

## 影響範囲

### 修正対象ファイル（権限チェック削除）
- `server/api/admin/users/index.get.ts`
- `server/api/admin/users/index.post.ts`
- `server/api/admin/users/[userId]/approve.post.ts`
- `server/api/admin/users/[userId]/reject.post.ts`
- `server/api/admin/users/[userId]/reset-password.post.ts`
- `server/api/admin/users/[userId]/suspend.post.ts`
- `server/api/admin/users/[userId]/activate.post.ts`
- `server/api/admin/users/[userId]/delete.post.ts`
- `server/api/admin/transactions/index.get.ts`
- `server/api/admin/transactions/index.post.ts`
- `server/api/admin/transactions/[transactionId]/status.patch.ts`
- `server/api/admin/market-rates/index.post.ts`
- `server/api/admin/market-rates/[rateId]/index.get.ts`
- `server/api/admin/market-rates/[rateId]/index.put.ts`
- `server/api/transactions/index.get.ts`
- `server/api/transactions/request.post.ts`
- `server/api/profile/index.get.ts`
- `server/api/profile/index.put.ts`
- `server/api/market-rates/index.get.ts`
- `server/api/dashboard/index.get.ts`
- `server/api/upload/image.post.ts`

### 新規作成ファイル
- `server/utils/api-permissions.ts`
- `server/utils/permission-matcher.ts`
- `server/middleware/permissions.ts`

## テスト計画

### 1. 単体テスト
- 権限マッチング関数のテスト
- ワイルドカードパターンのテスト
- HTTPメソッド別権限解決のテスト

### 2. 統合テスト
- 各APIエンドポイントの権限チェック
- 管理者権限の継承テスト
- 未認証・権限不足時のエラーレスポンステスト

### 3. 回帰テスト
- 既存機能の動作確認
- ユーザー・管理者フローの確認

## 利点

### 1. 保守性向上
- 権限設定の一元管理
- 権限要件の変更時の影響範囲限定
- 明確な権限とAPIの対応関係

### 2. セキュリティ向上
- 権限チェック漏れの防止
- 一貫した権限チェックロジック
- 型安全性による設定ミス防止

### 3. 開発効率向上
- 新規API開発時の権限チェック自動化
- 権限要件の可視化
- デバッグ時の権限問題特定の容易化

## 注意点・リスク

### 1. パフォーマンス
- 全APIリクエストでパターンマッチング処理
- 複雑なワイルドカードパターンの処理コスト

### 2. 移行時の互換性
- 既存APIと新ミドルウェアの並行動作
- 権限チェックの重複実行

### 3. 設定ミス
- 権限設定ファイルの設定ミス
- パターンマッチングの期待外動作

## 今後の拡張予定

### 1. 権限設定の動的変更
- 管理画面からの権限設定変更
- 設定変更のリアルタイム反映

### 2. 監査ログ強化
- 権限チェック結果の詳細ログ
- 権限設定変更履歴

### 3. 権限継承の改善
- 管理者権限の自動継承ロジック強化
- グループベース権限継承

---

**作成日**: 2025年1月27日  
**更新日**: 2025年1月27日  
**作成者**: AI Assistant  
**承認者**: 未定