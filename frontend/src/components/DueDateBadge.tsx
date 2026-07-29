import { formatDueDate, getDueStatus } from '../lib/dueDate'

type Props = {
  /** "YYYY-MM-DD" 形式の期日文字列。null（未設定）はこのコンポーネントを呼ぶ側で弾く想定 */
  dueDate: string
}

/**
 * 種類ごとの絵文字とTailwindクラス。
 * 要件定義5.6: 期限切れは赤系、期限間近（前日〜当日）は黄系で強調する。
 */
const DUE_STATUS_STYLE = {
  overdue: { emoji: '🔴', className: 'bg-red-50 text-red-700' },
  soon: { emoji: '🟡', className: 'bg-amber-50 text-amber-700' },
} as const

/**
 * 期日バッジ（要件定義 5.6）。
 * 期限切れ・期限間近のときだけ絵文字付きで強調表示し、それ以外は色のない
 * 通常のテキストとして表示する。呼び出し側（CardItem・CardDetailModal）は
 * dueDateがnull（未設定）でない場合にのみこのコンポーネントを描画する。
 */
function DueDateBadge({ dueDate }: Props) {
  const status = getDueStatus(dueDate)
  const display = formatDueDate(dueDate)

  // 強調なし（status === null）のときは、絵文字も色付き背景も付けない通常表示にする。
  if (status === null) {
    return <span className="text-xs text-slate-500">{display}</span>
  }

  const style = DUE_STATUS_STYLE[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${style.className}`}>
      <span aria-hidden="true">{style.emoji}</span>
      {display}
    </span>
  )
}

export default DueDateBadge
