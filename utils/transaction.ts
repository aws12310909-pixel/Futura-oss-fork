import type { Transaction } from '~/types'

/**
 * トランザクションタイプに応じたラベルを返す
 */
export function getTransactionTypeLabel(transactionType: Transaction['transaction_type']): string {
  switch (transactionType) {
    case 'deposit':
      return '入金'
    case 'withdrawal':
      return '出金'
    case 'asset_management':
      return '資産運用'
    default:
      return transactionType
  }
}

/**
 * トランザクションタイプに応じた色を返す
 */
export function getTransactionTypeColor(transactionType: Transaction['transaction_type']): string {
  switch (transactionType) {
    case 'deposit':
      return 'success'
    case 'withdrawal':
      return 'error'
    case 'asset_management':
      return 'info'
    default:
      return 'grey'
  }
}

/**
 * トランザクションタイプに応じたアイコン名を返す
 */
export function getTransactionTypeIcon(transactionType: Transaction['transaction_type']): string {
  switch (transactionType) {
    case 'deposit':
      return 'mdi:plus'
    case 'withdrawal':
      return 'mdi:minus'
    case 'asset_management':
      return 'mdi:chart-line'
    default:
      return 'mdi:help-circle'
  }
}

/**
 * トランザクションタイプに応じたCSS色クラスを返す
 */
export function getTransactionTypeTextColor(transactionType: Transaction['transaction_type']): string {
  switch (transactionType) {
    case 'deposit':
      return 'text-green-600'
    case 'withdrawal':
      return 'text-red-600'
    case 'asset_management':
      return 'text-blue-600'
    default:
      return 'text-gray-600'
  }
}

/**
 * トランザクションタイプに応じた符号を返す
 */
export function getTransactionTypeSign(transactionType: Transaction['transaction_type'], amount?: number): string {
  switch (transactionType) {
    case 'deposit':
      return '+'
    case 'withdrawal':
      return '-'
    case 'asset_management':
      return amount && amount >= 0 ? '+' : '-'
    default:
      return amount && amount >= 0 ? '+' : '-'
  }
}

/**
 * トランザクションタイプに応じたVuetify色名を返す（テーブル用）
 */
export function getTransactionTypeVuetifyColor(transactionType: Transaction['transaction_type']): string {
  switch (transactionType) {
    case 'deposit':
      return 'orange'
    case 'withdrawal':
      return 'deep-orange'
    case 'asset_management':
      return 'blue-grey'
    default:
      return 'grey'
  }
}
