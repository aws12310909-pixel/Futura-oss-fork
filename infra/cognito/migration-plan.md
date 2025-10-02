# Cognito認証コードベース検証 移行計画

## 現状分析

### 現在の設定
- **ユーザー名**: メールアドレス（`admin@example.com`, `user@example.com`）
- **メール検証**: 開発用のため無効化（`message_action = "SUPPRESS"`）
- **検証状態**: 手動で `email_verified = "true"` 設定
- **セキュリティレベル**: 低（`advanced_security_mode = "OFF"`）

## 移行戦略

### Phase 1: 環境変数ベース設定の導入

```hcl
# variables.tf に追加
variable "enable_email_verification" {
  description = "Enable email verification for new users"
  type        = bool
  default     = false
}

variable "email_verification_mode" {
  description = "Email verification mode (dev/staging/prod)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.email_verification_mode)
    error_message = "Mode must be dev, staging, or prod."
  }
}
```

### Phase 2: 設定の条件分岐

```hcl
# cognito/main.tf の修正
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-${var.environment}-user-pool"

  # 環境に応じたメール検証設定
  auto_verified_attributes = ["email"]
  
  dynamic "verification_message_template" {
    for_each = var.enable_email_verification ? [1] : []
    content {
      default_email_option = "CONFIRM_WITH_CODE"
      email_message        = "M・S CFD App の認証コードは {####} です。5分以内に入力してください。"
      email_subject        = "【M・S CFD App】メールアドレス認証"
    }
  }

  # メール設定
  email_configuration {
    email_sending_account = var.email_verification_mode == "prod" ? "DEVELOPER" : "COGNITO_DEFAULT"
    # 本番環境では SES を使用することを推奨
  }

  # ユーザー名属性（メールアドレスでログイン）
  username_attributes = ["email"]
  alias_attributes    = ["email"]
}

# 初期ユーザーの作成方法を環境別に分岐
resource "aws_cognito_user" "admin" {
  user_pool_id = aws_cognito_user_pool.main.id
  username     = "admin@example.com"

  attributes = {
    email          = "admin@example.com"
    name           = "System Administrator"
    # 本番環境では email_verified を設定しない
    email_verified = var.email_verification_mode == "dev" ? "true" : null
  }

  temporary_password = "TempAdmin123!"
  # 本番環境ではメール送信を有効化
  message_action = var.email_verification_mode == "dev" ? "SUPPRESS" : "RESEND"
}
```

### Phase 3: フロントエンド対応

```typescript
// composables/useAuth.ts の拡張
export const useAuth = () => {
  const confirmSignUp = async (email: string, code: string) => {
    try {
      await $fetch('/api/auth/confirm-signup', {
        method: 'POST',
        body: { email, code }
      })
      return { success: true }
    } catch (error) {
      return { success: false, error }
    }
  }

  const resendConfirmationCode = async (email: string) => {
    try {
      await $fetch('/api/auth/resend-code', {
        method: 'POST',
        body: { email }
      })
      return { success: true }
    } catch (error) {
      return { success: false, error }
    }
  }

  return {
    // 既存のメソッド...
    confirmSignUp,
    resendConfirmationCode
  }
}
```

## 移行タイムライン

### 即座に実施可能
1. **設定の条件分岐化**: 環境変数での制御導入
2. **ステージング環境**: メール検証有効化テスト
3. **フロントエンド準備**: 認証画面の実装

### 本格運用前に実施
1. **SES設定**: 本番環境でのメール送信設定
2. **本番環境切り替え**: `enable_email_verification = true`
3. **既存ユーザー対応**: 必要に応じて再認証プロセス

### 段階的移行のメリット
- **既存ユーザーへの影響なし**
- **開発効率の維持**
- **段階的なセキュリティ強化**
- **ロールバック可能**

## 実装時の考慮事項

### セキュリティ
- メール検証コードの有効期限（デフォルト24時間）
- 再送信回数の制限
- ブルートフォース攻撃対策

### UX
- わかりやすい認証フロー
- エラーメッセージの多言語対応
- モバイル対応

### 運用
- メール送信エラーの監視
- 認証完了率の追跡
- サポート対応フロー