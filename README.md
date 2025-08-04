# BTC Mock App

BTCポートフォリオ管理のモックアプリケーション。ユーザーがBTC残高を確認し、管理者が相場価格を設定してユーザーの資産価値を計算するシステムです。

## 技術スタック

### フロントエンド
- **Nuxt3** - Vue.jsフレームワーク
- **Vuetify** - UIコンポーネントライブラリ
- **TailwindCSS** - ユーティリティファーストCSS
- **Nuxt Icon** - アイコンシステム
- **TypeScript** - 型安全性
- **Pinia** - 状態管理

### バックエンド
- **AWS Cognito** - 認証・認可
- **DynamoDB** - NoSQLデータベース
- **S3** - ファイルストレージ
- **Lambda** - サーバーレスコンピューティング
- **Terraform** - インフラ管理

### 開発・テスト
- **Vitest** - テストフレームワーク
- **ESLint** - コード品質
- **AWS Amplify** - デプロイメント

## セットアップ

### 1. リポジトリのクローン
```bash
git clone <repository-url>
cd Futura-001
```

### 2. 依存関係のインストール
```bash
npm install
```

### 3. インフラのデプロイ
```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvarsを編集
terraform init
terraform plan
terraform apply
```

### 4. 環境変数の設定
```bash
cp .env.example .env
# .envファイルにTerraformの出力値を設定
```

### 5. 開発サーバーの起動
```bash
npm run dev
```

## プロジェクト構成

```
├── assets/          # 静的アセット
├── components/      # Vueコンポーネント
│   ├── auth/       # 認証関連
│   ├── common/     # 共通コンポーネント
│   ├── layout/     # レイアウトコンポーネント
│   ├── admin/      # 管理者画面用
│   └── user/       # ユーザー画面用
├── composables/     # Composition API関数
├── layouts/         # レイアウト定義
├── middleware/      # ルートミドルウェア
├── pages/          # ページコンポーネント
│   ├── admin/      # 管理者画面
│   └── auth/       # 認証画面
├── plugins/         # Nuxtプラグイン
├── server/         # サーバーサイドAPI
│   ├── api/        # APIエンドポイント
│   └── utils/      # サーバーユーティリティ
├── stores/         # Pinia状態管理
├── types/          # TypeScript型定義
├── infra/          # Terraformインフラ定義
└── doc/            # ドキュメント
```

## 主要機能

### ユーザー機能
- ログイン・ログアウト
- ダッシュボード（残高・資産価値表示）
- 入出金記録閲覧
- プロフィール管理
- パスワード変更

### 管理者機能
- ユーザー管理（作成・停止・削除）
- BTC相場価格設定
- 入出金管理
- プロフィール承認

## デプロイ

### Amplifyでのデプロイ
1. AWSコンソールでAmplifyアプリを作成
2. GitHubリポジトリを接続
3. `amplify.yml`設定ファイルが自動認識される
4. 環境変数を設定
5. デプロイ実行

### 環境変数（Amplify）
```
AWS_REGION=ap-northeast-1
COGNITO_USER_POOL_ID=<Terraform出力値>
COGNITO_CLIENT_ID=<Terraform出力値>
COGNITO_USER_POOL_DOMAIN=<Terraform出力値>
S3_BUCKET_NAME=<Terraform出力値>
```

## テスト

```bash
# リント実行
npm run lint

# 型チェック
npm run typecheck

# 単体テスト
npm run test
```

## デモアカウント

### 管理者
- **Email**: admin@example.com
- **Password**: TempPass123!

### 一般ユーザー
- **Email**: user@example.com  
- **Password**: password123

## ライセンス

Private License