/**
 * 期日の強調表示（要件定義 5.6）に関するロジック。
 *
 * ロジック自体は prototype/app.js の getDueStatus をそのまま踏襲する
 * （動くモックとして挙動が確定済みのため、独自解釈で新しい判定を作らない）。
 */

/** 期日の強調区分。'overdue' = 期限切れ（赤） / 'soon' = 期限間近（黄） / null = 強調なし */
export type DueStatus = 'overdue' | 'soon' | null

/**
 * "YYYY-MM-DD" 形式の期日文字列から、強調表示すべき区分を判定する。
 *
 * @param dueDate CardResponse.dueDate（未設定ならnull）
 * @returns 期限切れなら'overdue'、期限間近（当日・翌日）なら'soon'、それ以外はnull
 */
export function getDueStatus(dueDate: string | null): DueStatus {
  if (dueDate === null) return null

  // "今日"を「時刻を持たない日付」として扱うため、年月日だけでDateを作り直す。
  // new Date()のまま比較すると、現在時刻（時・分・秒）が残っていて
  // 「今日の期日」が誤って過去日扱いになってしまう。
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // "YYYY-MM-DD" を分解してDateを作る。new Date(dueDate)（文字列を直接渡す形）を
  // 使わないのは、ブラウザによって"YYYY-MM-DD"をUTC0時と解釈するかローカル0時と
  // 解釈するかが分かれ、タイムゾーンによって日付がずれることがあるため。
  const [year, month, day] = dueDate.split('-').map(Number)
  const due = new Date(year, month - 1, day)

  // 2つの日付の差をミリ秒→日数に変換する。Math.roundを挟むのは、
  // 夏時間（サマータイム）の切り替わる地域で1日の長さが23時間や25時間に
  // なることがあり、単純な整数除算だと差が0.958…日のような半端な値になり得るため。
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000)

  if (diffDays < 0) return 'overdue'
  if (diffDays === 0 || diffDays === 1) return 'soon'
  return null
}

/**
 * "YYYY-MM-DD" を画面表示用の "YYYY/M/D" に整形する（先頭ゼロを詰めない）。
 * prototype/app.js の formatDateForDisplay と同じ表記に揃えている。
 */
export function formatDueDate(dueDate: string): string {
  const parts = dueDate.split('-')
  if (parts.length !== 3) return dueDate
  const [year, month, day] = parts
  return `${year}/${Number(month)}/${Number(day)}`
}
