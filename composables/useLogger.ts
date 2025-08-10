import { consola } from 'consola'
import type { LoggerConfig, Logger } from '~/types'

// ログレベル定数
const LOG_LEVELS = {
  Silent: 0,
  Fatal: 1,
  Error: 2,
  Warn: 3,
  Info: 4,
  Debug: 5
} as const

/**
 * ログ出力を統一管理するコンポーザブル
 * consolaを使用してフロントエンド・サーバーサイド両方で一貫したログ出力を提供
 */
export const useLogger = (config: LoggerConfig = {}) => {
  // 環境に基づくデフォルト設定（process.envを直接使用）
  const isProduction = process.env.NODE_ENV === 'production'
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  // デフォルト設定
  const defaultConfig: LoggerConfig = {
    level: isDevelopment ? LOG_LEVELS.Debug : LOG_LEVELS.Info,
    enableInProduction: false,
    prefix: import.meta.server ? '[SERVER]' : '[CLIENT]'
  }
  
  const finalConfig = { ...defaultConfig, ...config }
  
  // プロダクション環境でのログ制御
  const shouldLog = isDevelopment || finalConfig.enableInProduction
  
  // consolaのインスタンスを作成
  const logger = consola.create({
    level: finalConfig.level,
    defaults: {
      tag: finalConfig.prefix
    }
  })
  
  // ログメソッドのラッパー
  const createLogMethod = (method: keyof typeof logger) => {
    return (...args: any[]) => {
      if (shouldLog) {
        ;(logger[method] as Function)(...args)
      }
    }
  }
  
  return {
    // 基本的なログメソッド
    debug: createLogMethod('debug'),
    info: createLogMethod('info'),
    log: createLogMethod('log'),
    warn: createLogMethod('warn'),
    error: createLogMethod('error'),
    success: createLogMethod('success'),
    
    // 特殊なログメソッド
    trace: createLogMethod('trace'),
    fatal: createLogMethod('fatal'),
    
    // グループ化されたログ
    start: createLogMethod('start'),
    ready: createLogMethod('ready'),
    fail: createLogMethod('fail'),
    
    // ログレベルの動的変更
    setLevel: (level: number) => {
      logger.level = level
    },
    
    // 現在の設定を取得
    getConfig: () => ({
      level: logger.level,
      shouldLog,
      isProduction,
      isDevelopment,
      ...finalConfig
    }),
    
    // 特定の機能用のロガーを作成
    withTag: (tag: string) => {
      return useLogger({
        ...finalConfig,
        prefix: `${finalConfig.prefix} [${tag}]`
      })
    },
    
    // エラーログ専用（常に出力）
    critical: (...args: unknown[]) => {
      logger.error(...(args as Parameters<typeof logger.error>))
    },
    
    // 認証関連のログ（セキュリティ重要）
    auth: {
      login: (email: string) => {
        if (shouldLog) {
          logger.info(`🔑 Login attempt for: ${email}`)
        }
      },
      logout: (email: string) => {
        if (shouldLog) {
          logger.info(`🔐 Logout for: ${email}`)
        }
      },
      sessionValidation: (success: boolean, sessionId?: string) => {
        if (shouldLog) {
          const maskedSessionId = sessionId ? sessionId.substring(0, 8) + '...' : 'unknown'
          logger.info(`🔍 Session validation ${success ? 'successful' : 'failed'} for: ${maskedSessionId}`)
        }
      },
      tokenVerification: (success: boolean) => {
        if (shouldLog) {
          logger.info(`🔐 Token verification ${success ? 'successful' : 'failed'}`)
        }
      }
    },
    
    // API関連のログ
    api: {
      request: (method: string, path: string) => {
        if (shouldLog) {
          logger.info(`📤 ${method} ${path}`)
        }
      },
      response: (method: string, path: string, status: number) => {
        if (shouldLog) {
          const emoji = status >= 400 ? '❌' : status >= 300 ? '🔄' : '✅'
          logger.info(`📥 ${emoji} ${method} ${path} - ${status}`)
        }
      },
      error: (method: string, path: string, error: any) => {
        logger.error(`💥 ${method} ${path} failed:`, error)
      }
    },
    
    // データベース関連のログ
    db: {
      query: (table: string, operation: string) => {
        if (shouldLog) {
          logger.debug(`🗃️ DB ${operation} on ${table}`)
        }
      },
      error: (table: string, operation: string, error: any) => {
        logger.error(`🗃️💥 DB ${operation} on ${table} failed:`, error)
      }
    },
    
    // 直接consolaインスタンスへのアクセス（上級者向け）
    raw: logger
  }
}

// ログ機能を使用する場合は、useLogger()を直接使用してください
// 例: const logger = useLogger({ prefix: '[COMPONENT]' })