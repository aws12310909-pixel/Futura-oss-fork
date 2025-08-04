# BTC口座管理システム 仕様書

## 概要
BTC残高を管理するモックアプリケーション。管理者がユーザーアカウントを管理し、BTC相場価格の設定によって各ユーザーの資産価値を計算・表示するシステム。

## システム構成

### インフラ構成
- **認証認可**: AWS Cognito
- **データベース**: Amazon DynamoDB (Pay-Per-Request)
- **ファイルストレージ**: Amazon S3 (プライベートバケット)
- **アプリケーション**: Nuxt3 (SSR/SPA)
- **デプロイ**: AWS Lambda + AWS Amplify
- **環境**: 開発環境・ステージング環境・本番環境
- **IaC**: Terraform

## 機能仕様

### ユーザー画面
1. **ログイン画面**
   - Cognito認証
   - セッション管理（24時間）
   - 同時ログイン許可

2. **パスワード変更画面**
   - パスワードポリシー: 8文字以上、小文字・数字必須
   - 変更頻度制限なし

3. **ダッシュボード画面**
   - 現在のBTC残高表示
   - 資産価値表示（日本円）
   - 残高推移グラフ（過去30日）

4. **入出金記録画面**
   - 入出金履歴一覧
   - 日付・金額・種別表示
   - ページング機能

5. **プロフィール画面**
   - 基本情報: 氏名、住所、電話番号、メールアドレス
   - 免許証画像アップロード
   - 承認ステータス表示

### 管理画面
1. **ユーザー管理画面**
   - ユーザー一覧表示
   - ユーザー新規作成
   - ユーザー停止/復帰
   - ユーザー削除（論理削除、管理画面では引き続き表示）
   - 仮パスワード発行

2. **BTC相場価格入力画面**
   - 相場時刻・価格設定（過去日付設定可能）
   - 全ユーザー資産価値即座更新

3. **入出金管理画面**
   - ユーザー別入出金操作（理由・メモ入力必須）
   - 履歴確認
   - 残高チェック（出金時）

4. **プロフィール承認画面**
   - 免許証画像確認
   - 承認ステータス変更（管理者のみ）
   - 承認状況による機能制限なし

5. **Cognitoグループ管理画面**
   - グループ一覧・作成・更新・削除
   - ユーザーのグループ割り当て管理
   - グループ権限設定

6. **セッション管理画面**
   - 全ユーザーのセッション一覧
   - アクティブセッション監視
   - セッション強制終了機能

7. **システム診断画面**
   - AWS接続状況確認
   - 環境情報表示
   - ヘルスチェック機能

## データ設計

### DynamoDBテーブル設計

#### 1. ユーザーテーブル (Users)
```
PK: user_id (String)
Attributes:
- email (String)
- name (String)
- address (String)
- phone_number (String)
- status (String): active/suspended/deleted
- profile_image_url (String)
- profile_approved (Boolean)
- btc_address (String) // ダミーアドレス
- created_at (String)
- updated_at (String)
- deleted_at (String) // 論理削除用
```

#### 2. 入出金履歴テーブル (Transactions)
```
PK: transaction_id (String)
SK: user_id (String)
GSI: user_id + timestamp
Attributes:
- user_id (String)
- amount (Number) // BTCの増減量
- transaction_type (String): deposit/withdrawal
- timestamp (String)
- created_by (String) // 管理者ID
- memo (String) // 理由・メモ（必須）
- reason (String) // 操作理由（必須）
```

#### 3. 相場マスターテーブル (MarketRates)
```
PK: rate_id (String)
SK: timestamp (String)
Attributes:
- timestamp (String)
- btc_jpy_rate (Number)
- created_by (String) // 管理者ID
- created_at (String)
```

#### 4. セッション管理テーブル (Sessions)
```
PK: session_id (String)
GSI: user_id
Attributes:
- user_id (String)
- cognito_access_token (String)
- cognito_id_token (String)
- cognito_refresh_token (String)
- login_time (String)
- last_access_time (String)
- ip_address (String)
- user_agent (String)
- status (String): active/expired/revoked
- expires_at (Number) // TTL
```

#### 5. 権限管理テーブル (Permissions)
```
PK: group_name (String)
Attributes:
- permissions (List<String>)
- description (String)
- created_at (String)
- updated_at (String)
```

## 技術仕様

### フロントエンド
- **フレームワーク**: Nuxt3
- **言語**: TypeScript
- **状態管理**: Pinia
- **UIフレームワーク**: Vuetify 3
- **テスト**: Vitest
- **リント**: ESLint + Prettier

### バックエンド
- **ランタイム**: Node.js (AWS Lambda)
- **言語**: TypeScript
- **フレームワーク**: Nuxt3 Server API
- **ORM**: AWS SDK for JavaScript v3
- **認証**: AWS Cognito + JWT

### デプロイメント
- **CI/CD**: AWS Amplify
- **設定ファイル**: amplify.yml
- **環境管理**: dev/staging/prod

## セキュリティ仕様

### 認証・認可
- **認証方式**: AWS Cognito User Pools
- **トークン**: JWT (24時間有効)
- **権限管理**: Cognitoグループ + 権限テーブル
- **初期管理者**: `administrator` (Terraform自動作成)

### セッション管理
- **セッション識別**: HTTPオンリーCookie
- **トークン保存**: DynamoDBセッションテーブル
- **自動期限切れ**: TTL機能
- **セッション監視**: 管理者による全セッション確認可能

### ファイルアップロード
- **方式**: Lambda経由アップロード
- **保存先**: S3プライベートバケット
- **アクセス制御**: 署名付きURL（一時的）

### データ保護
- **バックアップ**: DynamoDB自動バックアップ
- **暗号化**: AWS KMS (保存時・転送時)
- **ログ**: CloudWatch Logs (無期限保持)

## 運用仕様

### 監視・ログ
- **アプリケーションログ**: CloudWatch Logs
- **メトリクス**: CloudWatch Metrics
- **セッション監視**: アクティブセッション数追跡
- **アラート**: 設定なし（モックのため）

### バックアップ
- **DynamoDB**: Point-in-time recovery有効
- **S3**: バージョニング有効
- **頻度**: AWS標準機能に準拠

### システム診断
- **ヘルスチェック**: AWS接続状況確認
- **環境情報**: Node.js バージョン、AWS リージョン等
- **診断レポート**: 管理者画面で確認可能

## 開発・テスト方針

### テスト戦略
- **リントチェック**: ESLint
- **型チェック**: TypeScript
- **単体テスト**: Vitest
- **統合テスト**: 未実装
- **E2Eテスト**: 未実装

### 開発フロー
1. ローカル開発環境構築
2. 機能実装・テスト
3. 開発環境デプロイ・確認
4. ステージング環境デプロイ・確認
5. 本番環境デプロイ

## 制約事項・前提条件

### 制約事項
- ユーザー数: 30名程度を想定
- 実際のブロックチェーン接続なし
- 実際の入出金処理なし
- 外部API連携なし
- 削除ユーザーの資産・履歴は保持（物理削除は認証のみ）

### 前提条件
- AWS環境への適切なアクセス権限
- Terraform実行環境
- Node.js開発環境

## API設計原則

### REST API設計
- 管理者機能は `/api/admin/` 配下に配置
- 認証が必要なエンドポイントは権限チェック実装
- エラーハンドリングの統一化

### 権限システム
- Cognitoグループとカスタム権限の組み合わせ
- 最小権限の原則
- 権限チェックのミドルウェア化

## 今後の拡張予定

### 短期的な改善
- レート制限機能の実装
- ログ監視・アラート機能
- バッチ処理による資産価値計算最適化

### 長期的な拡張
- 複数仮想通貨対応
- 取引履歴の詳細分析機能
- ユーザー向けAPI提供

---

**作成者**: システム開発チーム  
**作成日**: 2025-07-28  
**バージョン**: 2.0

## 更新履歴
- v2.0 (2025-01-29): セッション管理・システム診断・Cognitoグループ管理機能追加
- v1.1 (2025-07-28): 追加質問回答反映
  - 相場価格設定：過去日付設定可能、即座再計算
  - 入出金管理：理由・メモ入力必須、deposit/withdrawal のみ
  - プロフィール承認：管理者のみ変更可能、機能制限なし
  - セッション管理：ログアウト時レコード削除
  - ユーザー削除：関連データ保持、管理画面では表示継続
- v1.0 (2025-07-28): 初版作成