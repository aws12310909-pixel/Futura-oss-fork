# 入金リクエスト機能 拡張計画書

## 概要

現在の管理者専用の入出金機能を拡張し、一般ユーザーが入金リクエストを送信できる機能を追加する。管理者が承認/拒否を行うワークフローを導入し、適切な権限管理とデータ整合性を確保する。

## 現状分析

### 既存のTransactionテーブル構造
```typescript
interface Transaction {
  transaction_id: string        // パーティションキー
  user_id: string              // ソートキー
  amount: number
  transaction_type: 'deposit' | 'withdrawal'
  timestamp: string
  created_by: string           // 管理者のuser_id
  memo: string
  reason: string
}
```

### 既存の権限構造
- **Administrator権限**: `transaction:create`, `transaction:read`
- **User権限**: `transaction:read`（自分の履歴のみ）

### 既存のGSI
- `UserTimestampIndex` (user_id, timestamp) - ユーザー別の取引履歴取得用

## 拡張設計

### 1. Transactionテーブル拡張

```typescript
interface EnhancedTransaction {
  // 既存フィールド
  transaction_id: string
  user_id: string
  amount: number
  transaction_type: 'deposit' | 'withdrawal'
  timestamp: string
  created_by: string
  memo: string
  reason: string
  
  // 新規追加フィールド
  status: 'pending' | 'approved' | 'rejected'  // 取引状態
  requested_at?: string     // リクエスト作成日時（ISO 8601）
  processed_at?: string     // 承認/拒否処理日時（ISO 8601）
  processed_by?: string     // 処理者のuser_id
  rejection_reason?: string // 拒否理由（status='rejected'の場合）
}
```

### 2. 新規GSI追加

#### StatusIndex
- **パーティションキー**: `status`
- **ソートキー**: `requested_at` または `timestamp`
- **用途**: 承認待ち取引の効率的な取得
- **クエリ例**: `status = 'pending'` で全ての承認待ちリクエストを取得

#### TransactionUserStatusIndex  
- **パーティションキー**: `user_id`
- **ソートキー**: `status`
- **用途**: ユーザー別の状態別取引取得
- **クエリ例**: 特定ユーザーの承認待ちリクエスト取得

### 3. 権限システム拡張

```typescript
// ユーザー権限に追加
const userPermissions = [
  'profile:read', 'profile:update',
  'transaction:read', 'transaction:request',  // 新規追加
  'market_rate:read', 'dashboard:access'
]

// 管理者権限に追加
const adminPermissions = [
  'user:create', 'user:read', 'user:update', 'user:delete',
  'admin:access', 'group:create', 'group:read', 'group:update', 'group:delete',
  'transaction:create', 'transaction:read', 'transaction:approve',  // 新規追加
  'market_rate:create', 'market_rate:read',
  'profile:read', 'profile:update', 'dashboard:access'
]
```

### 4. APIエンドポイント設計

#### ユーザー向けAPI
```
POST /api/transactions/request
- 権限: transaction:request
- 機能: 入金リクエストの作成
- Body: { amount: number, memo?: string, reason: string }
```

#### 管理者向けAPI
```
GET /api/admin/transaction-requests
- 権限: transaction:approve
- 機能: 承認待ちリクエスト一覧取得
- Query: ?status=pending&page=1&limit=20

PATCH /api/admin/transactions/[id]/status
- 権限: transaction:approve
- 機能: リクエストの状態変更（承認/拒否）
- Body: 
  - 承認時: { status: 'approved' }
  - 拒否時: { status: 'rejected', rejection_reason: string }
```

## 実装詳細

### 1. データベース更新

#### マイグレーション戦略
1. 既存レコードに`status: 'approved'`を追加（下位互換性確保）
2. 新しいフィールドをオプショナルとして追加
3. 新規GSIの作成

#### DynamoDB GSI作成
```typescript
// Terraformでの定義例
resource "aws_dynamodb_table" "transactions" {
  # 既存設定...

  global_secondary_index {
    name     = "StatusIndex"
    hash_key = "status"
    range_key = "requested_at"
    projection_type = "ALL"
  }

  global_secondary_index {
    name     = "TransactionUserStatusIndex"
    hash_key = "user_id"
    range_key = "status"
    projection_type = "ALL"
  }
}
```

### 2. 残高計算ロジック更新

```typescript
async function calculateUserBalance(userId: string): Promise<number> {
  const result = await dynamodb.query(
    transactionsTableName,
    'user_id = :user_id AND #status = :status',
    { 
      ':user_id': userId,
      ':status': 'approved'  // 承認済みのみ計算対象
    },
    {
      indexName: 'TransactionUserStatusIndex',
      expressionAttributeNames: { '#status': 'status' }
    }
  )

  const transactions = result.items as EnhancedTransaction[]
  
  return transactions.reduce((balance, transaction) => {
    return transaction.transaction_type === 'deposit' 
      ? balance + transaction.amount 
      : balance - transaction.amount
  }, 0)
}
```

### 3. ワークフロー実装

#### リクエスト作成フロー
1. ユーザーが入金リクエストフォーム送信
2. `status: 'pending'`, `requested_at: now()` で取引レコード作成
3. 管理者に通知（将来的にはメール/プッシュ通知）

#### 承認処理フロー
1. 管理者が承認待ちリスト確認
2. 承認時: `status: 'approved'`, `processed_at: now()`, `processed_by: admin_id`
3. 拒否時: `status: 'rejected'`, `rejection_reason` 設定
4. ユーザーに処理結果通知

## セキュリティ考慮事項

### 1. 権限検証の強化
- リクエスト作成時に既存の承認待ちリクエストの重複チェック
- 金額の上限設定（例：1回のリクエストは最大10 BTC）
- レート制限（例：1日あたりのリクエスト回数制限）

### 2. データ整合性確保
- 承認処理時の二重処理防止（楽観的ロック）
- 状態遷移の制御（pending → approved/rejected のみ許可）
- 承認済み取引の変更防止

## UI/UX設計

### 1. ユーザー画面
- ダッシュボードに「入金リクエスト」ボタン追加
- リクエスト履歴表示（状態別フィルター）
- リクエスト詳細モーダル（状態、処理日時等表示）

### 2. 管理者画面
- 承認待ちリクエスト一覧ページ
- ワンクリック承認/拒否機能
- 一括処理機能（将来拡張）

## 実装フェーズ

### Phase 1: データベース拡張
- [ ] Transactionテーブルスキーマ更新
- [ ] 新規GSI作成
- [ ] 既存データのマイグレーション

### Phase 2: API実装
- [ ] ユーザー向けリクエストAPI
- [ ] 管理者向け承認/拒否API
- [ ] 残高計算ロジック更新

### Phase 3: フロントエンド実装
- [ ] ユーザー向けリクエストフォーム
- [ ] 管理者向け承認画面
- [ ] リクエスト状態表示UI

### Phase 4: 通知機能（将来拡張）
- [ ] メール通知システム
- [ ] プッシュ通知
- [ ] 管理者ダッシュボード統合

## リスク評価

### 技術的リスク
- **中**: GSI作成時のダウンタイム → 段階的デプロイで対応
- **低**: 既存機能への影響 → 下位互換性確保済み

### 運用リスク
- **中**: 管理者の承認業務負荷増 → UI最適化とバッチ処理で軽減
- **低**: 不正リクエストの増加 → レート制限と監視で対応

## 成功指標

- リクエスト→承認までの平均処理時間: 24時間以内
- ユーザー満足度: リクエスト機能の使いやすさ評価
- システム安定性: 既存機能のパフォーマンス維持
- セキュリティ: 不正リクエストの検知・防止率

---

**作成日**: 2025年8月2日  
**最終更新**: 2025年8月2日  
**バージョン**: 1.0  
**作成者**: システム開発チーム

**承認者**: [承認待ち]