# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## 開発コマンド

```bash
# 開発
npm run dev              # 開発サーバー起動
npm install             # 依存関係インストール

# コード品質
npm run lint            # ESLint実行
npm run lint:fix        # ESLintの問題を自動修正
npm run typecheck       # TypeScript型チェック実行

# ビルド・デプロイ
npm run build           # 本番用ビルド
npm run generate        # 静的サイト生成
npm run preview         # 本番ビルドプレビュー
```

## アーキテクチャ概要

**Nuxt 3** と **AWS サービス** で構築されたBitcoinポートフォリオ管理シミュレーションアプリです。

### 技術スタック
- **フロントエンド**: Nuxt 3, Vue.js 3, TypeScript, Vuetify 3 + Tailwind CSS
- **バックエンド**: Nuxt Server API (Nitro), AWS Lambda
- **データベース**: AWS DynamoDB（複合キー PK + SK）
- **認証**: AWS Cognito User Pool（グループベース権限）
- **ストレージ**: AWS S3（ファイルアップロード）
- **インフラ**: Terraform（AWS リソース管理）

### 主要アーキテクチャパターン

**ハイブリッドUIフレームワーク**: メインのUIコンポーネントはVuetify 3を使用し、スペーシング・レイアウトユーティリティでTailwind CSSを補完。両システム間の競合を避ける。

**DynamoDBデザイン**: 複合キーとGSIを使用したNoSQLアプローチ。テーブル: users, transactions, market_rates, sessions, permissions。

**認証フロー**: AWS Cognito → HTTP-onlyセッションクッキー → DynamoDB permissionsテーブルでの権限検証。

**APIレスポンス形式**: 標準化された `{ success: boolean, data?: T, message?: string }`

## コンポーネント構成

コンポーネントはnuxt.config.tsで **pathPrefix: true** を使用:
- `~/components/admin/CreateUserDialog.vue` は `<AdminCreateUserDialog>` としてインポート
- `~/components/user/BalanceChart.vue` は `<UserBalanceChart>` としてインポート

ディレクトリ構造:
- `/components/admin/` - 管理者専用コンポーネント  
- `/components/auth/` - 認証コンポーネント
- `/components/common/` - 共有コンポーネント
- `/components/layout/` - レイアウトコンポーネント
- `/components/user/` - ユーザー専用コンポーネント

## 権限システム

異なるアクセスレベルを持つ2つの役割:
- **admin**: 完全なCRUD操作、ユーザー管理、取引作成
- **user**: 自身のデータ読み取り、プロフィール更新、ダッシュボード表示

APIルートは認可に `requirePermission(event, 'permission:action')` を使用。

## データベーステーブル・キー

- **users**: PK=`USER#{userId}`, SK=`PROFILE`
- **transactions**: PK=`USER#{userId}`, SK=`TRANSACTION#{timestamp}`
- **market_rates**: PK=`MARKET_RATE#{symbol}`, SK=`${timestamp}`
- **sessions**: PK=`SESSION#{sessionId}`, SK=`INFO`
- **permissions**: PK=`USER#{userId}`, SK=`PERMISSION#{resource}`

## 開発パターン

**APIルート構造**:
```typescript
export default defineEventHandler(async (event) => {
  const currentUser = await requirePermission(event, 'required:permission')
  const body = await readBody<TypedRequest>(event)
  const result = await performOperation(body)
  return { success: true, data: result }
})
```

**Vueコンポーネント構造**:
```vue
<script setup lang="ts">
// Composition APIと自動インポートを使用
// Props/Emits → リアクティブ状態 → 算出プロパティ → メソッド → ライフサイクル
</script>
```

## AWS統合

- **DynamoDB**: 操作には `getDynamoDBService()` ユーティリティを使用
- **Cognito**: グループベース権限（admin/user）、HTTP-onlyクッキーでセッション管理  
- **S3**: 安全なファイルアップロード用の署名付きURL、プロフィール画像ストレージ

## セキュリティ要件

- フロントエンドでAWS認証情報を公開しない
- 保護されたルートすべてでサーバーサイド認証
- セッション管理にHTTP-onlyクッキーを使用
- 入力検証とサニタイゼーション
- 権限の最小権限の原則

## テストアカウント

- **管理者**: admin@example.com / TempPass123!
- **ユーザー**: user@example.com / password123

## インフラストラクチャ

Terraformが `/infra/` ディレクトリ内のすべてのAWSリソースを管理。環境変数はNuxtランタイム設定でpublic/privateの分離で構成。

## コンポーネント命名規則

コンポーネント名にディレクトリプレフィックスを含むキャメルケースを使用:
- `BalanceChart` → `UserBalanceChart`
- サブディレクトリのコンポーネントは明確性のためディレクトリ名を含める