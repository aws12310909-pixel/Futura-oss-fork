# BTC Mock App - セキュリティ仕様書

## 概要

BTC Mock Appにおけるセキュリティ要件と実装指針を定めた仕様書です。認証・認可、データ保護、脅威対策、監査ログについて詳細に記載しています。

## セキュリティ設計方針

### 基本原則
1. **最小権限の原則**: ユーザーには必要最小限の権限のみを付与
2. **多層防御**: 複数のセキュリティ層による保護
3. **ゼロトラスト**: 内部ネットワークも信頼しない設計
4. **透明性**: セキュリティ操作の可視化と監査

### コンプライアンス
- **データ保護**: 個人情報保護に関する基本的な要件
- **金融系アプリケーション**: 仮想通貨関連サービスのセキュリティ要件
- **AWS WAF**: クラウドセキュリティベストプラクティス

## 認証・認可システム

### 認証方式

#### AWS Cognito User Pools
- **ユーザー管理**: Cognitoによる集中管理
- **パスワードポリシー**: 
  - 最小8文字
  - 小文字・数字必須
  - 大文字・特殊文字推奨
- **アカウントロック**: 5回連続失敗で30分間ロック
- **多要素認証**: 将来実装予定（SMS/TOTP）

#### セッション管理
```typescript
// セッション構造
interface Session {
  session_id: string          // セッション識別子
  user_id: string            // ユーザーID
  cognito_access_token: string  // アクセストークン
  cognito_id_token: string     // IDトークン
  cognito_refresh_token?: string // リフレッシュトークン
  expires_at: number          // 有効期限（24時間）
  ip_address: string          // 発行元IPアドレス
  user_agent: string          // ユーザーエージェント
  status: 'active' | 'expired' | 'revoked'
}
```

#### トークン管理
- **アクセストークン**: 24時間有効
- **リフレッシュトークン**: 30日間有効
- **保存方式**: DynamoDBセッションテーブル（暗号化）
- **Cookie設定**: HTTPオンリー、Secure、SameSite=Strict

### 認可システム

#### 権限モデル
```typescript
// 権限定義
const PERMISSIONS = {
  // ユーザー管理
  'user:create': '新規ユーザー作成',
  'user:read': 'ユーザー情報閲覧',
  'user:update': 'ユーザー情報更新',
  'user:delete': 'ユーザー削除',
  
  // 取引管理
  'transaction:create': '取引作成',
  'transaction:read': '取引履歴閲覧',
  
  // 相場管理
  'market_rate:create': '相場価格設定',
  'market_rate:read': '相場価格閲覧',
  
  // 管理機能
  'admin:access': '管理者画面アクセス',
  'group:manage': 'グループ管理',
  
  // その他
  'profile:read': 'プロフィール閲覧',
  'profile:update': 'プロフィール更新',
  'dashboard:access': 'ダッシュボードアクセス'
}
```

#### ロールベースアクセス制御（RBAC）
```typescript
// 管理者権限
const ADMIN_PERMISSIONS = [
  'user:create', 'user:read', 'user:update', 'user:delete',
  'transaction:create', 'transaction:read',
  'market_rate:create', 'market_rate:read',
  'admin:access', 'group:manage',
  'dashboard:access'
]

// 一般ユーザー権限
const USER_PERMISSIONS = [
  'profile:read', 'profile:update',
  'transaction:read', 'market_rate:read',
  'dashboard:access'
]
```

#### 権限チェック実装
```typescript
// サーバーサイド権限チェック
export async function requirePermission(event: Event, permission: string) {
  const user = await requireAuth(event)
  const userPermissions = await getUserPermissions(user.user_id)
  
  if (!userPermissions.includes(permission)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Permission denied'
    })
  }
  
  return user
}
```

## データ保護

### 暗号化

#### 保存時暗号化
- **DynamoDB**: AWS KMS管理キーによる暗号化
- **S3**: AES-256暗号化
- **機密データ**: 追加のアプリケーションレベル暗号化

#### 転送時暗号化
- **HTTPS**: 全通信でTLS 1.2以上を強制
- **内部通信**: AWS内部ネットワークでの暗号化通信
- **API**: 全APIエンドポイントでHTTPS必須

### データ分類

#### 機密度レベル
1. **最高機密**: Cognitoトークン、パスワード
2. **機密**: 個人情報、取引データ
3. **内部**: システム設定、ログ
4. **公開**: 相場価格（latest）

#### データ処理原則
- **最小化**: 必要最小限のデータのみ収集・保存
- **仮名化**: 可能な場合は識別子の仮名化
- **保存期間**: データの種類に応じた保存期間設定
- **削除**: 不要になったデータの確実な削除

### 個人情報保護

#### 収集データ
```typescript
interface PersonalData {
  // 必須個人情報
  email: string           // メールアドレス
  name: string           // 氏名
  address: string        // 住所
  phone_number: string   // 電話番号
  
  // オプション
  profile_image_url?: string  // プロフィール画像
  
  // システム生成
  user_id: string        // 内部ID（UUID）
  btc_address: string    // Bitcoin アドレス（ダミー）
}
```

#### データ主体の権利
- **アクセス権**: 自身のデータ閲覧
- **修正権**: 不正確なデータの修正
- **削除権**: アカウント削除（論理削除）
- **ポータビリティ**: データエクスポート機能

## API セキュリティ

### 入力検証

#### バリデーション戦略
1. **型チェック**: TypeScriptによる静的型チェック
2. **値検証**: 各フィールドの値範囲・形式チェック
3. **ビジネスロジック**: 業務ルールに基づく検証
4. **サニタイゼーション**: 危険な文字の除去・エスケープ

#### 実装例
```typescript
// ユーザー作成時のバリデーション
const createUserSchema = {
  email: {
    type: 'string',
    format: 'email',
    maxLength: 254
  },
  name: {
    type: 'string',
    minLength: 1,
    maxLength: 100,
    pattern: '^[a-zA-Z0-9\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF\\s]+$'
  },
  password: {
    type: 'string',
    minLength: 8,
    pattern: '^(?=.*[a-z])(?=.*\\d).+$'
  }
}
```

### レート制限

#### 制限設定
```typescript
const RATE_LIMITS = {
  // 認証API（より厳しい制限）
  'auth/login': { requests: 5, window: '15min' },
  'auth/logout': { requests: 10, window: '1min' },
  
  // 一般API
  'api/*': { requests: 100, window: '1min' },
  
  // ファイルアップロード
  'upload/*': { requests: 5, window: '1min' },
  
  // 管理者API
  'admin/*': { requests: 200, window: '1min' }
}
```

#### 実装方式
- **キー**: IPアドレス + ユーザーID
- **ストレージ**: Redis（将来実装）
- **レスポンス**: 429 Too Many Requests
- **ヘッダー**: X-RateLimit-* ヘッダーで残り回数を通知

### CORS設定

```typescript
// CORS設定
const corsOptions = {
  origin: [
    'https://btc-mock-app.com',           // 本番環境
    'https://staging.btc-mock-app.com',   // ステージング
    'http://localhost:3000'               // 開発環境
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}
```

## フロントエンドセキュリティ

### XSS対策

#### 自動エスケープ
- **Vue.js**: テンプレート内の自動HTMLエスケープ
- **v-html使用時**: サニタイゼーション必須
- **動的スクリプト**: 原則禁止

#### CSP（Content Security Policy）
```http
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self' https://api.btc-mock-app.com;
```

### CSRF対策

#### トークンベース認証
- **Cookie**: セッションIDのみ（HTTPオンリー）
- **CSRF**: SameSite=Strict設定で対策
- **API認証**: Bearerトークン不使用

### セキュアCookie設定

```typescript
// Cookie設定
const cookieOptions = {
  httpOnly: true,        // XSS対策
  secure: true,          // HTTPS必須
  sameSite: 'strict',    // CSRF対策
  maxAge: 24 * 60 * 60,  // 24時間
  path: '/'
}
```

## インフラセキュリティ

### AWS セキュリティ設定

#### DynamoDB
- **暗号化**: AWS KMS管理キー
- **バックアップ**: Point-in-time Recovery
- **アクセス制御**: IAM ポリシーによる最小権限
- **監査**: CloudTrail によるAPI呼び出し記録

#### S3
- **バケットポリシー**: パブリックアクセス禁止
- **暗号化**: Server-Side Encryption (SSE-S3)
- **バージョニング**: 有効化
- **アクセスログ**: 有効化

#### Lambda
- **実行ロール**: 最小権限のIAMロール
- **環境変数**: 機密情報はAWS Secrets Manager使用
- **VPC**: 必要に応じてVPC内配置
- **モニタリング**: CloudWatch による監視

#### Cognito
- **パスワードポリシー**: 強固な設定
- **MFA**: SMS認証（将来実装）
- **ブルートフォース対策**: アカウントロック機能
- **監査**: CloudTrail による認証ログ

### ネットワークセキュリティ

#### AWS WAF設定
```typescript
const wafRules = [
  // SQLインジェクション対策
  { type: 'SQLInjection', action: 'BLOCK' },
  
  // XSS対策
  { type: 'XSS', action: 'BLOCK' },
  
  // 地理的制限
  { type: 'GeoMatch', countries: ['JP'], action: 'ALLOW' },
  
  // レート制限
  { type: 'RateLimit', limit: 1000, window: 300 }
]
```

## 監査・ログ

### ログ設計

#### セキュリティイベント
```typescript
interface SecurityLog {
  timestamp: string
  event_type: 'login' | 'logout' | 'permission_denied' | 'suspicious_activity'
  user_id?: string
  ip_address: string
  user_agent: string
  details: {
    success: boolean
    error_code?: string
    resource?: string
    action?: string
  }
}
```

#### アプリケーションログ
- **認証イベント**: ログイン成功/失敗、ログアウト
- **認可イベント**: 権限チェック、アクセス拒否
- **データアクセス**: 機密データの閲覧・変更
- **管理操作**: ユーザー作成、権限変更、システム設定

#### インフラログ
- **CloudTrail**: AWS API呼び出し
- **VPC Flow Logs**: ネットワークトラフィック
- **WAF Logs**: Web攻撃の検知・ブロック
- **CloudWatch Logs**: アプリケーションログ

### 監査要件

#### 保存期間
- **セキュリティログ**: 1年間
- **アクセスログ**: 6ヶ月間
- **エラーログ**: 3ヶ月間
- **デバッグログ**: 1週間

#### 監査レポート
- **月次**: セキュリティインシデント集計
- **四半期**: 権限レビュー
- **年次**: セキュリティ評価

## 脅威モデル・対策

### 脅威分析

#### 外部脅威
1. **不正アクセス**: ブルートフォース攻撃、辞書攻撃
2. **データ侵害**: SQLインジェクション、XSS
3. **サービス拒否**: DDoS攻撃、APIへの大量リクエスト
4. **中間者攻撃**: 通信傍受、証明書偽装

#### 内部脅威
1. **権限昇格**: 不正な管理者権限取得
2. **データ漏洩**: 内部関係者による機密情報流出
3. **設定ミス**: セキュリティ設定の不備

### 対策マトリックス

| 脅威 | 対策 | 実装状況 |
|------|------|----------|
| ブルートフォース攻撃 | アカウントロック、レート制限 | ✅ 実装済み |
| SQLインジェクション | DynamoDB使用、入力検証 | ✅ 実装済み |
| XSS | Vue.js自動エスケープ、CSP | ✅ 実装済み |
| CSRF | SameSite Cookie、トークン認証 | ✅ 実装済み |
| データ漏洩 | 暗号化、アクセス制御 | ✅ 実装済み |
| DDoS | AWS WAF、CloudFlare | 🔄 部分実装 |
| 中間者攻撃 | HTTPS強制、HSTS | ✅ 実装済み |

## インシデント対応

### 対応フロー

#### 検知・分析
1. **自動検知**: CloudWatch アラーム、WAF ブロック
2. **手動確認**: ログ分析、異常パターンの特定
3. **影響評価**: 被害範囲、データ漏洩の可能性

#### 封じ込め・復旧
1. **即座の対応**: 攻撃元IP遮断、セッション無効化
2. **システム隔離**: 影響を受けたコンポーネントの分離
3. **復旧作業**: バックアップからの復元、設定修正

#### 事後対応
1. **原因分析**: ログ解析、脆弱性特定
2. **対策実施**: セキュリティパッチ、設定強化
3. **文書化**: インシデントレポート作成

### 緊急連絡先

```typescript
const INCIDENT_CONTACTS = {
  security_team: 'security@company.com',
  infrastructure: 'infra@company.com',
  management: 'ciso@company.com',
  aws_support: 'AWS Enterprise Support'
}
```

## セキュリティテスト

### テスト種別

#### 脆弱性スキャン
- **静的解析**: ESLint security rules、CodeQL
- **動的解析**: OWASP ZAP、Burp Suite
- **依存関係**: npm audit、Snyk

#### ペネトレーションテスト
- **頻度**: 年2回
- **範囲**: Web アプリケーション、API、インフラ
- **手法**: Black box、Gray box テスト

#### セキュリティコードレビュー
- **タイミング**: 全プルリクエスト
- **観点**: 認証・認可、入力検証、機密情報取り扱い
- **ツール**: GitHub Advanced Security、SonarQube

## 今後の改善計画

### 短期的な改善（3ヶ月以内）
1. **多要素認証**: SMS/TOTP 認証の実装
2. **レート制限**: Redis による分散レート制限
3. **セキュリティヘッダー**: より厳格なCSP設定

### 中期的な改善（6ヶ月以内）
1. **SIEM導入**: セキュリティ情報イベント管理システム
2. **暗号化強化**: アプリケーションレベル暗号化
3. **ゼロトラスト**: より細かい権限制御

### 長期的な改善（1年以内）
1. **SOC構築**: セキュリティオペレーションセンター
2. **自動対応**: AI による脅威検知・自動対応
3. **コンプライアンス**: 各種セキュリティ認証取得

---

**作成日**: 2025年1月29日  
**バージョン**: 1.0  
**作成者**: システム開発チーム

**変更履歴**:
- v1.0 (2025/1/29): 初版作成 - 現在のシステムセキュリティ状況を基に包括的仕様を策定