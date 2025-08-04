# 認証システム シーケンス図

## 概要

BTC Mock Appの認証システムは、AWS Cognitoを基盤とした管理者主導のアカウント管理システムです。ユーザー自身による登録機能はなく、管理者がアカウントを作成し、段階的な承認プロセスを経て利用開始となります。

## 1. アカウント作成シーケンス

### 1.1 管理者によるユーザー作成

```mermaid
sequenceDiagram
    participant Admin as 管理者
    participant UI as CreateUserDialog
    participant API as API Server
    participant Cognito as AWS Cognito
    participant DDB as DynamoDB

    Note over Admin, DDB: ユーザー作成フロー

    Admin->>UI: 新規ユーザー作成ダイアログを開く
    UI->>Admin: フォーム表示<br/>(email, name, address, phone, temp_password)
    
    Admin->>UI: ユーザー情報を入力・送信
    UI->>API: POST /api/users
    Note right of UI: UserCreateForm<br/>- email: string<br/>- name: string<br/>- address: string<br/>- phone_number: string<br/>- temporary_password: string

    Note over API: requirePermission("user:create")
    API->>API: 管理者権限確認

    API->>Cognito: AdminCreateUserCommand
    Note right of Cognito: ユーザー作成設定<br/>- Username: email<br/>- TemporaryPassword: 仮パスワード<br/>- MessageAction: "SUPPRESS"<br/>- UserAttributes: email, name, email_verified
    Cognito-->>API: User作成完了 (User ID)

    API->>Cognito: AdminAddUserToGroupCommand
    Note right of Cognito: デフォルトグループ追加<br/>GroupName: "user"
    Cognito-->>API: グループ追加完了

    API->>API: ダミーBTCアドレス生成
    Note right of API: 形式: 1[random][random]

    API->>DDB: ユーザーレコード作成 (PUT)
    Note right of DDB: User テーブル<br/>- user_id: Cognito User ID<br/>- status: "active"<br/>- profile_approved: false<br/>- btc_address: 生成済みアドレス<br/>- created_at/updated_at: 現在時刻
    DDB-->>API: 作成完了

    API-->>UI: 成功レスポンス
    Note right of API: { success: true, data: User, message: "User created successfully" }
    UI-->>Admin: "ユーザーを作成しました" 表示

    Note over Admin, DDB: 仮パスワードの手動伝達
    Admin->>Admin: 新規ユーザーに仮パスワードを安全に伝達
```

### 1.2 データ構造

#### リクエスト（UserCreateForm）
```typescript
{
  email: string           // メールアドレス（Cognitoのusername）
  name: string           // 氏名
  address: string        // 住所
  phone_number: string   // 電話番号
  temporary_password: string  // 仮パスワード（8文字以上、小文字・数字必須）
}
```

#### 作成されるデータ
```typescript
// Cognito User Pool
{
  Username: email,
  TemporaryPassword: temporary_password,
  UserAttributes: [
    { Name: 'email', Value: email },
    { Name: 'name', Value: name },
    { Name: 'email_verified', Value: 'true' }
  ],
  Groups: ['user']
}

// DynamoDB users テーブル
{
  user_id: string,          // Cognito User ID
  email: string,
  name: string,
  address: string,
  phone_number: string,
  status: 'active',
  profile_approved: false,  // 承認待ち状態
  btc_address: string,      // 自動生成
  created_at: string,
  updated_at: string
}
```

## 2. ログイン・認証シーケンス

### 2.1 初回ログイン（パスワード変更必須）

```mermaid
sequenceDiagram
    participant User as 新規ユーザー
    participant UI as LoginForm
    participant API as API Server
    participant Cognito as AWS Cognito
    participant DDB as DynamoDB

    Note over User, DDB: 初回ログインフロー

    User->>UI: ログインページアクセス
    UI->>User: ログインフォーム表示

    User->>UI: 認証情報入力<br/>(email, temporary_password)
    UI->>API: POST /api/auth/login
    
    API->>Cognito: InitiateAuthCommand
    Note right of Cognito: AuthFlow: "USER_PASSWORD_AUTH"<br/>USERNAME: email<br/>PASSWORD: temporary_password
    
    alt 仮パスワードの場合
        Cognito-->>API: NewPasswordRequired Challenge
        API-->>UI: パスワード変更要求
        Note right of API: { challenge: "NEW_PASSWORD_REQUIRED" }
        
        UI->>User: パスワード変更フォーム表示
        User->>UI: 新しいパスワード入力
        UI->>API: POST /api/auth/change-password
        
        API->>Cognito: RespondToAuthChallengeCommand
        Note right of Cognito: ChallengeName: "NEW_PASSWORD_REQUIRED"<br/>NEW_PASSWORD: 新しいパスワード
        Cognito-->>API: 認証成功 + トークン
    else 通常ログイン
        Cognito-->>API: 認証成功 + トークン
    end

    API->>Cognito: GetUserCommand
    Note right of Cognito: AccessToken を使用してユーザー情報取得
    Cognito-->>API: ユーザー属性情報

    API->>API: グループ・権限情報取得
    Note right of API: admin@example.com なら admin グループ追加<br/>権限マッピング実行

    API->>API: セッションCookie設定
    Note right of API: HttpOnly Cookie<br/>- access_token<br/>- refresh_token<br/>- user_id

    API-->>UI: ログイン成功
    Note right of API: { success: true, user: AuthUser }
    
    UI->>UI: ダッシュボードにリダイレクト
```

### 2.2 通常ログイン

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as LoginForm
    participant API as API Server
    participant Cognito as AWS Cognito

    User->>UI: ログイン情報入力
    UI->>API: POST /api/auth/login

    API->>Cognito: InitiateAuthCommand
    Note right of Cognito: USER_PASSWORD_AUTH
    Cognito-->>API: 認証成功 + AccessToken

    API->>Cognito: GetUserCommand
    Cognito-->>API: ユーザー情報

    API->>API: セッション作成
    API-->>UI: ログイン成功 + Cookie設定

    UI->>UI: ダッシュボードリダイレクト
```

## 3. プロファイル承認シーケンス

### 3.1 承認プロセス

```mermaid
sequenceDiagram
    participant Admin as 管理者
    participant UI as Admin Console
    participant API as API Server
    participant DDB as DynamoDB
    participant User as 対象ユーザー

    Note over Admin, User: プロファイル承認フロー

    Admin->>UI: 管理者コンソールアクセス
    UI->>API: GET /api/users (承認待ちユーザー一覧)
    API->>DDB: クエリ実行
    Note right of DDB: profile_approved = false の<br/>ユーザーを取得
    DDB-->>API: 承認待ちユーザーリスト
    API-->>UI: ユーザー一覧表示

    Admin->>UI: 対象ユーザーの承認ボタンクリック
    UI->>API: POST /api/users/{id}/approve

    Note over API: requirePermission("profile:approve")
    API->>API: 管理者権限確認

    API->>DDB: ユーザー情報取得 (GET)
    DDB-->>API: ユーザーデータ

    alt ユーザーが存在し、承認可能な状態
        API->>DDB: 承認状態更新 (UPDATE)
        Note right of DDB: SET profile_approved = true,<br/>updated_at = 現在時刻
        DDB-->>API: 更新完了

        API-->>UI: 承認成功
        Note right of API: { success: true, message: "承認完了" }
        UI-->>Admin: 承認完了メッセージ表示

        Note over User: ユーザーは次回ログイン時から<br/>全機能が利用可能
    else エラーケース
        API-->>UI: エラーレスポンス
        Note right of API: 例: "User already approved"<br/>"User not found"<br/>"Cannot approve deleted user"
    end
```

### 3.2 承認取り消し

```mermaid
sequenceDiagram
    participant Admin as 管理者
    participant API as API Server
    participant DDB as DynamoDB

    Admin->>API: POST /api/users/{id}/reject
    Note right of Admin: { reason?: string }

    Note over API: requirePermission("profile:approve")
    API->>DDB: ユーザー承認状態を false に更新
    Note right of DDB: SET profile_approved = false,<br/>rejection_reason = 理由 (オプション),<br/>updated_at = 現在時刻

    API-->>Admin: 承認取り消し完了
```

## 4. セッション管理

### 4.1 認証状態確認

```mermaid
sequenceDiagram
    participant Client as クライアント
    participant API as API Server
    participant Cognito as AWS Cognito

    Note over Client, Cognito: 認証状態確認フロー

    Client->>API: GET /api/auth/me
    Note right of Client: Cookie: access_token

    API->>API: Cookieから access_token 取得
    
    alt トークンが存在
        API->>Cognito: GetUserCommand
        Note right of Cognito: AccessToken で検証
        
        alt トークンが有効
            Cognito-->>API: ユーザー情報
            API->>API: 権限情報生成
            API-->>Client: 認証済みユーザー情報
            Note right of API: { success: true, data: AuthUser }
        else トークンが無効
            Cognito-->>API: トークンエラー
            API-->>Client: 401 Unauthorized
        end
    else トークンが未設定
        API-->>Client: 401 Unauthorized
    end
```

### 4.2 ログアウト

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as Frontend
    participant API as API Server

    User->>UI: ログアウトボタンクリック
    UI->>API: POST /api/auth/logout

    API->>API: セッションCookie削除
    Note right of API: - access_token<br/>- refresh_token<br/>- user_id

    API-->>UI: ログアウト成功
    UI->>UI: ログインページリダイレクト
```

## 5. エラーハンドリング

### 5.1 認証エラーパターン

| エラーケース | HTTPステータス | メッセージ | 対応 |
|-------------|---------------|-----------|------|
| 無効な認証情報 | 401 | Invalid credentials | ログインフォームに戻る |
| 権限不足 | 403 | Insufficient permissions | エラーページ表示 |
| ユーザー不存在 | 404 | User not found | 管理者に連絡 |
| 既に承認済み | 400 | User profile is already approved | 状態確認 |
| 削除済みユーザー | 400 | Cannot approve deleted user | 状態確認 |
| トークン期限切れ | 401 | Token expired | 再ログイン要求 |

### 5.2 Cognitoエラー処理

```typescript
// よくあるCognitoエラー
try {
  await cognitoClient.send(command)
} catch (error) {
  if (error.name === 'UsernameExistsException') {
    // メールアドレス重複
    throw createError({ statusCode: 400, statusMessage: 'User already exists' })
  }
  if (error.name === 'NotAuthorizedException') {
    // 認証失敗
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }
  if (error.name === 'UserNotFoundException') {
    // ユーザー不存在
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }
}
```

## 6. セキュリティ考慮事項

### 6.1 パスワードポリシー

- **最小長**: 8文字
- **必須文字**: 小文字、数字
- **オプション**: 大文字、記号（本番環境では必須推奨）

### 6.2 セッション管理

- **Cookie設定**: HttpOnly, Secure, SameSite
- **トークン有効期限**: 
  - Access Token: 24時間
  - Refresh Token: 30日
- **自動ログアウト**: トークン期限切れ時

### 6.3 権限制御

```typescript
// 権限マッピング
const permissions = {
  admin: [
    'user:create', 'user:read', 'user:update', 'user:delete',
    'profile:approve', 'transaction:create', 'admin:access'
  ],
  user: [
    'profile:read', 'profile:update', 
    'transaction:read', 'dashboard:access'
  ]
}
```

## 7. 今後の拡張ポイント

### 7.1 自己登録機能
- ユーザー自身による仮登録
- 管理者による後日承認
- メール認証システム

### 7.2 多段階認証
- SMS認証
- TOTP (Time-based One-Time Password)
- デバイス記憶機能

### 7.3 自動化
- 承認プロセスの自動化
- 通知システム
- ログ監査機能

---

この認証シーケンスは、アプリ全体のワークフロー図の基盤となる重要な部分です。管理者主導の安全なアカウント管理を実現しています。