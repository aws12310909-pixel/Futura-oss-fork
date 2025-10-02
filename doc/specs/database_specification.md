# M・S CFD App - データベース設計仕様書

## 概要

BTC Mock Appは、Bitcoin取引シミュレーションアプリケーションのためのデータベース設計仕様書です。
AWS DynamoDBを使用したNoSQLデータベース構成で、ユーザー管理、取引履歴、相場価格管理を行います。

## アーキテクチャ

- **データベース**: AWS DynamoDB (NoSQL)
- **認証**: AWS Cognito User Pool
- **ファイルストレージ**: AWS S3
- **アクセス制御**: IAM + カスタム権限システム

## データベーステーブル定義

### 1. Users テーブル

ユーザーの基本情報とプロフィール情報を管理します。

| フィールド名 | データ型 | 必須 | 説明 |
|------------|----------|------|------|
| user_id | String | ○ | ユーザー一意識別子（パーティションキー） |
| email | String | ○ | メールアドレス（ログインに使用） |
| name | String | ○ | ユーザー名 |
| address | String | ○ | 住所 |
| phone_number | String | ○ | 電話番号 |
| status | String | ○ | ユーザーステータス（active/suspended/deleted） |
| profile_image_url | String | × | プロフィール画像URL（S3） |
| profile_approved | Boolean | ○ | プロフィール承認状態 |
| rejection_reason | String | × | 承認拒否理由 |
| btc_address | String | ○ | Bitcoin アドレス |
| created_at | String | ○ | 作成日時（ISO 8601） |
| updated_at | String | ○ | 更新日時（ISO 8601） |
| deleted_at | String | × | 削除日時（論理削除） |

**制約・特徴:**
- パーティションキー: `user_id`
- Point-in-time Recovery有効
- 論理削除によるデータ保持

### 2. Transactions テーブル

BTC入出金取引の履歴を管理します。入金リクエスト機能に対応するため、承認ワークフローをサポートしています。

| フィールド名 | データ型 | 必須 | 説明 |
|------------|----------|------|------|
| transaction_id | String | ○ | 取引一意識別子（パーティションキー） |
| user_id | String | ○ | ユーザーID（ソートキー） |
| amount | Number | ○ | 取引金額（BTC） |
| transaction_type | String | ○ | 取引種別（deposit/withdrawal） |
| timestamp | String | ○ | 取引実行日時（ISO 8601） |
| created_by | String | ○ | 取引作成者ID |
| memo | String | ○ | 取引メモ |
| reason | String | ○ | 取引理由 |
| status | String | × | 取引状態（pending/approved/rejected）※既存データ互換性 |
| requested_at | String | × | リクエスト作成日時（ISO 8601） |
| processed_at | String | × | 承認/拒否処理日時（ISO 8601） |
| processed_by | String | × | 処理者のuser_id |
| rejection_reason | String | × | 拒否理由（status='rejected'の場合） |

**インデックス:**
- GSI: `UserTimestampIndex` (user_id, timestamp)
  - ユーザーごとの取引履歴を時系列で取得
- GSI: `StatusIndex` (status, requested_at)
  - 承認待ちリクエスト一覧の効率的な取得
- GSI: `TransactionUserStatusIndex` (user_id, status)
  - ユーザー別の状態別取引取得

**制約・特徴:**
- パーティションキー: `transaction_id`
- ソートキー: `user_id`
- Point-in-time Recovery有効
- 新機能: 入金リクエスト承認ワークフロー対応
- 下位互換性: 既存データはstatus='approved'として扱われる

### 3. Market_rates テーブル

BTCの相場価格履歴を管理します。

| フィールド名 | データ型 | 必須 | 説明 |
|------------|----------|------|------|
| rate_id | String | ○ | レート識別子（パーティションキー） |
| timestamp | String | ○ | 価格設定日時（ソートキー） |
| btc_jpy_rate | Number | ○ | BTC/JPY相場価格 |
| created_by | String | ○ | 価格設定者ID |
| created_at | String | ○ | レコード作成日時 |

**インデックス:**
- GSI: `TimestampIndex` (timestamp)
  - 時系列での価格履歴取得

**制約・特徴:**
- パーティションキー: `rate_id`
- ソートキー: `timestamp`
- Point-in-time Recovery有効

### 4. Sessions テーブル

ユーザーのログインセッション情報を管理します。

| フィールド名 | データ型 | 必須 | 説明 |
|------------|----------|------|------|
| session_id | String | ○ | セッション一意識別子（パーティションキー） |
| user_id | String | ○ | ユーザーID |
| cognito_access_token | String | ○ | Cognitoアクセストークン |
| cognito_id_token | String | ○ | CognitoIDトークン |
| cognito_refresh_token | String | × | Cognitoリフレッシュトークン |
| login_time | String | ○ | ログイン日時（ISO 8601） |
| last_access_time | String | ○ | 最終アクセス日時（ISO 8601） |
| ip_address | String | ○ | IPアドレス |
| user_agent | String | ○ | ユーザーエージェント |
| status | String | ○ | セッション状態（active/expired/revoked） |
| expires_at | Number | ○ | セッション有効期限（Unix timestamp） |

**インデックス:**
- GSI: `UserSessionIndex` (user_id)
  - ユーザーごとのセッション管理

**制約・特徴:**
- パーティションキー: `session_id`
- TTL有効（expires_at）による自動削除
- Point-in-time Recovery有効
- ログアウト時はレコード削除

### 5. Permissions テーブル

ユーザーグループの権限定義を管理します。

| フィールド名 | データ型 | 必須 | 説明 |
|------------|----------|------|------|
| group_name | String | ○ | グループ名（パーティションキー） |
| permissions | List | ○ | 権限リスト |
| description | String | ○ | グループ説明 |
| created_at | String | ○ | 作成日時 |
| updated_at | String | ○ | 更新日時 |

**初期データ:**

#### Administrator権限
```json
{
  "group_name": "administrator",
  "permissions": [
    "user:create", "user:read", "user:update", "user:delete",
    "admin:access", "group:create", "group:read", "group:update", "group:delete",
    "transaction:create", "transaction:read",
    "market_rate:create", "market_rate:read",
    "dashboard:access"
  ],
  "description": "Full administrative permissions"
}
```

#### User権限
```json
{
  "group_name": "user",
  "permissions": [
    "profile:read", "profile:update",
    "transaction:read", "dashboard:access",
    "market_rate:read"
  ],
  "description": "Standard user permissions"
}
```

**制約・特徴:**
- パーティションキー: `group_name`
- Point-in-time Recovery有効

## 認証・認可システム

### AWS Cognito User Pool

| 設定項目 | 値 | 説明 |
|----------|---|------|
| パスワードポリシー | 最小8文字、小文字・数字必須 | セキュリティ設定 |
| 自動検証属性 | email | メール認証必須 |
| トークン有効期限 | Access: 24h, Refresh: 30日 | セッション管理 |
| グループ | administrator, user | 権限グループ |

### ユーザーグループ
- **administrator**: 管理者権限（precedence: 0）
- **user**: 一般ユーザー権限（precedence: 1）

### セッション管理
- Cognitoトークンの安全な保存
- HTTPオンリーCookieによるセッションID管理
- 自動期限切れ（TTL）によるセッション削除
- ユーザーごとのセッション追跡・管理

## ファイルストレージ

### AWS S3 Bucket設定

| 設定項目 | 値 | 説明 |
|----------|---|------|
| バケット名 | `{project}-{env}-uploads` | 命名規則 |
| アクセス制御 | プライベート | パブリックアクセス禁止 |
| 暗号化 | AES256 | サーバーサイド暗号化 |
| バージョニング | 有効 | ファイル履歴管理 |
| ライフサイクル | 90日で旧バージョン削除 | ストレージ最適化 |

## データアクセスパターン

### 1. ユーザー管理
- **作成**: Users テーブルへの新規ユーザー登録
- **認証**: Cognito User Pool での認証
- **プロフィール更新**: Users テーブルの更新
- **権限確認**: Permissions テーブルからグループ権限取得

### 2. 取引管理
- **取引記録**: Transactions テーブルへの新規取引追加
- **履歴取得**: UserTimestampIndex を使用した効率的な履歴取得
- **残高計算**: ユーザーごとの取引履歴から残高算出

### 3. 相場管理
- **価格更新**: Market_rates テーブルへの新規価格データ追加
- **最新価格取得**: TimestampIndex を使用した最新価格取得
- **価格履歴**: 時系列での価格変動データ取得

### 4. セッション管理
- **セッション作成**: ログイン時に新規セッション作成
- **セッション検索**: UserSessionIndex を使用したユーザー別検索
- **セッション削除**: ログアウト時またはTTLによる自動削除
- **アクティブセッション管理**: 管理者による全セッション監視

## セキュリティ考慮事項

### 1. データ保護
- Point-in-time Recovery による障害対策
- 暗号化による機密性確保
- バックアップとバージョニング

### 2. アクセス制御
- IAM による最小権限の原則
- Cognito による認証
- カスタム権限システムによる認可

### 3. 監査・ログ
- 作成日時・更新日時の記録
- 操作者の記録（created_by）
- セッション管理による不正アクセス検知
- IP アドレス・ユーザーエージェント記録

### 4. トークン管理
- Cognitoトークンの安全な保存
- セッションIDのHTTPオンリーCookie
- リフレッシュトークンの適切な管理

## パフォーマンス設計

### 1. DynamoDB設計
- 適切なパーティションキー設計
- GSI による効率的なクエリ
- PAY_PER_REQUEST による自動スケーリング

### 2. キャッシュ戦略
- セッション情報のキャッシュ
- 相場価格の短期キャッシュ
- ユーザー権限のキャッシュ

### 3. セッション最適化
- TTLによる自動期限切れ
- インデックスによる高速検索
- バッチ処理による期限切れセッション削除

## 運用・保守

### 1. バックアップ
- Point-in-time Recovery による自動バックアップ
- S3 バージョニングによるファイルバックアップ

### 2. 監視
- DynamoDB メトリクス監視
- セッション利用状況監視
- エラーログ監視

### 3. 災害復旧
- マルチAZ構成
- 自動フェイルオーバー
- データ復旧手順

### 4. メンテナンス
- 期限切れセッションの自動削除
- 古い取引データのアーカイブ
- ユーザーアクティビティレポート

---

**作成日**: 2024年1月28日
**最終更新**: 2025年1月29日
**バージョン**: 2.0
**作成者**: システム開発チーム

**変更履歴**:
- v2.0 (2025/1/29): セッション管理テーブル詳細化、権限システム更新、セキュリティ強化
- v1.0 (2024/1/28): 初版作成