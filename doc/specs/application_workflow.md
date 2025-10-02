# M・S CFD App - アプリケーション全体ワークフロー

## 概要

BTC Mock Appは、ビットコインポートフォリオ管理をシミュレーションするWebアプリケーションです。管理者主導のアカウント管理と、段階的な権限制御により、安全で統制の取れた仮想取引環境を提供します。

## システム全体アーキテクチャフロー

```mermaid
graph TB
    subgraph "フロントエンド層"
        UI[Nuxt 3 / Vue.js UI]
        Auth[認証コンポーネント]
        Admin[管理者コンソール]
        User[ユーザーダッシュボード]
    end

    subgraph "バックエンド層"
        API[Nuxt Server API]
        AuthAPI[認証API]
        UserAPI[ユーザー管理API]
        TransAPI[取引API]
        MarketAPI[市場レートAPI]
    end

    subgraph "AWS サービス層"
        Cognito[AWS Cognito<br/>User Pool]
        DDB[DynamoDB<br/>データストア]
        S3[S3<br/>ファイルストレージ]
    end

    subgraph "データテーブル"
        UsersTable[users テーブル]
        TransTable[transactions テーブル]
        RatesTable[market_rates テーブル]
        SessionsTable[sessions テーブル]
        PermTable[permissions テーブル]
    end

    %% フロントエンド層の関係
    UI --> Auth
    UI --> Admin
    UI --> User

    %% API層との通信
    Auth --> AuthAPI
    Admin --> UserAPI
    Admin --> TransAPI
    Admin --> MarketAPI
    User --> TransAPI
    User --> MarketAPI

    %% バックエンドとAWSサービス
    AuthAPI --> Cognito
    UserAPI --> Cognito
    UserAPI --> DDB
    UserAPI --> S3
    TransAPI --> DDB
    MarketAPI --> DDB

    %% DynamoDBテーブル関係
    DDB --> UsersTable
    DDB --> TransTable
    DDB --> RatesTable
    DDB --> SessionsTable
    DDB --> PermTable

    %% スタイリング
    classDef frontend fill:#e1f5fe
    classDef backend fill:#f3e5f5
    classDef aws fill:#fff3e0
    classDef data fill:#e8f5e8

    class UI,Auth,Admin,User frontend
    class API,AuthAPI,UserAPI,TransAPI,MarketAPI backend
    class Cognito,DDB,S3 aws
    class UsersTable,TransTable,RatesTable,SessionsTable,PermTable data
```

## 主要ユーザージャーニー

### 1. 管理者ジャーニー

```mermaid
journey
    title 管理者の日常ワークフロー
    section ログイン
      ログインページアクセス: 3: 管理者
      認証情報入力: 4: 管理者
      管理者コンソール表示: 5: 管理者
    section ユーザー管理
      承認待ちユーザー確認: 4: 管理者
      プロファイル審査: 3: 管理者
      アカウント承認/拒否: 5: 管理者
      新規ユーザー作成: 4: 管理者
    section 取引管理
      ユーザー残高確認: 4: 管理者
      取引履歴レビュー: 3: 管理者
      手動取引追加: 4: 管理者
      残高調整: 3: 管理者
    section 市場管理
      現在レート確認: 4: 管理者
      新レート入力: 5: 管理者
      レート履歴確認: 3: 管理者
    section システム管理
      全体統計確認: 4: 管理者
      ユーザー活動監視: 3: 管理者
      システム設定: 2: 管理者
```

### 2. 一般ユーザージャーニー

```mermaid
journey
    title 一般ユーザーの利用フロー
    section アカウント開始
      管理者からの連絡受信: 2: ユーザー
      初回ログイン: 3: ユーザー
      パスワード変更: 4: ユーザー
      プロファイル確認: 4: ユーザー
    section 承認待ち期間
      承認待ち状態確認: 2: ユーザー
      制限付き機能利用: 3: ユーザー
      管理者承認待ち: 1: ユーザー
    section 通常利用
      ダッシュボード確認: 5: ユーザー
      残高・評価額確認: 5: ユーザー
      取引履歴確認: 4: ユーザー
      プロファイル更新: 3: ユーザー
    section 継続利用
      定期的な残高確認: 4: ユーザー
      市場変動確認: 4: ユーザー
      取引詳細確認: 3: ユーザー
```

## 主要ビジネスプロセスフロー

### 1. アカウントライフサイクル

```mermaid
stateDiagram-v2
    [*] --> 未作成

    未作成 --> 作成済み: 管理者がアカウント作成
    作成済み --> 初回ログイン: ユーザーが仮パスワードでログイン
    初回ログイン --> パスワード変更: 強制パスワード変更
    パスワード変更 --> 承認待ち: プロファイル承認待ち
    
    承認待ち --> 承認済み: 管理者が承認
    承認待ち --> 拒否: 管理者が拒否
    承認済み --> 利用中: 全機能利用可能
    
    利用中 --> 停止: 管理者が停止
    利用中 --> 削除: 管理者が削除
    停止 --> 利用中: 管理者が再開
    拒否 --> 承認待ち: 再審査
    
    削除 --> [*]

    note right of 作成済み
        - Cognito User作成
        - DynamoDB レコード作成
        - status: active
        - profile_approved: false
    end note

    note right of 承認済み
        - profile_approved: true
        - 全機能アクセス可能
    end note
```

### 2. 取引処理フロー

```mermaid
flowchart TD
    Start([取引開始]) --> AuthCheck{管理者権限確認}
    AuthCheck -->|権限あり| UserSelect[対象ユーザー選択]
    AuthCheck -->|権限なし| Error1[エラー: 権限不足]
    
    UserSelect --> BalanceCheck[現在残高取得]
    BalanceCheck --> TypeSelect{取引種別選択}
    
    TypeSelect -->|入金| DepositForm[入金フォーム]
    TypeSelect -->|出金| WithdrawForm[出金フォーム]
    
    DepositForm --> AmountInput1[金額入力]
    WithdrawForm --> AmountInput2[金額入力]
    
    AmountInput2 --> SufficientCheck{残高確認}
    SufficientCheck -->|不足| Error2[エラー: 残高不足]
    SufficientCheck -->|充分| ReasonInput2[理由入力]
    
    AmountInput1 --> ReasonInput1[理由入力]
    ReasonInput1 --> CreateTrans1[取引レコード作成]
    ReasonInput2 --> CreateTrans2[取引レコード作成]
    
    CreateTrans1 --> UpdateBalance1[残高更新<br/>+金額]
    CreateTrans2 --> UpdateBalance2[残高更新<br/>-金額]
    
    UpdateBalance1 --> Success[取引完了]
    UpdateBalance2 --> Success
    Success --> Notify[通知・ログ出力]
    Notify --> End([終了])
    
    Error1 --> End
    Error2 --> End

    style Start fill:#e8f5e8
    style Success fill:#e8f5e8
    style Error1 fill:#ffebee
    style Error2 fill:#ffebee
    style End fill:#f5f5f5
```

### 3. 市場レート更新フロー

```mermaid
sequenceDiagram
    participant Admin as 管理者
    participant UI as 管理画面
    participant API as MarketRate API
    participant DDB as DynamoDB
    participant Cache as キャッシュ
    participant Users as 全ユーザー

    Admin->>UI: 新レート入力画面
    UI->>Admin: レート入力フォーム表示
    
    Admin->>UI: 新レート値入力・送信
    UI->>API: POST /api/market-rates
    
    Note over API: requirePermission("rate:create")
    API->>API: 管理者権限確認
    
    API->>DDB: 新レートレコード作成
    Note over DDB: - timestamp: 現在時刻<br/>- btc_jpy_rate: 新レート<br/>- created_by: 管理者ID
    
    DDB-->>API: 作成完了
    
    API->>Cache: 最新レートキャッシュ更新
    Cache-->>API: 更新完了
    
    API-->>UI: 成功レスポンス
    UI-->>Admin: 更新完了通知
    
    Note over Users: 次回ダッシュボードアクセス時<br/>新レートで評価額計算
    
    loop 各ユーザーのダッシュボードアクセス
        Users->>API: GET /api/dashboard
        API->>Cache: 最新レート取得
        Cache-->>API: 最新レート
        API->>DDB: ユーザー残高取得
        DDB-->>API: 残高データ
        API->>API: 評価額計算<br/>(残高 × 最新レート)
        API-->>Users: 更新済みダッシュボード
    end
```

## データフローアーキテクチャ

### 1. 認証データフロー

```mermaid
graph LR
    subgraph "認証フロー"
        Login[ログイン要求] --> CognitoAuth[Cognito認証]
        CognitoAuth --> TokenGen[トークン生成]
        TokenGen --> CookieSet[Cookie設定]
        CookieSet --> SessionStart[セッション開始]
    end

    subgraph "認可フロー"
        Request[API要求] --> CookieCheck[Cookie確認]
        CookieCheck --> TokenValid[トークン検証]
        TokenValid --> PermCheck[権限確認]
        PermCheck --> APIAccess[API実行]
    end

    subgraph "データストア"
        Cognito[(Cognito<br/>User Pool)]
        DDBSessions[(DynamoDB<br/>sessions)]
        DDBPerms[(DynamoDB<br/>permissions)]
    end

    CognitoAuth --> Cognito
    TokenValid --> Cognito
    PermCheck --> DDBPerms
    SessionStart --> DDBSessions
```

### 2. ユーザーデータフロー

```mermaid
graph TD
    subgraph "作成フロー"
        AdminCreate[管理者作成] --> CognitoUser[Cognito User]
        CognitoUser --> DDBUser[DynamoDB User]
        DDBUser --> BTCAddr[BTC Address生成]
    end

    subgraph "更新フロー"
        ProfileUpdate[プロファイル更新] --> ImageUpload{画像アップロード?}
        ImageUpload -->|Yes| S3Upload[S3アップロード]
        ImageUpload -->|No| DDBUpdate[DynamoDB更新]
        S3Upload --> DDBUpdate
    end

    subgraph "承認フロー"
        AdminApprove[管理者承認] --> StatusUpdate[status更新]
        StatusUpdate --> NotifyUser[ユーザー通知]
    end

    style AdminCreate fill:#e3f2fd
    style AdminApprove fill:#e3f2fd
    style ProfileUpdate fill:#f3e5f5
```

### 3. 取引データフロー

```mermaid
graph TB
    subgraph "取引作成"
        TransCreate[取引作成要求] --> ValidCheck[入力値検証]
        ValidCheck --> BalanceCalc[残高計算]
        BalanceCalc --> TransRecord[取引記録]
        TransRecord --> BalanceUpdate[残高更新]
    end

    subgraph "残高計算"
        GetTrans[取引履歴取得] --> SumCalc[合計計算]
        SumCalc --> CurrentBalance[現在残高]
    end

    subgraph "ダッシュボード表示"
        DashReq[ダッシュボード要求] --> GetBalance[残高取得]
        GetBalance --> GetRate[最新レート取得]
        GetRate --> ValueCalc[評価額計算]
        ValueCalc --> RecentTrans[最近の取引]
        RecentTrans --> DashResponse[ダッシュボード応答]
    end

    TransRecord --> GetTrans
    BalanceUpdate --> GetBalance
```

## エラーハンドリングとリカバリー

### 1. システムエラーフロー

```mermaid
flowchart TD
    Request[API要求] --> Try{処理実行}
    
    Try -->|成功| Success[正常応答]
    Try -->|エラー| ErrorType{エラー種別}
    
    ErrorType -->|認証エラー| AuthError[401: 認証が必要]
    ErrorType -->|権限エラー| PermError[403: 権限不足]
    ErrorType -->|データエラー| DataError[404: データ不存在]
    ErrorType -->|入力エラー| ValidError[400: 入力値エラー]
    ErrorType -->|システムエラー| SysError[500: システムエラー]
    
    AuthError --> LoginRedirect[ログイン画面へ]
    PermError --> ErrorPage[エラーページ]
    DataError --> NotFound[404ページ]
    ValidError --> FormError[フォームエラー表示]
    SysError --> SystemError[システムエラーページ]
    
    SysError --> LogError[エラーログ出力]
    LogError --> AlertAdmin[管理者アラート]
```

### 2. データ整合性チェック

```mermaid
sequenceDiagram
    participant System as システム
    participant Cognito as Cognito
    participant DDB as DynamoDB
    participant Audit as 監査ログ

    Note over System: 定期整合性チェック

    System->>Cognito: 全ユーザー取得
    System->>DDB: 全ユーザーレコード取得
    
    System->>System: データ照合
    
    alt データ不整合発見
        System->>Audit: 不整合ログ記録
        System->>System: 管理者通知
        System->>System: 自動修復試行
    else データ整合性OK
        System->>Audit: 正常ログ記録
    end
```

## パフォーマンス最適化ポイント

### 1. データアクセス最適化

| 操作 | 最適化手法 | 実装 |
|------|-----------|------|
| ユーザー一覧取得 | ページネーション | `LastEvaluatedKey`使用 |
| 取引履歴取得 | インデックス活用 | GSI `user_id-timestamp` |
| 残高計算 | キャッシュ化 | 計算結果の一時保存 |
| 市場レート | キャッシュ化 | 最新値のメモリキャッシュ |

### 2. フロントエンド最適化

```mermaid
graph LR
    subgraph "ページ読み込み最適化"
        LazyLoad[遅延読み込み] --> ComponentAsync[非同期コンポーネント]
        ComponentAsync --> DataPrefetch[データプリフェッチ]
    end

    subgraph "状態管理最適化"
        Pinia[Pinia Store] --> LocalCache[ローカルキャッシュ]
        LocalCache --> StateSync[状態同期]
    end

    subgraph "UI/UX最適化"
        Loading[ローディング状態] --> Skeleton[スケルトンUI]
        Skeleton --> ProgressIndicator[進捗表示]
    end
```

## 監視・メトリクス

### 1. 主要メトリクス

```mermaid
mindmap
  root((M・S CFD App<br/>メトリクス))
    ユーザーメトリクス
      アクティブユーザー数
      新規ユーザー数
      承認待ちユーザー数
      ログイン頻度
    システムメトリクス
      API応答時間
      エラー率
      システム可用性
      リソース使用率
    ビジネスメトリクス
      取引件数
      総残高
      市場レート更新頻度
      管理者活動
    セキュリティメトリクス
      認証失敗回数
      権限違反試行
      異常アクセス
      データ整合性
```

### 2. アラート設定

| メトリクス | 閾値 | アクション |
|-----------|------|-----------|
| API応答時間 | > 5秒 | 管理者通知 |
| エラー率 | > 5% | 緊急アラート |
| ログイン失敗 | > 10回/時間 | セキュリティアラート |
| データ不整合 | > 0件 | 即座に管理者通知 |

---

このワークフローは、BTC Mock Appの全体的な動作を包括的に示しています。各機能の詳細フローは、個別のワークフロー図で補完されます。