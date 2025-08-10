import crypto from 'node:crypto'

/**
 * UUID生成ユーティリティ
 * Node.js環境専用のUUID生成機能を提供
 */

/**
 * ランダムなUUIDv4を生成
 * @returns {string} UUID文字列 (例: "550e8400-e29b-41d4-a716-446655440000")
 */
export function generateUUID(): string {
  return crypto.randomUUID()
}

/**
 * セッションID用のUUID生成
 * セッション管理で使用するためのエイリアス
 * @returns {string} UUID文字列
 */
export function generateSessionId(): string {
  return generateUUID()
}

/**
 * 取引ID用のUUID生成  
 * トランザクション管理で使用するためのエイリアス
 * @returns {string} UUID文字列
 */
export function generateTransactionId(): string {
  return generateUUID()
}

/**
 * 汎用ID生成
 * リクエストID、ジョブIDなど汎用的な用途向け
 * @returns {string} UUID文字列
 */
export function generateId(): string {
  return generateUUID()
}