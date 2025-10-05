# BTC一括取引処理システム 実装計画

## 概要

管理者がBTC資産運用結果を全ユーザーに一括反映するシステムを実装する。運用結果（利益・損失）を全ユーザーの現在残高に対して一定比率で増減させ、取引履歴として記録する。

## システム要件

### 機能要件

1. **一括処理実行機能**
   - 全ユーザーのBTC残高を取得
   - 指定された増減率（%）に基づき各ユーザーの取引額を計算
   - 全ユーザーに対してトランザクションを一括作成
   - 処理の中断・再開をサポート

2. **履歴管理機能**
   - 一括処理の実行履歴を保存
   - 処理ステータス（実行中、完了、失敗、中断）の管理
   - 処理詳細（対象ユーザー数、成功・失敗件数、増減率など）の記録

3. **管理画面**
   - 一括処理実行コントローラー
   - 過去の一括処理履歴表示
   - 処理詳細の確認

### 非機能要件

- **冪等性**: 同じbatch_idでの再実行時は既存トランザクションをスキップ
- **耐障害性**: 処理中断時に途中から再開可能
- **監査性**: 全ての一括処理を履歴として保存
- **パフォーマンス**: DynamoDB BatchWriteItemを使用した効率的な書き込み

## データベース設計

### 新規テーブル: batch_operations

一括処理の管理テーブル

**テーブル定義:**
```
PK: batch_id (String, UUID)
SK: なし（単一キー）

属性:
- batch_id: string (一括処理の一意識別子、UUIDv7)
- operation_type: string (固定値: "btc_adjustment")
- adjustment_rate: number (増減率 例: 5.0 = +5%, -3.0 = -3%)
- target_user_count: number (対象ユーザー数)
- processed_user_count: number (処理完了ユーザー数)
- failed_user_count: number (処理失敗ユーザー数)
- status: string (pending | processing | completed | failed | cancelled)
- created_by: string (実行者のuser_id)
- created_at: string (ISO 8601)
- started_at: string | undefined (処理開始時刻)
- completed_at: string | undefined (処理完了時刻)
- error_message: string | undefined (エラー詳細)
- memo: string | undefined (管理者メモ)

GSI:
- StatusTimestampIndex: status (PK) + created_at (SK)
  - ステータス別に処理履歴を取得するため
```

**Terraform定義追加:**
```hcl
# infra/dynamodb/main.tf に追加

resource "aws_dynamodb_table" "batch_operations" {
  name           = "${var.project_name}-${var.environment}-batch-operations"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "batch_id"

  attribute {
    name = "batch_id"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "S"
  }

  global_secondary_index {
    name            = "StatusTimestampIndex"
    hash_key        = "status"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-batch-operations"
  }
}
```

### 既存テーブル: transactions

**変更なし**。既存スキーマをそのまま利用:
- PK: transaction_id (一括処理の場合はbatch_id)
- SK: user_id

一括処理で作成されるトランザクションは、全て同じ`transaction_id`（= `batch_id`）を持つ。これにより:
- 同じbatch_idで既存トランザクションを検索可能
- 処理中断時、未処理ユーザーのみ処理を続行可能

## 型定義

### types/index.ts に追加

```typescript
// Batch operation types
export const BATCH_OPERATION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const

export type BatchOperationStatus = typeof BATCH_OPERATION_STATUS[keyof typeof BATCH_OPERATION_STATUS]

export interface BatchOperation {
  batch_id: string
  operation_type: 'btc_adjustment'
  adjustment_rate: number  // 増減率（%） 例: 5.0 = +5%, -3.0 = -3%
  target_user_count: number
  processed_user_count: number
  failed_user_count: number
  status: BatchOperationStatus
  created_by: string
  created_at: string
  started_at?: string
  completed_at?: string
  error_message?: string
  memo?: string
}

export interface BatchOperationCreateForm {
  adjustment_rate: number
  memo?: string
}

export interface BatchOperationResult {
  batch_id: string
  status: BatchOperationStatus
  target_user_count: number
  processed_user_count: number
  failed_user_count: number
  errors?: Array<{
    user_id: string
    error: string
  }>
}
```

## API設計

### 1. POST /api/admin/batch-operations

**概要**: 一括処理を作成・実行

**権限**: `batch:execute` (administrator)

**リクエスト:**
```typescript
{
  adjustment_rate: number,  // 例: 5.0 = +5%, -3.0 = -3%
  memo?: string
}
```

**レスポンス:**
```typescript
{
  success: boolean,
  data: {
    batch_id: string,
    status: 'processing',
    target_user_count: number
  },
  message: string
}
```

**処理フロー:**
1. バリデーション（adjustment_rate範囲チェック: -100 < rate）
2. batch_operationsテーブルに新規レコード作成（status: pending）
3. 全アクティブユーザーを取得
4. 各ユーザーの現在残高を計算
5. 増減額を計算（balance * adjustment_rate / 100）
6. トランザクションをBatchWriteItemで一括作成
   - transaction_id = batch_id（全ユーザー共通）
   - 25件ずつバッチ処理
   - 既存トランザクション（同batch_id + user_id）は冪等性のためスキップ
7. batch_operationsのステータス更新（completed/failed）

**実装ファイル:**
- `server/api/admin/batch-operations/index.post.ts`

### 2. GET /api/admin/batch-operations

**概要**: 一括処理履歴一覧取得

**権限**: `batch:read` (administrator)

**クエリパラメータ:**
```typescript
{
  status?: BatchOperationStatus,
  limit?: number,  // デフォルト: 20
  offset?: number  // デフォルト: 0
}
```

**レスポンス:**
```typescript
{
  success: boolean,
  data: {
    items: BatchOperation[],
    total: number
  }
}
```

**実装ファイル:**
- `server/api/admin/batch-operations/index.get.ts`

### 3. GET /api/admin/batch-operations/[batchId]

**概要**: 一括処理詳細取得

**権限**: `batch:read` (administrator)

**レスポンス:**
```typescript
{
  success: boolean,
  data: {
    operation: BatchOperation,
    transactions: Transaction[]  // この一括処理で作成されたトランザクション
  }
}
```

**実装ファイル:**
- `server/api/admin/batch-operations/[batchId]/index.get.ts`

## フロントエンド設計

### ページ: /pages/admin/batch-operations.vue

**URL**: `/admin/batch-operations`

**レイアウト:**
```
┌─────────────────────────────────────────┐
│ BTC一括調整                              │
├─────────────────────────────────────────┤
│ [実行コントローラー]                      │
│  ┌───────────────────────────────────┐  │
│  │ 増減率: [____]%                    │  │
│  │ メモ: [________________]           │  │
│  │ [実行]ボタン                       │  │
│  └───────────────────────────────────┘  │
│                                         │
│ [実行履歴]                              │
│  ┌───────────────────────────────────┐  │
│  │ ID | 実行日時 | 増減率 | ステータス │  │
│  │ --------------------------------- │  │
│  │ xxx | 2025-10-05 | +5% | 完了    │  │
│  │ yyy | 2025-10-04 | -2% | 完了    │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**コンポーネント:**

1. **AdminBatchOperationController** (`components/admin/BatchOperationController.vue`)
   - 増減率入力フィールド（-100 < rate）
   - メモ入力フィールド
   - 実行ボタン
   - 確認ダイアログ（対象ユーザー数、影響を表示）

2. **AdminBatchOperationHistory** (`components/admin/BatchOperationHistory.vue`)
   - 履歴テーブル表示
   - ページネーション
   - ステータスフィルター
   - 詳細ダイアログ（クリックで詳細表示）

**状態管理:**
```typescript
// Composition API
const adjustmentRate = ref<number>(0)
const memo = ref<string>('')
const loading = ref(false)
const history = ref<BatchOperation[]>([])

// 実行
async function executeBatchOperation() {
  // 確認ダイアログ
  // API呼び出し
  // 履歴リロード
}

// 履歴取得
async function fetchHistory() {
  // API呼び出し
}
```

## 実装順序

### Phase 1: データベース・型定義
1. ✅ Terraform: batch_operationsテーブル定義追加
2. ✅ types/index.ts: 型定義追加
3. ✅ permissions: `batch:execute`, `batch:read`権限追加

### Phase 2: バックエンドAPI
4. ✅ `server/utils/batch-helpers.ts`: 一括処理ヘルパー関数
5. ✅ `POST /api/admin/batch-operations`: 一括処理実行API
6. ✅ `GET /api/admin/batch-operations`: 履歴一覧API
7. ✅ `GET /api/admin/batch-operations/[batchId]`: 詳細API

### Phase 3: フロントエンド
8. ✅ `components/admin/BatchOperationController.vue`: 実行コントローラー
9. ✅ `components/admin/BatchOperationHistory.vue`: 履歴テーブル
10. ✅ `components/admin/BatchOperationDetailDialog.vue`: 詳細ダイアログ
11. ✅ `pages/admin/batch-operations.vue`: メインページ

### Phase 4: テスト・デプロイ
12. ✅ 動作確認（少数ユーザーでテスト）
13. ✅ エラーハンドリング確認
14. ✅ 冪等性確認（同じbatch_idで再実行）
15. ✅ Terraform apply（DynamoDBテーブル作成）

## セキュリティ考慮事項

1. **権限チェック**: administratorグループのみ実行可能
2. **入力検証**: adjustment_rate範囲チェック（-100 < rate）
3. **監査ログ**: 全ての一括処理を履歴として保存
4. **確認ダイアログ**: フロントエンドで実行前に確認
5. **冪等性**: 同じbatch_idでの再実行は安全

## エラーハンドリング

1. **部分的失敗**: 一部ユーザーの処理失敗時も他ユーザーは処理継続
2. **失敗ユーザー記録**: failed_user_count, error_messageに記録
3. **リトライ**: 同じbatch_idで再実行可能（未処理ユーザーのみ）
4. **タイムアウト**: Lambda制限を考慮し、大量ユーザー時は分割処理

## 今後の拡張可能性

1. **非同期処理**: Lambda/SQSを使用した非同期バッチ処理
2. **スケジュール実行**: 定期的な一括処理の自動実行
3. **通知機能**: 処理完了時にメール/SNS通知
4. **ロールバック**: 一括処理の取り消し機能
5. **プレビュー**: 実行前に各ユーザーの変更額を確認

## 参考情報

- DynamoDB BatchWriteItem: 最大25アイテム/リクエスト
- UUIDv7: タイムスタンプベースの一意識別子
- 既存トランザクションスキーマ: PK=transaction_id, SK=user_id
