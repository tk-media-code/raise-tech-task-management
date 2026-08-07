type Props = {
  /** この画面の見出し（例: アーカイブ、タスク検索） */
  title: string
  /** 「タスク一覧へ戻る」を押したとき。通常は navigate(boardListPath) を渡す */
  onBack: () => void
}

/**
 * 横断ビュー・ボード詳細以外のサブ画面（検索・アーカイブなど）用のページヘッダー。
 *
 * 以前は「← 戻る」リンクと h2 タイトルを同じ行に並べていたが、リンクと見出しが
 * 同じ視線の高さで競合して浮いた印象になりやすい。タスク一覧への導線を上段の控えめな操作、
 * タイトルを下段の主役に分け、下線で本文エリアと区切る。
 */
function SubpageHeader({ title, onBack }: Props) {
  return (
    <header className="mb-6 border-b border-slate-200 pb-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-2 inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        {/* 矢印は装飾。読み上げはボタンラベル全文で行われる */}
        <span aria-hidden="true">←</span>
        タスク一覧へ戻る
      </button>
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
    </header>
  )
}

export default SubpageHeader
