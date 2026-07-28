import { Route, Routes } from 'react-router'
import BoardSelect from './components/BoardSelect'
import CrossBoardView from './pages/CrossBoardView'
import BoardDetailView from './pages/BoardDetailView'

/**
 * アプリ全体の共通レイアウトとルーティング定義。
 * ヘッダーはどの画面でも表示し続け、その下の <Routes> 部分だけが
 * URLに応じて切り替わる（＝いわゆるSPAのシェル構造）。
 *
 * ヘッダーのボード切替セレクトボックス（BoardSelect）を <Routes> の外側に
 * 置いているのが要点。画面が切り替わってもアンマウントされないため、
 * ボード一覧のAPIをアプリ起動あたり1回叩くだけで済む。
 *
 * ルート構成は要件定義（docs/requirements/03-screens.md 6章）の画面遷移に対応する。
 * 検索結果・アーカイブ画面、およびボード管理モーダルは、書き込みAPIの実装後に追加する。
 */
function App() {
  return (
    // min-h-screen: コンテンツが短くてもビューポート全体を覆う（背景色の塗り残しを防ぐ）
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-300 bg-white px-6 py-4 shadow-sm">
        <h1 className="text-xl font-bold">タスク管理アプリ</h1>
        <div className="mt-3 flex items-center gap-2">
          <BoardSelect />
          {/* ⚙ ボード管理（要件6.2②）。作成・改名・削除・並べ替えはいずれも書き込みAPIが
              必要なため、現時点では場所だけ確保してdisabledにしておく
              （押せるが何も起きないボタンより、無効だと分かる方が誤解が少ない）。 */}
          <button
            type="button"
            disabled
            title="ボード管理は書き込みAPIの実装後に対応します"
            aria-label="ボード管理"
            className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-400"
          >
            ⚙
          </button>
        </div>
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
