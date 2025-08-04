# BTC Mock App - フロントエンド仕様書

## 概要

BTC Mock Appのフロントエンド（クライアントサイド）の詳細設計仕様書です。ユーザーインターフェース、コンポーネント設計、状態管理、画面遷移について記載しています。

## 技術スタック

### フレームワーク・ライブラリ
- **フレームワーク**: Nuxt 3.8+
- **言語**: TypeScript 5.0+
- **UIフレームワーク**: Vuetify 3.4+
- **状態管理**: Pinia
- **アイコン**: Material Design Icons (MDI)
- **CSS**: Tailwind CSS 3.0+
- **リント**: ESLint + Prettier

### 開発・ビルドツール
- **パッケージマネージャー**: npm
- **バンドラー**: Vite (Nuxt内蔵)
- **テスト**: Vitest
- **型チェック**: TypeScript

## UI/UXデザインシステム

### デザインテーマ
- **デザインスタイル**: モダン・ミニマル
- **カラースキーム**: ブルー系プライマリ、グレー系セカンダリ
- **コンポーネント**: Material Design 3準拠（Vuetify）
- **レスポンシブ**: モバイルファースト設計

### カラーパレット
```scss
// Primary Colors (Bitcoin/Crypto theme)
--primary-50: #eff6ff
--primary-100: #dbeafe
--primary-500: #3b82f6  // メインブルー
--primary-600: #2563eb
--primary-900: #1e3a8a

// Secondary Colors
--secondary-50: #f8fafc
--secondary-100: #f1f5f9
--secondary-500: #64748b  // グレー
--secondary-600: #475569

// Semantic Colors
--success: #10b981      // 緑 (取引成功、増加)
--warning: #f59e0b      // オレンジ (注意)
--error: #ef4444        // 赤 (エラー、減少)
--info: #06b6d4         // 青 (情報)
```

### タイポグラフィ
- **メインフォント**: 日本語 - Noto Sans JP、英数字 - Inter
- **モノスペース**: JetBrains Mono (数値表示用)
- **フォントサイズ**: Tailwind CSS標準スケール使用

### アイコンシステム
- **アイコンライブラリ**: Material Design Icons (MDI)
- **主要アイコン**:
  - Bitcoin: `mdi:bitcoin`
  - ダッシュボード: `mdi:view-dashboard`
  - ユーザー: `mdi:account`
  - 取引: `mdi:swap-horizontal`
  - 設定: `mdi:cog`

## アプリケーション構造

### レイアウトシステム

#### 1. 認証レイアウト (`layouts/auth.vue`)
- **用途**: ログイン・認証画面
- **特徴**: 
  - 中央配置のカードレイアウト
  - グラデーション背景
  - Bitcoinアイコンとブランディング
- **適用ページ**: `/login`

#### 2. デフォルトレイアウト (`layouts/default.vue`)
- **用途**: 認証後のメイン画面
- **特徴**:
  - サイドナビゲーション + メインコンテンツ
  - レスポンシブ対応（モバイルではナビゲーション折りたたみ）
  - 固定ヘッダー無し（ナビゲーションが兼任）

### ナビゲーション設計

#### サイドナビゲーション (`components/layout/AppNavigation.vue`)
- **表示方式**: 常時表示（デスクトップ）、ドロワー（モバイル）
- **レール機能**: デスクトップで折りたたみ可能
- **構成要素**:
  - ヘッダー: ロゴ + ユーザー名
  - ユーザーナビゲーション: 基本機能
  - 管理者ナビゲーション: 管理者のみ表示
  - フッター: ログアウト等

#### ナビゲーション項目
**ユーザー向け:**
- ダッシュボード (`/dashboard`)
- 取引履歴 (`/transactions`)
- プロフィール (`/profile`)

**管理者向け:**
- ユーザー管理 (`/admin/users`)
- 承認管理 (`/admin/approvals`)
- 取引管理 (`/admin/transactions`)
- 相場管理 (`/admin/rates`)
- グループ管理 (`/admin/groups`)

## 画面設計

### 1. ダッシュボード (`pages/dashboard.vue`)

#### レイアウト構成
- **ヘッダー**: タイトル + 更新ボタン
- **メトリクスカード**: 4列グリッド（レスポンシブ）
  - 現在残高（BTC）
  - 資産価値（JPY）
  - 最新相場
  - 変動率
- **チャートセクション**: 残高推移グラフ
- **取引履歴**: 最近の取引一覧

#### コンポーネント
- `BalanceChart.vue`: 残高推移チャート表示

### 2. 取引履歴 (`pages/transactions.vue`)

#### 機能
- 取引履歴の一覧表示
- フィルタリング（入金/出金、期間）
- ページング
- 取引詳細表示

#### コンポーネント
- `TransactionDetailsDialog.vue`: 取引詳細モーダル

### 3. プロフィール (`pages/profile.vue`)

#### 機能
- 基本情報の表示・編集
- プロフィール画像アップロード
- パスワード変更

#### コンポーネント
- `ImageViewerDialog.vue`: 画像表示モーダル

### 4. 管理者画面

#### ユーザー管理 (`pages/admin/users.vue`)
- **機能**: ユーザー一覧、作成、編集、停止/有効化
- **コンポーネント**:
  - `CreateUserDialog.vue`: ユーザー作成
  - `UserDetailsDialog.vue`: ユーザー詳細
  - `ResetPasswordDialog.vue`: パスワードリセット
  - `UserGroupAssignmentDialog.vue`: グループ割り当て

#### 承認管理 (`pages/admin/approvals.vue`)
- **機能**: プロフィール承認、画像確認
- **コンポーネント**:
  - `ImageViewerDialog.vue`: 画像表示

#### 取引管理 (`pages/admin/transactions.vue`)
- **機能**: 取引作成、履歴確認
- **コンポーネント**:
  - `CreateTransactionDialog.vue`: 取引作成

#### 相場管理 (`pages/admin/rates.vue`)
- **機能**: 相場価格設定、履歴確認
- **コンポーネント**:
  - `CreateMarketRateDialog.vue`: 相場価格設定

#### グループ管理 (`pages/admin/groups.vue`)
- **機能**: Cognitoグループ管理
- **コンポーネント**:
  - `GroupManagementDialog.vue`: グループ作成・編集
  - `GroupPermissionViewer.vue`: 権限表示

## コンポーネント設計

### 設計原則
- **単一責任の原則**: 各コンポーネントは一つの機能に集中
- **再利用性**: 共通UIパターンのコンポーネント化
- **プロパティ指向**: 外部からの設定による柔軟性
- **エミット基準**: 親子間通信は明示的なイベント

### コンポーネント分類

#### 1. レイアウトコンポーネント
- `layout/AppNavigation.vue`: メインナビゲーション

#### 2. 認証コンポーネント
- `auth/LoginForm.vue`: ログインフォーム
- `auth/ChangeInitialPasswordDialog.vue`: 初期パスワード変更

#### 3. 管理者コンポーネント
- `admin/CreateUserDialog.vue`: ユーザー作成
- `admin/CreateTransactionDialog.vue`: 取引作成
- `admin/CreateMarketRateDialog.vue`: 相場設定
- `admin/GroupManagementDialog.vue`: グループ管理
- `admin/UserDetailsDialog.vue`: ユーザー詳細
- 他多数の管理機能ダイアログ

#### 4. ユーザーコンポーネント
- `user/BalanceChart.vue`: 残高チャート
- `user/TransactionDetailsDialog.vue`: 取引詳細
- `user/ImageViewerDialog.vue`: 画像表示

#### 5. 共通コンポーネント
- `common/NotificationSnackbar.vue`: 通知表示

### コンポーネント設計パターン

#### ダイアログコンポーネント
```vue
<template>
  <v-dialog v-model="modelValue" max-width="600px">
    <v-card>
      <v-card-title>{{ title }}</v-card-title>
      <v-card-text>
        <!-- コンテンツ -->
      </v-card-text>
      <v-card-actions>
        <v-btn @click="$emit('update:modelValue', false)">
          キャンセル
        </v-btn>
        <v-btn @click="handleSubmit">
          保存
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
```

#### フォームバリデーション
```typescript
const emailRules = [
  (v: string) => !!v || 'メールアドレスは必須です',
  (v: string) => /.+@.+\..+/.test(v) || '有効なメールアドレスを入力してください'
]
```

## 状態管理

### Pinia Store設計

#### 認証ストア (`stores/auth.ts`)
```typescript
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  permissions: string[]
  groups: string[]
}

// Actions
- login(credentials)
- logout()
- checkAuth()
- updateProfile(data)
```

### 共通Composables

#### `useAuth.ts`
- 認証状態の管理
- ユーザー情報の取得
- 権限チェック機能

#### `useNotification.ts`
- 成功・エラーメッセージの表示
- スナックバー管理

## レスポンシブデザイン

### ブレイクポイント
```scss
// Vuetify標準ブレイクポイント使用
xs: 0-599px     // モバイル
sm: 600-959px   // タブレット（小）
md: 960-1263px  // タブレット（大）
lg: 1264-1903px // デスクトップ
xl: 1904px+     // ワイドスクリーン
```

### レスポンシブ対応

#### ナビゲーション
- **デスクトップ**: 固定サイドバー（折りたたみ可能）
- **タブレット**: ドロワー方式
- **モバイル**: ハンバーガーメニュー

#### グリッドレイアウト
- **デスクトップ**: 4列グリッド
- **タブレット**: 2列グリッド
- **モバイル**: 1列グリッド

#### フォント・スペーシング
- モバイルでは若干小さめのフォントサイズ
- タッチターゲットサイズの確保（44px以上）

## パフォーマンス設計

### 最適化戦略
1. **コンポーネント遅延読み込み**: 重いコンポーネントの動的インポート
2. **画像最適化**: WebP形式の使用、適切なサイズ設定
3. **バンドル分割**: 管理者機能の別バンドル化
4. **キャッシュ戦略**: API レスポンスの適切なキャッシュ

### Nuxt最適化設定
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  css: ['vuetify/lib/styles/main.sass', '@/assets/css/main.css'],
  build: {
    transpile: ['vuetify']
  },
  ssr: true,
  nitro: {
    preset: 'aws-lambda'
  }
})
```

## アクセシビリティ

### WCAG 2.1準拠
- **AA レベル**: 基本的な要件を満たす
- **キーボードナビゲーション**: 全機能をキーボードで操作可能
- **スクリーンリーダー対応**: 適切なARIAラベル設定
- **カラーコントラスト**: 4.5:1以上のコントラスト比

### 実装要件
- フォーカス表示の明確化
- 適切なheading構造
- フォームラベルの明示
- エラーメッセージの分かりやすい表示

## セキュリティ考慮事項

### フロントエンドセキュリティ
- **XSS対策**: Vue.jsの自動エスケープ機能活用
- **CSRF対策**: APIトークンによる認証
- **機密情報**: ローカルストレージへの機密情報保存禁止
- **入力検証**: クライアントサイド・サーバーサイド両方で実施

### 認証・認可
- セッションベース認証（Cookie）
- 権限による画面・機能の動的表示/非表示
- ルートガードによるアクセス制御

## テスト戦略

### 単体テスト（Vitest）
```typescript
// コンポーネントテスト例
describe('LoginForm', () => {
  it('正しい値でログインフォームが送信される', async () => {
    // テストコード
  })
})
```

### テスト対象
- 重要なビジネスロジック
- フォームバリデーション
- 状態管理（Store）
- Composables

## 今後の拡張予定

### 短期的な改善
- ダークモード対応
- PWA化（プログレッシブウェブアプリ）
- より詳細なチャート機能

### 長期的な拡張
- 国際化対応（i18n）
- リアルタイム更新（WebSocket）
- オフライン対応

---

**作成日**: 2025年1月29日  
**バージョン**: 1.0  
**作成者**: システム開発チーム

**変更履歴**:
- v1.0 (2025/1/29): 初版作成 - 現在の実装状況を基に詳細仕様を策定