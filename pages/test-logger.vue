<template>
  <div class="pa-4">
    <h1 class="text-h4 mb-4">ログ機能テストページ</h1>
    
    <div class="mb-4">
      <p class="text-body-1 mb-2">ブラウザの開発者ツールのコンソールでログ出力を確認してください。</p>
    </div>

    <v-card class="mb-4">
      <v-card-title>基本ログテスト</v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="auto">
            <v-btn color="primary" @click="testBasicLogs">基本ログテスト</v-btn>
          </v-col>
          <v-col cols="auto">
            <v-btn color="success" @click="testAuthLogs">認証ログテスト</v-btn>
          </v-col>
          <v-col cols="auto">
            <v-btn color="info" @click="testApiLogs">APIログテスト</v-btn>
          </v-col>
          <v-col cols="auto">
            <v-btn color="warning" @click="testDbLogs">DBログテスト</v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-card class="mb-4">
      <v-card-title>特殊ログテスト</v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="auto">
            <v-btn color="secondary" @click="testLifecycleLogs">ライフサイクルログ</v-btn>
          </v-col>
          <v-col cols="auto">
            <v-btn color="accent" @click="testTaggedLogs">タグ付きログ</v-btn>
          </v-col>
          <v-col cols="auto">
            <v-btn color="error" @click="testCriticalLogs">クリティカルログ</v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-card>
      <v-card-title>ログ設定情報</v-card-title>
      <v-card-text>
        <pre>{{ JSON.stringify(loggerConfig, null, 2) }}</pre>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
const logger = useLogger({ prefix: '[TEST-PAGE]' })

// ログ設定情報を取得
const loggerConfig = logger.getConfig()

// 基本ログテスト
const testBasicLogs = () => {
  logger.debug('これはデバッグログです')
  logger.info('これは情報ログです')
  logger.log('これは一般ログです')
  logger.warn('これは警告ログです')
  logger.error('これはエラーログです')
  logger.success('これは成功ログです')
  logger.trace('これはトレースログです')
}

// 認証ログテスト
const testAuthLogs = () => {
  logger.auth.login('test@example.com')
  logger.auth.logout('test@example.com')
  logger.auth.sessionValidation(true, 'session123456')
  logger.auth.sessionValidation(false, 'session789012')
  logger.auth.tokenVerification(true)
  logger.auth.tokenVerification(false)
}

// APIログテスト
const testApiLogs = () => {
  logger.api.request('GET', '/api/users')
  logger.api.response('GET', '/api/users', 200)
  logger.api.request('POST', '/api/transactions')
  logger.api.response('POST', '/api/transactions', 201)
  logger.api.error('DELETE', '/api/users/123', new Error('テストエラー'))
}

// DBログテスト
const testDbLogs = () => {
  logger.db.query('users', 'SCAN')
  logger.db.query('transactions', 'GET')
  logger.db.query('market_rates', 'PUT')
  logger.db.error('sessions', 'DELETE', new Error('DBテストエラー'))
}

// ライフサイクルログテスト
const testLifecycleLogs = () => {
  logger.start('プロセス開始')
  setTimeout(() => {
    logger.ready('プロセス準備完了')
  }, 1000)
  setTimeout(() => {
    logger.fail('プロセス失敗（テスト用）')
  }, 2000)
}

// タグ付きログテスト
const testTaggedLogs = () => {
  const userLogger = logger.withTag('UserManagement')
  userLogger.info('ユーザー管理処理開始')
  userLogger.success('ユーザー管理処理完了')
  
  const transactionLogger = logger.withTag('TransactionProcessor')
  transactionLogger.warn('トランザクション処理警告')
  transactionLogger.error('トランザクション処理エラー')
}

// クリティカルログテスト
const testCriticalLogs = () => {
  logger.critical('重大なシステムエラー（テスト用）')
  logger.fatal('致命的エラー（テスト用）')
}

// ページ初期化時のログ
onMounted(() => {
  logger.start('ログテストページが初期化されました')
  logger.info('現在のログ設定:', loggerConfig)
})
</script>