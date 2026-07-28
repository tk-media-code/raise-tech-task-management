import { Link, Route, Routes } from 'react-router'
import CrossBoardView from './pages/CrossBoardView'
import BoardDetailView from './pages/BoardDetailView'

/**
 * アプリ全体の共通レイアウトとルーティング定義。
 * ヘッダー（ナビゲーション）はどの画面でも表示し続け、その下の <Routes> 部分だけが
 * URLに応じて切り替わる（＝いわゆるSPAのシェル構造）。
 *
 * ルート構成は要件定義（docs/requirements/03-screens.md 6章）の画面遷移に対応する。
 * 現時点では横断ビュー／ボード詳細のみのプレースホルダで、検索結果・アーカイブ・
 * モーダル類（ボード管理／カード詳細）は次セッション以降、実データと合わせて追加する。
 */
function App() {
  return (
    // min-h-screen: コンテンツが短くてもビューポート全体を覆う（背景色の塗り残しを防ぐ）
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-300 bg-white px-6 py-4 shadow-sm">
        <h1 className="text-xl font-bold">タスク管理アプリ</h1>
        <nav className="mt-2 flex gap-4 text-sm">
          {/* <Link>は<a>と違いページ全体を再読み込みしない。React Routerが
              History APIでURLだけ書き換え、Routesが対応する画面を差し替える。 */}
          <Link to="/" className="text-blue-600 hover:underline">
            横断ビュー
          </Link>
          {/* ボード詳細は本来ボード一覧から遷移するが、動作確認用に固定IDへのリンクを置く */}
          <Link to="/boards/1" className="text-blue-600 hover:underline">
            ボード詳細（例: id=1）
          </Link>
        </nav>
      </header>

      <main className="p-6">
        <Routes>
          <Route path="/" element={<CrossBoardView />} />
          <Route path="/boards/:boardId" element={<BoardDetailView />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
