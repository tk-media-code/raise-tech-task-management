import type { ReactNode } from 'react'

/** 表示の種類。見た目とアクセシビリティ属性がこれで決まる */
type StatusKind = 'loading' | 'error' | 'empty'

type Props = {
  kind: StatusKind
  children: ReactNode
}

/**
 * 種類ごとのTailwindクラス。
 * Tailwindはビルド時にソースコードを文字列として走査してCSSを生成するため、
 * `bg-${color}-50` のように文字列を組み立てて指定するとクラスを見つけられず、
 * スタイルが当たらない。必ず完全なクラス名をソース中にそのまま書くこと。
 */
const KIND_CLASSES: Record<StatusKind, string> = {
  loading: 'border-slate-200 bg-white text-slate-500',
  error: 'border-red-200 bg-red-50 text-red-700',
  empty: 'border-slate-200 bg-white text-slate-400',
}

/**
 * 「読み込み中」「エラー」「データなし」を同じ見た目で表示する共通コンポーネント。
 * 横断ビュー・ボード詳細・カード詳細モーダルの3箇所で同じマークアップを
 * 書き散らさないために切り出している。
 */
function StatusMessage({ kind, children }: Props) {
  return (
    <p
      className={`rounded-lg border p-4 text-sm ${KIND_CLASSES[kind]}`}
      // role="status" / "alert" は、内容が非同期に差し替わることをスクリーンリーダーに
      // 伝えるための目印。alertの方が割り込み度が高い（即座に読み上げられる）ので、
      // 失敗時だけそちらを使う。
      role={kind === 'error' ? 'alert' : 'status'}
    >
      {children}
    </p>
  )
}

export default StatusMessage
