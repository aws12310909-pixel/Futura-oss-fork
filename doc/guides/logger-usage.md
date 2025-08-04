# ログ機能使用ガイド

## 概要

BTC Mock Appでは、[consola](https://github.com/unjs/consola)ライブラリを使用した統一されたログ出力システムを実装しています。`useLogger`コンポーザブルを通じて、フロントエンドとサーバーサイドの両方で一貫したログ出力を提供します。

## 基本的な使い方

### 1. 基本的なロガーの使用

```typescript
<script setup lang="ts">
const logger = useLogger({ prefix: '[COMPONENT]' })

// 各種ログレベル
logger.debug('デバッグ情報')
logger.info('一般的な情報')
logger.warn('警告メッセージ')
logger.error('エラーメッセージ')
logger.success('成功メッセージ')
</script>
```

### 2. 特定機能向けロガー

```typescript
// 認証関連
const authLogger = useLogger({ prefix: '[AUTH]' })
authLogger.auth.login('user@example.com')
authLogger.auth.logout('user@example.com')
authLogger.auth.sessionValidation(true, 'session123')
authLogger.auth.tokenVerification(false)

// API関連
const apiLogger = useLogger({ prefix: '[API]' })
apiLogger.api.request('POST', '/api/users')
apiLogger.api.response('POST', '/api/users', 201)
apiLogger.api.error('POST', '/api/users', error)

// データベース関連
const dbLogger = useLogger({ prefix: '[DB]' })
dbLogger.db.query('users', 'GET')
dbLogger.db.error('users', 'PUT', error)
```

### 3. 事前定義されたロガー

プロジェクトには以下の事前定義されたロガーがあります：

```typescript
import { logger, authLogger, apiLogger, dbLogger } from '~/composables/useLogger'

// 基本ロガー
logger.info('一般的なログ')

// 認証専用ロガー
authLogger.auth.login('user@example.com')

// API専用ロガー
apiLogger.api.request('GET', '/api/dashboard')

// DB専用ロガー
dbLogger.db.query('transactions', 'SCAN')
```

## ログレベル設定

### 開発環境とプロダクション環境

- **開発環境**: すべてのログが出力される (DEBUG以上)
- **プロダクション環境**: 重要なログのみ (INFO以上)

### カスタムログレベル

```typescript
const logger = useLogger({
  level: LogLevel.Warn, // WARNレベル以上のみ出力
  enableInProduction: true, // プロダクション環境でも出力
  prefix: '[CUSTOM]'
})
```

## 特殊なログメソッド

### プロセスライフサイクル

```typescript
logger.start('アプリケーション初期化開始')
logger.ready('認証初期化完了')
logger.fail('設定読み込み失敗')
```

### タグ付きロガー

```typescript
const componentLogger = logger.withTag('UserProfile')
componentLogger.info('プロファイル更新開始') // [COMPONENT] [UserProfile] プロファイル更新開始
```

### 重要なエラー（常に出力）

```typescript
logger.critical('システム障害発生') // プロダクション環境でも必ず出力
```

## サーバーサイドでの使用

```typescript
// server/api/example.ts
export default defineEventHandler(async (event) => {
  const logger = useLogger({ prefix: '[API]' })
  
  logger.api.request(getMethod(event), getRequestURL(event).pathname)
  
  try {
    const result = await processRequest()
    logger.api.response(getMethod(event), getRequestURL(event).pathname, 200)
    return result
  } catch (error) {
    logger.api.error(getMethod(event), getRequestURL(event).pathname, error)
    throw error
  }
})
```

## 移行例

### Before (console.log使用)

```typescript
console.log('🔑 Login attempt for:', email)
console.error('Login error:', error)
console.log('✅ User authenticated:', user.email)
```

### After (useLogger使用)

```typescript
const logger = useLogger({ prefix: '[AUTH]' })

logger.auth.login(email)
logger.error('Login error:', error)
logger.info('User authenticated:', user.email)
```

## ベストプラクティス

### 1. 適切なプレフィックスの使用

- コンポーネント: `[COMPONENT_NAME]`
- API: `[API]`
- 認証: `[AUTH]`
- データベース: `[DB]`
- サーバー: `[SERVER]`

### 2. 機能別ロガーの使用

```typescript
// ❌ 避けるべき
logger.info('認証トークンの検証に成功しました')

// ✅ 推奨
logger.auth.tokenVerification(true)
```

### 3. セキュリティ情報の保護

```typescript
// ❌ 危険
logger.info('User token:', accessToken)

// ✅ 安全
logger.info('User token:', accessToken ? '***exists***' : 'not found')
```

### 4. 環境に応じたログレベル

```typescript
// 開発時のみの詳細ログ
logger.debug('詳細なデバッグ情報')

// 重要な情報（両環境で出力）
logger.info('重要な処理完了')

// 常に出力が必要な重大エラー
logger.critical('システム障害')
```

## 設定オプション

```typescript
interface LoggerConfig {
  level?: LogLevel              // ログレベル (0-5)
  enableInProduction?: boolean  // プロダクション環境での出力
  prefix?: string              // ログプレフィックス
}
```

## エラー対応

ログ機能でエラーが発生した場合も、アプリケーションの動作に影響しないように設計されています。コンソールへのフォールバックが自動的に行われます。