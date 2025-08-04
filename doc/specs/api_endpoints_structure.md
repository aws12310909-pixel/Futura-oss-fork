# APIエンドポイント構造

## 概要

BTC Mock AppのAPIエンドポイントは、管理用と一般用で明確に分離されています。管理用エンドポイントは `/api/admin/` 以下に配置され、一般用エンドポイントは `/api/` 直下に配置されています。

## エンドポイント分類

### 🔐 管理用エンドポイント (`/api/admin/`)

管理者権限が必要なエンドポイント群です。

#### ユーザー管理 (`/api/admin/users/`)

| メソッド | エンドポイント | 機能 | 権限 |
|---------|---------------|------|------|
| `GET` | `/api/admin/users` | ユーザー一覧取得 | `user:read` |
| `POST` | `/api/admin/users` | ユーザー作成 | `user:create` |
| `POST` | `/api/admin/users/{id}/approve` | プロファイル承認 | `profile:approve` |
| `POST` | `/api/admin/users/{id}/reject` | プロファイル拒否 | `profile:approve` |
| `POST` | `/api/admin/users/{id}/activate` | ユーザー有効化 | `user:update` |
| `POST` | `/api/admin/users/{id}/suspend` | ユーザー停止 | `user:update` |
| `POST` | `/api/admin/users/{id}/delete` | ユーザー削除 | `user:delete` |
| `POST` | `/api/admin/users/{id}/reset-password` | パスワードリセット | `user:update` |
| `GET` | `/api/admin/users/{id}/balance` | ユーザー残高取得 | `user:read` |

#### 取引管理 (`/api/admin/transactions/`)

| メソッド | エンドポイント | 機能 | 権限 |
|---------|---------------|------|------|
| `POST` | `/api/admin/transactions` | 取引作成（管理者による） | `transaction:create` |

#### 市場レート管理 (`/api/admin/market-rates/`)

| メソッド | エンドポイント | 機能 | 権限 |
|---------|---------------|------|------|
| `POST` | `/api/admin/market-rates` | 市場レート作成・更新 | `rate:create` |

### 👤 一般用エンドポイント (`/api/`)

認証ユーザーまたは一般公開のエンドポイント群です。

#### 認証 (`/api/auth/`)

| メソッド | エンドポイント | 機能 | 権限 |
|---------|---------------|------|------|
| `POST` | `/api/auth/login` | ログイン | なし |
| `POST` | `/api/auth/logout` | ログアウト | `requireAuth` |
| `POST` | `/api/auth/change-password` | パスワード変更 | `requireAuth` |
| `GET` | `/api/auth/me` | 現在ユーザー情報取得 | `requireAuth` |

#### プロファイル管理 (`/api/profile/`)

| メソッド | エンドポイント | 機能 | 権限 |
|---------|---------------|------|------|
| `GET` | `/api/profile` | プロファイル取得 | `profile:read` |
| `PUT` | `/api/profile` | プロファイル更新 | `profile:update` |

#### 取引履歴 (`/api/transactions/`)

| メソッド | エンドポイント | 機能 | 権限 |
|---------|---------------|------|------|
| `GET` | `/api/transactions` | 取引履歴取得<br/>（管理者: 全体、ユーザー: 自分のみ） | `transaction:read` |

#### 市場レート参照 (`/api/market-rates/`)

| メソッド | エンドポイント | 機能 | 権限 |
|---------|---------------|------|------|
| `GET` | `/api/market-rates` | 市場レート履歴取得 | `requireAuth` |
| `GET` | `/api/market-rates/latest` | 最新市場レート取得 | `requireAuth` |

#### ファイルアップロード (`/api/upload/`)

| メソッド | エンドポイント | 機能 | 権限 |
|---------|---------------|------|------|
| `POST` | `/api/upload/image` | 画像アップロード | `profile:update` |

#### ダッシュボード (`/api/dashboard/`)

| メソッド | エンドポイント | 機能 | 権限 |
|---------|---------------|------|------|
| `GET` | `/api/dashboard` | ダッシュボードデータ取得 | `dashboard:access` |

## 権限マッピング

### 管理者 (`admin` グループ)

```typescript
permissions: [
  'user:create',
  'user:read', 
  'user:update',
  'user:delete',
  'profile:approve',
  'transaction:create',
  'rate:create',
  'admin:access'
]
```

### 一般ユーザー (`user` グループ)

```typescript
permissions: [
  'profile:read',
  'profile:update', 
  'transaction:read',
  'dashboard:access'
]
```

## セキュリティ考慮事項

### 1. エンドポイント分離の利点

- **明確な権限境界**: 管理機能と一般機能の明確な分離
- **URLによる識別**: パスからアクセス権限が判別可能
- **ミスのリスク低減**: 一般ユーザーが管理機能にアクセスするリスクの軽減

### 2. 権限チェック

すべての管理用エンドポイントは以下のパターンで権限チェックを実行します：

```typescript
// 管理用エンドポイントの権限チェック例
const currentUser = await requirePermission(event, 'required:permission')
```

### 3. エラーハンドリング

| エラー | HTTPステータス | 説明 |
|--------|---------------|------|
| 認証エラー | 401 | トークンが無効または未設定 |
| 権限エラー | 403 | 必要な権限が不足 |
| データエラー | 404 | 対象データが存在しない |
| 入力エラー | 400 | リクエストデータが不正 |

## フロントエンド実装

### 管理者コンポーネント

管理者向けコンポーネントは `/api/admin/` エンドポイントを使用：

```typescript
// ユーザー作成
await $fetch('/api/admin/users', {
  method: 'POST',
  body: userCreateForm
})

// ユーザー承認
await $fetch(`/api/admin/users/${userId}/approve`, {
  method: 'POST'
})

// 取引作成
await $fetch('/api/admin/transactions', {
  method: 'POST', 
  body: transactionForm
})
```

### 一般ユーザーコンポーネント

一般ユーザー向けコンポーネントは `/api/` エンドポイントを使用：

```typescript
// プロファイル取得
await $fetch('/api/profile')

// 取引履歴取得
await $fetch('/api/transactions')

// ダッシュボードデータ取得
await $fetch('/api/dashboard')
```

## 今後の拡張

### 1. バージョニング

将来的にAPIバージョニングが必要な場合：

```
/api/v1/admin/users
/api/v1/profile
/api/v2/admin/users  # 新バージョン
```

### 2. レート制限

管理用と一般用でレート制限を分けることが可能：

```typescript
// 管理用: より緩いレート制限
'/api/admin/*': { rateLimit: '1000 per hour' }

// 一般用: より厳しいレート制限  
'/api/*': { rateLimit: '100 per hour' }
```

### 3. ログ・監査

管理用エンドポイントは特に詳細なログが必要：

```typescript
// 管理操作の監査ログ
auditLog.record({
  action: 'user:create',
  admin: currentUser.user_id,
  target: newUser.user_id,
  timestamp: now()
})
```

---

この構造により、機能とセキュリティレベルに応じた明確なAPI分離が実現され、保守性とセキュリティが向上しています。