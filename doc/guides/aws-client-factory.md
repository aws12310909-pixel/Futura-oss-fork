# AWS Client Factory - 環境別認証システム

## 概要

AWS Client Factoryは、ローカル開発環境とLambda本番環境で適切な認証方式を自動選択するシステムです。

## 対応環境

### 🖥️ ローカル開発環境
- **認証方式**: AWS Credentials (Access Key/Secret Key) またはAWS Profile
- **判定条件**: `NODE_ENV=development` または `NODE_ENV=dev`
- **特徴**: DynamoDB Local、MinIO等のローカルサービス対応

### ☁️ Lambda本番環境  
- **認証方式**: IAMロール自動認証
- **判定条件**: `AWS_LAMBDA_FUNCTION_NAME` 等の環境変数存在
- **特徴**: 自動的にIAMロールの権限を使用

## 環境変数設定

### 必須設定（全環境共通）
```bash
# AWS Configuration
AWS_REGION=us-east-1

# Cognito Configuration  
NUXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
NUXT_PUBLIC_COGNITO_CLIENT_ID=your_client_id_here

# Project Configuration
NUXT_PUBLIC_PROJECT_NAME=futura
```

### ローカル開発用設定

#### 方法1: AWS Credentials
```bash
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_SESSION_TOKEN=your_session_token_here  # 一時認証情報の場合
```

#### 方法2: AWS Profile
```bash
AWS_PROFILE=your_profile_name
```

#### 方法3: ローカルサービス
```bash
# DynamoDB Local
DYNAMODB_LOCAL_ENDPOINT=http://localhost:8000

# MinIO (S3互換)
S3_LOCAL_ENDPOINT=http://localhost:9000
```

## 使用方法

### 基本的な使用例

```typescript
// DynamoDB クライアント
import { createDynamoDBDocumentClient } from '~/server/utils/client-factory'
const dynamoClient = createDynamoDBDocumentClient()

// Cognito クライアント
import { createCognitoClient } from '~/server/utils/client-factory'
const cognitoClient = createCognitoClient()

// S3 クライアント
import { createS3Client } from '~/server/utils/client-factory'
const s3Client = createS3Client()
```

### 環境診断

```typescript
import { getEnvironmentDiagnostics, testAWSConnections } from '~/server/utils/client-factory'

// 環境情報取得
const diagnostics = getEnvironmentDiagnostics()
console.log(diagnostics)

// AWS接続テスト
const connectionTest = await testAWSConnections()
console.log(connectionTest)
```

### 管理者用診断API

```bash
# 環境情報のみ
GET /api/admin/system/diagnostics

# 接続テスト込み
GET /api/admin/system/diagnostics?test=true
```

## 自動判定ロジック

### 環境判定の優先順位

1. **Lambda環境判定**
   - `AWS_LAMBDA_FUNCTION_NAME` 存在
   - `AWS_EXECUTION_ENV` 存在
   - `LAMBDA_RUNTIME_DIR` 存在

2. **ローカル開発環境判定**
   - `NODE_ENV=development` または `NODE_ENV=dev`

3. **その他環境**
   - 上記以外の環境

### 認証方式の選択

#### Lambda環境
```typescript
// IAMロール自動認証
{
  region: 'us-east-1'
  // credentials は自動設定
}
```

#### ローカル環境
```typescript
// 明示的なクレデンシャル
{
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN
  }
}
```

## 対応サービス

### 実装済み
- ✅ **Amazon Cognito**: ユーザー認証・グループ管理
- ✅ **Amazon DynamoDB**: データベース操作
- ✅ **Amazon S3**: ファイルストレージ

### 拡張可能
- **Amazon SES**: メール送信
- **Amazon SNS**: 通知サービス  
- **AWS Lambda**: 関数呼び出し
- **Amazon CloudWatch**: ログ・メトリクス

## セキュリティ考慮事項

### ローカル開発
- AWS認証情報の適切な管理
- `.env`ファイルの`.gitignore`設定
- 一時認証情報の使用推奨

### Lambda本番環境
- 最小権限の原則
- IAMロールの適切な設定
- リソースベースポリシーの活用

## トラブルシューティング

### 認証エラー
```bash
# 環境診断実行
curl -H "Cookie: session_id=xxx" \
  http://localhost:3000/api/admin/system/diagnostics?test=true
```

### 一般的な問題

1. **Credentials not found**
   - AWS認証情報が設定されていない
   - AWS_PROFILE または AWS_ACCESS_KEY_ID を確認

2. **Region not configured**
   - AWS_REGION 環境変数を設定

3. **DynamoDB Local connection failed**
   - DYNAMODB_LOCAL_ENDPOINT の確認
   - DynamoDB Localサービスの起動確認

## ベストプラクティス

### 開発環境
- AWS CLIの設定を活用
- 一時認証情報の定期更新
- ローカルサービスの活用

### 本番環境
- IAMロールベース認証
- 最小権限ポリシー
- CloudTrailによる監査

---

このシステムにより、環境を意識することなく一貫したAWSサービス利用が可能になります。