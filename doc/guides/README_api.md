# M・S CFD App - API ドキュメント

## 概要

このディレクトリには、M・S CFD App の RESTful API に関する詳細なドキュメントが含まれています。

## ドキュメント一覧

### 📋 [api_specification.md](./api_specification.md)
**API仕様書 - 完全リファレンス**

全APIエンドポイントの詳細な技術仕様書です。

**内容:**
- 全27個のAPIエンドポイント詳細仕様
- リクエスト・レスポンス形式
- 認証・認可要件
- エラーハンドリング
- セキュリティ考慮事項
- テスト用アカウント情報

**対象読者:** フロントエンド開発者、API利用者、テスター

## API概要

### 🔐 認証システム
- **認証方式**: Cookie認証 + AWS Cognito
- **セッション管理**: HTTP-only Cookie（24時間有効）
- **権限制御**: ロールベース（admin/user）

### 📊 APIカテゴリ

| カテゴリ | エンドポイント数 | 主要機能 |
|----------|-----------------|----------|
| **認証系** | 3個 | ログイン、認証情報取得、パスワード変更 |
| **ユーザー管理** | 8個 | CRUD、承認、停止、削除 |
| **取引管理** | 2個 | 履歴取得、取引作成 |
| **相場管理** | 3個 | 価格履歴、価格設定、最新価格 |
| **プロフィール** | 2個 | 取得、更新 |
| **ダッシュボード** | 1個 | 統合データ表示 |
| **ファイル** | 1個 | 画像アップロード |

### 🚀 主要エンドポイント

#### 🔑 認証・セッション
```http
POST /api/auth/login           # ログイン
GET  /api/auth/me             # 現在のユーザー情報
POST /api/auth/change-password # パスワード変更
```

#### 👥 ユーザー管理（管理者のみ）
```http
GET  /api/users               # ユーザー一覧
POST /api/users               # ユーザー作成
POST /api/users/{id}/approve  # プロフィール承認
POST /api/users/{id}/suspend  # ユーザー停止
```

#### 💰 取引管理
```http
GET  /api/transactions        # 取引履歴取得
POST /api/transactions        # 取引作成（管理者のみ）
```

#### 📈 相場管理
```http
GET  /api/market-rates        # 相場履歴
POST /api/market-rates        # 相場価格設定（管理者のみ）
GET  /api/market-rates/latest # 最新相場（パブリック）
```

## データ形式

### 📝 リクエスト形式
- **Content-Type**: `application/json`
- **ファイルアップロード**: `multipart/form-data`
- **認証**: Cookie自動送信

### 📤 レスポンス形式
```typescript
// 成功レスポンス
{
  success: true,
  data: T,           // レスポンスデータ
  message?: string   // オプションメッセージ
}

// エラーレスポンス
{
  statusCode: number,
  statusMessage: string
}

// ページング対応レスポンス
{
  success: true,
  data: {
    items: T[],
    total: number,
    page: number,
    limit: number,
    hasMore: boolean
  }
}
```

## 認証・認可

### 🔐 権限レベル

| ロール | 権限 | 説明 |
|--------|------|------|
| **admin** | 全権限 | ユーザー管理、取引作成、相場設定が可能 |
| **user** | 限定権限 | 自身のプロフィール・取引履歴の閲覧のみ |

### 🛡️ セキュリティ機能
- **Cookie認証**: HTTP-only, Secure, SameSite=Strict
- **権限チェック**: エンドポイントレベルでの細かい権限制御
- **入力検証**: 全パラメータのバリデーション
- **エラーハンドリング**: セキュアなエラーメッセージ

## 開発・テスト

### 🧪 テスト用アカウント

| 種別 | メールアドレス | パスワード | 権限 |
|------|---------------|------------|------|
| **管理者** | admin@example.com | TempPass123! | admin |
| **一般ユーザー** | user@example.com | password123 | user |

### 🔧 開発環境
- **ローカル**: `http://localhost:3000/api`
- **開発サーバー**: `https://dev.your-domain.com/api`

### 📋 APIテストチェックリスト

#### 認証系
- [ ] ログイン成功・失敗
- [ ] セッション有効期限
- [ ] パスワード変更（成功・失敗パターン）

#### ユーザー管理（管理者）
- [ ] ユーザー一覧取得（フィルタリング・ページング）
- [ ] ユーザー作成（バリデーション含む）
- [ ] プロフィール承認・拒否
- [ ] ユーザー停止・削除

#### 取引管理
- [ ] 取引履歴取得（フィルタリング）
- [ ] 取引作成（残高チェック含む）
- [ ] 残高計算の正確性

#### 相場管理
- [ ] 相場価格設定
- [ ] 価格履歴取得
- [ ] 最新価格取得

## API利用例

### JavaScript/TypeScript例

```typescript
// ログイン
const login = async (email: string, password: string) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include' // Cookie送信に必要
  });
  return response.json();
};

// ユーザー一覧取得
const getUsers = async (page = 1, limit = 20) => {
  const response = await fetch(`/api/users?page=${page}&limit=${limit}`, {
    credentials: 'include'
  });
  return response.json();
};

// 取引作成
const createTransaction = async (data: TransactionCreateForm) => {
  const response = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include'
  });
  return response.json();
};
```

### curl例

```bash
# ログイン
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"TempPass123!"}' \
  -c cookies.txt

# ユーザー一覧取得
curl -X GET http://localhost:3000/api/users \
  -b cookies.txt

# 画像アップロード
curl -X POST http://localhost:3000/api/upload/image \
  -F "file=@profile.jpg" \
  -b cookies.txt
```

## エラー対応

### よくあるエラーと対処法

| エラー | 原因 | 対処法 |
|--------|------|--------|
| `401 Unauthorized` | 未認証 | ログインしてセッション確立 |
| `403 Forbidden` | 権限不足 | 管理者権限が必要な操作 |
| `400 Bad Request` | バリデーションエラー | リクエストパラメータを確認 |
| `404 Not Found` | リソース未存在 | URLやIDを確認 |

## パフォーマンス

### 📊 レスポンス時間目標
- **認証API**: < 500ms
- **データ取得**: < 1000ms
- **データ更新**: < 1500ms
- **ファイルアップロード**: < 5000ms

### 🔄 ページング推奨
- **デフォルト件数**: 20件
- **最大件数**: 100件
- **大量データ**: 必ずページング使用

## 関連リソース

### 📁 プロジェクト構成
```
/server/api/
├── auth/              # 認証系API
├── users/             # ユーザー管理API
├── transactions/      # 取引管理API
├── market-rates/      # 相場管理API
├── profile/           # プロフィールAPI
├── dashboard/         # ダッシュボードAPI
└── upload/            # ファイルアップロードAPI

/types/
└── index.ts           # TypeScript型定義

/doc/
├── database_specification.md  # データベース仕様
└── er_diagram.md             # ER図
```

### 🔗 関連ドキュメント
- [データベース仕様書](./database_specification.md)
- [ER図](./er_diagram.md)
- [システム仕様書](./system_specification.md)

## サポート・問い合わせ

- **開発チーム**: システム開発チーム
- **更新日**: 2024年1月28日
- **バージョン**: 1.0

---

**📝 Note**: この API は開発中のため、仕様が変更される可能性があります。最新の情報は [api_specification.md](./api_specification.md) をご確認ください。