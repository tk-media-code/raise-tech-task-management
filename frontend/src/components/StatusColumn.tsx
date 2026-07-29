import type { ReactNode } from 'react'

type Props = {
  /** 列見出し（例: "未着手"） */
  title: string
  /** 見出し末尾に表示する件数（例: 2 → "未着手 (2)"） */
  count: number
  children: ReactNode
}

/**
 * ステータス列1本ぶんの外枠（要件定義 6.2 ①）。
 *
 * 横断ビューとボード詳細で列の中身（childrenの構造）は異なる
 * （横断ビューはボード別セクション、ボード詳細はカードの平坦なリスト）が、
 * 「見出し＋件数の付いた枠」という外側の見た目は共通なので、その部分だけを
 * このコンポーネントに切り出している。中身をchildrenとして受け取る形にすることで、
 * StatusColumn自身は「中身が何か」を一切知らずに済む（関心の分離）。
 */
function StatusColumn({ title, count, children }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
      <h3 className="text-sm font-semibold text-slate-700">
        {title} ({count})
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

export default StatusColumn
