/**
 * 数値をフォーマットします。
 * 小数点以下を四捨五入し、カンマ区切りの文字列を返します。
 * 
 * @param value フォーマットする数値
 * @returns フォーマットされた文字列
 */
export const formatNumber = (value: number): string => {
  return Math.round(value).toLocaleString('ja-JP')
}

/**
 * BTCの数量をフォーマットします。
 * 小数点以下8桁まで表示し、取引種別が入金の場合は先頭に '+' を付与します。
 * 
 * @param amount BTCの数量
 * @param transactionType 取引種別 (deposit, withdrawal, etc...)
 * @returns フォーマットされたBTC文字列
 */
export const formatBTC = (amount: number, transactionType?: string): string => {
  const formattedAmount = amount.toFixed(8)
  if (transactionType === 'deposit') {
    return `+${formattedAmount}`
  }
  return formattedAmount
}
