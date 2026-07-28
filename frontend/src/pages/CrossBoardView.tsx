/**
 * 横断ビュー画面（要件定義 docs/requirements/03-screens.md 6章の②）。
 * アプリの初期表示画面で、全ボードのカードを「未着手／作業中／完了」の3列で横断的に見せる。
 *
 * 現時点ではバックエンドAPIと繋いでいないため実データは表示せず、
 * ①Reactが描画できている ②Tailwindのユーティリティクラスが効いている
 * の2点が目視確認できるプレースホルダとして3列のカラム枠だけを用意している。
 * 実データの表示（GET /api/cards の呼び出し）は次セッションで実装する。
 */
function CrossBoardView() {
  // 要件定義どおりステータスは固定の3種（自由な列追加はスコープ外）。
  // 実データ接続後もこの並び順・ラベルをそのまま使う想定。
  const statuses = ['未着手', '作業中', '完了'] as const

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">横断ビュー</h2>
      <p className="mb-4 text-sm text-slate-600">
        環境構築の動作確認用プレースホルダです。API接続は次セッションで実装します。
      </p>

      {/* grid-cols-3: 3列固定レイアウト。ステータス列を自由に増減できる設計にはしない
          （MEMORY: ステータス列は固定にする方針のため、横断ビューでも列を動的生成しない） */}
      <div className="grid grid-cols-3 gap-4">
        {statuses.map((status) => (
          <div
            key={status}
            className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
          >
            <h3 className="mb-2 font-medium">{status}</h3>
            <p className="text-xs text-slate-400">カードはまだありません</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default CrossBoardView
