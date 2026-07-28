import { useParams } from 'react-router'

/**
 * ボード詳細画面（要件定義 docs/requirements/03-screens.md 6章の①）。
 * 単一ボードのカードを「未着手／作業中／完了」の3列カンバンで表示し、
 * ドラッグ＆ドロップでステータスを変更できるようにする画面（将来的にdnd kitを導入）。
 *
 * 現時点ではルーティングの動作確認が目的のプレースホルダで、URLの:boardIdを
 * useParamsで取り出して表示するだけ。実データ取得（GET /api/boards/{id}）と
 * カンバン表示は次セッションで実装する。
 */
function BoardDetailView() {
  // useParamsはURLの動的セグメント（App.tsxの ":boardId" 部分）を文字列として返す。
  // ルート未定義（該当セグメント無し）の場合はundefinedになり得るため、型は string | undefined。
  const { boardId } = useParams<{ boardId: string }>()

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">ボード詳細</h2>
      <p className="text-sm text-slate-600">
        URLから受け取った boardId:{' '}
        <span className="rounded bg-slate-200 px-2 py-1 font-mono text-slate-800">
          {boardId}
        </span>
      </p>
      <p className="mt-4 text-xs text-slate-400">
        カンバン表示（未着手／作業中／完了）とAPI接続は次セッションで実装します。
      </p>
    </section>
  )
}

export default BoardDetailView
