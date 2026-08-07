type Props = {
  /** 「タスク一覧へ戻る」を押したとき。通常は navigate(boardListPath) を渡す */
  onBack: () => void
}

/**
 * 横断ビュー・ボード詳細以外のサブ画面（検索・アーカイブなど）用のページヘッダー。
 *
 * 画面名（タスク検索・アーカイブなど）は App.tsx ヘッダーの対応ボタンを
 * アクティブ表示するため、ここでは h2 タイトルを置かない。戻る導線だけを
 * 下線付きの控えめな操作として示す。
 */
function SubpageHeader({ onBack }: Props) {
  return (
    <header className="mb-6 border-b border-slate-200 pb-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        {/* 矢印は装飾。読み上げはボタンラベル全文で行われる */}
        <span aria-hidden="true">←</span>
        タスク一覧へ戻る
      </button>
    </header>
  )
}

export default SubpageHeader
