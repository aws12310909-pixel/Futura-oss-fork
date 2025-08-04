# 認証システム改善提案

## 現状の課題

### 1. 権限管理のハードコード
- `admin@example.com`のみが管理者として認識
- 権限マッピングが複数箇所で重複
- DynamoDBのpermissionsテーブルが未使用

### 2. セッション管理の簡素化
- DynamoDBのsessionsテーブルが未使用
- セッション無効化が困難

### 3. Cognitoグループ機能の未活用
- TerraformでCognitoグループが定義されているが実際には使用されていない

## 改善提案

### 1. 動的権限管理システム

#### 1.1 Cognitoグループとの連携

```typescript
// 改善案：Cognitoグループを実際に取得
import { CognitoIdentityProviderClient, AdminListGroupsForUserCommand } from '@aws-sdk/client-cognito-identity-provider'

export const getCognitoGroups = async (username: string): Promise<string[]> => {
  const config = useRuntimeConfig()
  const client = new CognitoIdentityProviderClient({ region: config.awsRegion })
  
  const command = new AdminListGroupsForUserCommand({
    UserPoolId: config.public.cognitoUserPoolId,
    Username: username
  })
  
  const response = await client.send(command)
  return response.Groups?.map(group => group.GroupName || '') || []
}
```

#### 1.2 DynamoDBベース権限管理

```typescript
// 改善案：DynamoDBから権限を動的取得
export const getPermissionsFromDB = async (groups: string[]): Promise<string[]> => {
  const dynamodb = getDynamoDBService()
  const tableName = dynamodb.getTableName('permissions')
  
  const permissions: string[] = []
  
  for (const group of groups) {
    try {
      const permission = await dynamodb.get(tableName, { group_name: group })
      if (permission?.permissions) {
        permissions.push(...JSON.parse(permission.permissions))
      }
    } catch (error) {
      console.warn(`Failed to get permissions for group ${group}:`, error)
    }
  }
  
  return [...new Set(permissions)] // 重複除去
}
```

#### 1.3 統一認証ユーティリティ

```typescript
// 改善案：認証ロジックの統一
export const verifyAuthToken = async (accessToken: string): Promise<AuthUser | null> => {
  try {
    const config = useRuntimeConfig()
    const client = new CognitoIdentityProviderClient({ region: config.awsRegion })
    
    // Cognitoからユーザー情報取得
    const userResponse = await client.send(new GetUserCommand({ AccessToken: accessToken }))
    
    if (!userResponse.UserAttributes) return null
    
    const attributes = userResponse.UserAttributes.reduce((acc, attr) => {
      if (attr.Name && attr.Value) acc[attr.Name] = attr.Value
      return acc
    }, {} as Record<string, string>)
    
    // 🔄 改善：Cognitoから実際のグループを取得
    const groups = await getCognitoGroups(attributes.email || '')
    
    // 🔄 改善：DynamoDBから権限を動的取得
    const permissions = await getPermissionsFromDB(groups)
    
    return {
      user_id: attributes.sub || '',
      email: attributes.email || '',
      name: attributes.name || '',
      groups,
      permissions
    }
  } catch (error) {
    console.error('Token verification error:', error)
    return null
  }
}
```

### 2. セッション管理の強化

#### 2.1 DynamoDBセッション管理

```typescript
// 改善案：DynamoDBベースセッション管理
export const createSession = async (userId: string, accessToken: string): Promise<string> => {
  const dynamodb = getDynamoDBService()
  const tableName = dynamodb.getTableName('sessions')
  
  const sessionId = crypto.randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24時間後
  
  await dynamodb.put(tableName, {
    session_id: sessionId,
    user_id: userId,
    cognito_token: accessToken,
    login_time: now.toISOString(),
    status: 'active',
    expires_at: Math.floor(expiresAt.getTime() / 1000) // Unix timestamp for TTL
  })
  
  return sessionId
}

export const validateSession = async (sessionId: string): Promise<AuthUser | null> => {
  const dynamodb = getDynamoDBService()
  const tableName = dynamodb.getTableName('sessions')
  
  const session = await dynamodb.get(tableName, { session_id: sessionId })
  
  if (!session || session.status !== 'active') {
    return null
  }
  
  // Cognitoトークンの検証
  return await verifyAuthToken(session.cognito_token)
}

export const invalidateSession = async (sessionId: string): Promise<void> => {
  const dynamodb = getDynamoDBService()
  const tableName = dynamodb.getTableName('sessions')
  
  await dynamodb.update(
    tableName,
    { session_id: sessionId },
    'SET #status = :status',
    { ':status': 'expired' },
    { '#status': 'status' }
  )
}
```

#### 2.2 改善されたrequireAuth

```typescript
// 改善案：セッションベース認証
export const requireAuth = async (event: H3Event): Promise<AuthUser> => {
  // 1. まずセッションIDをチェック
  const sessionId = getCookie(event, 'session_id')
  
  if (sessionId) {
    const user = await validateSession(sessionId)
    if (user) return user
  }
  
  // 2. フォールバック：直接トークンチェック
  const accessToken = getCookie(event, 'access_token')
  if (accessToken) {
    const user = await verifyAuthToken(accessToken)
    if (user) return user
  }
  
  throw createError({
    statusCode: 401,
    statusMessage: 'Authentication required'
  })
}
```

### 3. 権限システムの標準化

#### 3.1 権限名の統一

```typescript
// 改善案：権限名の標準化
export const PERMISSIONS = {
  // ユーザー管理
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  
  // プロファイル管理
  PROFILE_READ: 'profile:read',
  PROFILE_UPDATE: 'profile:update',
  PROFILE_APPROVE: 'profile:approve',
  
  // 取引管理
  TRANSACTION_CREATE: 'transaction:create',
  TRANSACTION_READ: 'transaction:read',
  
  // 市場レート管理
  MARKET_RATE_CREATE: 'market_rate:create',
  MARKET_RATE_READ: 'market_rate:read',
  
  // ダッシュボード
  DASHBOARD_ACCESS: 'dashboard:access',
  
  // 管理機能
  ADMIN_ACCESS: 'admin:access'
} as const

type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]
```

#### 3.2 権限チェックの改善

```typescript
// 改善案：型安全な権限チェック
export const requirePermission = async (
  event: H3Event, 
  permission: Permission
): Promise<AuthUser> => {
  const user = await requireAuth(event)
  
  if (!user.permissions.includes(permission)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Permission required: ${permission}`
    })
  }
  
  return user
}
```

### 4. ミドルウェア化

#### 4.1 Nuxtミドルウェア

```typescript
// middleware/auth.global.ts
export default defineNuxtRouteMiddleware((to) => {
  // 認証が必要なルート
  const protectedRoutes = ['/admin', '/dashboard', '/profile', '/transactions']
  
  if (protectedRoutes.some(route => to.path.startsWith(route))) {
    const { user } = useAuth()
    
    if (!user.value) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required'
      })
    }
  }
  
  // 管理者のみアクセス可能
  const adminRoutes = ['/admin']
  
  if (adminRoutes.some(route => to.path.startsWith(route))) {
    const { user } = useAuth()
    
    if (!user.value?.groups.includes('admin')) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Admin access required'
      })
    }
  }
})
```

#### 4.2 APIミドルウェア

```typescript
// server/middleware/auth.ts
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  
  // 管理用APIの自動権限チェック
  if (url.pathname.startsWith('/api/admin/')) {
    const user = await requireAuth(event)
    
    if (!user.groups.includes('admin')) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Admin access required'
      })
    }
    
    // コンテキストにユーザー情報を設定
    event.context.user = user
  }
  
  // 認証が必要なAPIの自動チェック
  const protectedPaths = ['/api/profile', '/api/dashboard', '/api/transactions']
  
  if (protectedPaths.some(path => url.pathname.startsWith(path))) {
    const user = await requireAuth(event)
    event.context.user = user
  }
})
```

## 実装優先度

### 🔴 高優先度
1. **権限名の統一** - 現在の不一致を解消
2. **Cognitoグループとの連携** - 既存インフラの活用
3. **権限管理の一元化** - コード重複の解消

### 🟡 中優先度
1. **DynamoDBセッション管理** - セキュリティ強化
2. **権限チェックの型安全性** - 開発効率向上
3. **APIミドルウェア** - 自動権限チェック

### 🟢 低優先度
1. **フロントエンドミドルウェア** - UX向上
2. **詳細なセッション管理** - 複数デバイス対応
3. **監査ログ** - セキュリティ強化

## 想定される効果

### セキュリティ向上
- 動的権限管理による柔軟性
- セッション管理の強化
- 権限チェックの漏れ防止

### 保守性向上
- コード重複の解消
- 型安全性の向上
- 一元化された権限管理

### 拡張性向上
- 新しい権限の簡単な追加
- ロールベースアクセス制御への拡張可能性
- 複数テナント対応への準備

---

この改善により、現在のハードコードされた権限システムから、柔軟で保守性の高い認証・認可システムへと進化させることができます。

## 実装チェックシート

### 🔴 高優先度実装タスク

#### 1. Cognitoグループベース権限管理
- [x] `administratorグループ`での権限制御実装
- [x] Cognitoグループ取得ユーティリティの実装
- [x] 統一された権限チェックミドルウェアの実装

#### 2. Cognitoグループ管理API
- [x] グループ一覧取得エンドポイント (`GET /api/admin/groups`)
- [x] グループ作成エンドポイント (`POST /api/admin/groups`)
- [x] グループ更新エンドポイント (`PUT /api/admin/groups/[groupName]`)
- [x] グループ削除エンドポイント (`DELETE /api/admin/groups/[groupName]`)

#### 3. ユーザーグループ管理API
- [x] ユーザーグループ参加エンドポイント (`POST /api/admin/users/[userId]/groups`)
- [x] ユーザーグループ脱退エンドポイント (`DELETE /api/admin/users/[userId]/groups/[groupName]`)
- [x] ユーザーの所属グループ取得エンドポイント (`GET /api/admin/users/[userId]/groups`)

#### 4. 認証ミドルウェア強化
- [x] `requireAuth`の改善（Cognitoグループ連携）
- [x] `requirePermission`の改善（administratorグループチェック）
- [x] APIルート自動権限チェックミドルウェア

#### 5. 型定義とユーティリティ
- [x] Cognitoグループ関連の型定義追加
- [x] グループ管理のユーティリティ関数実装
- [x] エラーハンドリングの統一

#### 6. API定義書の更新
- [x] 新しいCognitoグループ管理APIの追加
- [x] 管理者権限要件の明確化（administratorグループ）
- [x] エンドポイント構造の整理（/admin配下）

#### 7. DynamoDBベースセッション管理
- [x] UUIDv7セッションID生成機能
- [x] セッションレコード（JWT、IP、UA情報記録）
- [x] セッション検証・無効化機能
- [x] 自動有効期限管理（TTL対応）

#### 8. セッション管理API
- [x] セッション一覧取得エンドポイント (`GET /api/admin/sessions`)
- [x] セッション詳細取得エンドポイント (`GET /api/admin/sessions/[sessionId]`)
- [x] セッション強制無効化エンドポイント (`DELETE /api/admin/sessions/[sessionId]`)
- [x] ユーザーセッション一覧エンドポイント (`GET /api/admin/users/[userId]/sessions`)
- [x] ユーザー全セッション無効化エンドポイント (`DELETE /api/admin/users/[userId]/sessions`)

#### 9. AWS Client Factory（環境別認証）
- [x] ローカル・Lambda環境自動判定
- [x] クレデンシャル・IAMロール認証対応
- [x] DynamoDB・Cognito・S3クライアントファクトリー
- [x] 環境診断・接続テスト機能
- [x] ドキュメント整備

#### 10. セキュリティ強化
- [x] access_tokenのCookie保存廃止
- [x] session_idのみCookie保存（セキュリティ向上）
- [x] 機密情報のDynamoDB保護
- [x] ログイン・requireAuth統一（Cognitoグループベース）

### 🟡 中優先度実装タスク
- [ ] 権限管理UI（フロントエンド）の実装
- [ ] グループ管理画面の実装
- [ ] ユーザープロフィール管理画面の改善
- [ ] 詳細な権限設定機能

### 🟢 低優先度実装タスク
- [ ] 監査ログ機能
- [ ] 複数デバイスセッション管理
- [ ] 権限継承機能

---

**実装進捗：** 37/37 タスク完了

---

## 🎉 高優先度実装完了サマリー

✅ **Cognitoグループベース権限管理システム**
- administratorグループによる権限制御
- 動的グループ取得・権限管理
- 統一された認証ミドルウェア

✅ **包括的なAPI管理システム**
- グループ管理API（4エンドポイント）
- ユーザーグループ管理API（3エンドポイント）
- セッション管理API（5エンドポイント）

✅ **エンタープライズレベルセッション管理**
- UUIDv7ベースセッションID
- DynamoDB永続化（JWT・IP・UA記録）
- 自動有効期限・無効化機能

✅ **環境別AWS認証システム**
- ローカル/Lambda環境自動判定
- クレデンシャル/IAMロール認証
- 診断・接続テスト機能

✅ **セキュリティ大幅強化**
- Cookieから機密情報除去
- DynamoDBでの安全な情報管理
- 統一された権限チェック

---

## 📋 次に取り組むべきタスク

### 🎯 **推奨実装順序（中優先度）**

#### 1. **グループ管理画面の実装** 📊
**優先度: 最高**
- 管理者がCognitoグループを管理できるUI
- グループ一覧、作成、編集、削除機能
- ユーザーのグループ所属管理

**理由**: バックエンドAPIが完成しているため、即座に実装可能

#### 2. **権限管理UI（フロントエンド）の実装** 🔐
**優先度: 高**
- ユーザー権限の可視化
- グループ別権限表示
- 権限変更の確認ダイアログ

**理由**: セキュリティ運用上、権限の可視化が重要

#### 3. **ユーザープロフィール管理画面の改善** 👤
**優先度: 中**
- プロフィール承認ワークフローの改善
- セッション管理画面の追加
- ユーザー詳細画面の拡張

**理由**: ユーザビリティ向上とセッション管理の活用

#### 4. **詳細な権限設定機能** ⚙️
**優先度: 中**
- 権限の詳細設定画面
- 権限継承ルールの設定
- 権限監査機能

**理由**: より細かい権限制御が必要になった場合の準備

### 🛠️ **実装推奨事項**

#### **フロントエンド技術スタック**
- **Vue 3 Composition API** + TypeScript
- **Vuetify 3** (メインUI) + **Tailwind CSS** (ユーティリティ)
- **Pinia** (状態管理)

#### **実装パターン**
- **データ取得**: `$fetch` + Composables
- **エラーハンドリング**: 統一されたエラー処理
- **ローディング状態**: 適切なフィードバック
- **リアクティブ更新**: 操作後の自動データ更新

### 🎯 **具体的な次のステップ**

#### **即座に開始可能なタスク**
1. **`pages/admin/groups.vue` の実装**
   - グループ一覧表示（`GET /api/admin/groups`使用）
   - グループ作成ダイアログ（`POST /api/admin/groups`使用）
   - グループ編集・削除機能

2. **関連コンポーネントの実装**
   - `components/admin/GroupManagementDialog.vue`
   - `components/admin/UserGroupAssignmentDialog.vue`
   - `components/admin/GroupPermissionViewer.vue`

3. **ナビゲーション追加**
   - 管理者メニューにグループ管理リンク追加
   - 適切な権限チェック（administratorグループ）

#### **推奨実装フロー**
1. **UI設計** → Vuetifyコンポーネントでワイヤーフレーム作成
2. **API連携** → 既存エンドポイントとの接続
3. **エラーハンドリング** → 適切なフィードバック表示
4. **ユーザビリティテスト** → 管理者操作の検証

---

**次回の実装対象**: グループ管理画面の構築から開始することを推奨します 🚀