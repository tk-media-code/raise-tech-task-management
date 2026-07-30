import { useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router'
import { apiPaths } from './api/client'
import BoardManageModal from './components/BoardManageModal'
import BoardSelect from './components/BoardSelect'
import { useApi } from './hooks/useApi'
import CrossBoardView from './pages/CrossBoardView'
import BoardDetailView from './pages/BoardDetailView'
import SearchView from './pages/SearchView'
import type { BoardResponse } from './types/api'

/**
 * アプリ全体の共通レイアウトとルーティング定義。
 * ヘッダーはどの画面でも表示し続け、その下の <Routes> 部分だけが
 * URLに応じて切り替わる（＝いわゆるSPAのシェル構造）。
 *
 * ヘッダーのボード切替セレクトボックス（BoardSelect）を <Routes> の外側に
 * 置いているのが要点。画面が切り替わってもアンマウントされないため、
 * ボード一覧のAPIをアプリ起動あたり1回叩くだけで済む。
 *
 * ボード一覧（GET /api/boards）はこのコンポーネントが取得し、BoardSelectと
 * BoardManageModalの両方へpropsで配る。以前はBoardSelectが自分でuseApiを呼んでいたが、
 * ボード管理モーダルでの新規作成をセレクトボックスへ反映させる必要が生まれたため、
 * 状態をここへ引き上げた（詳しい経緯はcomponents/BoardSelect.tsxのdocblock参照）。
 *
 * ルート構成は要件定義（docs/requirements/03-screens.md 6章）の画面遷移に対応する。
 * アーカイブ画面は、書き込みAPI（PUT/DELETE）の実装後に追加する。
 */
function App() {
  const { data: boards, loading: boardsLoading, error: boardsError, refetch: refetchBoards } =
    useApi<BoardResponse[]>(apiPaths.boards())

  // ボード管理モーダルの開閉。「今どの画面を見ているか」に関係なく、
  // ヘッダー（<Routes>の外側）から常に開けるモーダルなので、Appがこの状態を持つ。
  const [boardManageOpen, setBoardManageOpen] = useState(false)

  // 検索画面の「← 戻る」が、検索中に積んだ絞り込み履歴（キーワード・ラベルの変更ごとに
  // 1つずつ増える）を1件ずつ遡るのではなく、検索を開く直前の画面へ一直線に戻れるように、
  // 遷移元のパスをLinkのstateとして持たせておく（pages/SearchView.tsx参照）。
  const location = useLocation()

  return (
    // min-h-screen: コンテンツが短くてもビューポート全体を覆う（背景色の塗り残しを防ぐ）
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-300 bg-white px-6 py-4 shadow-sm">
        <h1 className="text-xl font-bold">タスク管理アプリ</h1>
        <div className="mt-3 flex items-center gap-2">
          <BoardSelect boards={boards} loading={boardsLoading} error={boardsError} />
          {/* ⚙ ボード管理（要件6.2②）。新規作成が実装できたため有効化した。
              改名・削除・並べ替えはPUT/DELETE系APIが未実装のため、モーダル内の該当ボタンは
              引き続きdisabledのまま（components/BoardManageModal.tsx参照）。 */}
          <button
            type="button"
            onClick={() => setBoardManageOpen(true)}
            title="ボード管理"
            aria-label="ボード管理"
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50"
          >
            ⚙
          </button>
          {/* 🔍 検索（要件5.8）。横断ビュー・ボード詳細のどちらからでも開ける独立画面のため、
              BoardSelectと同じくヘッダー（<Routes>の外側）に置く。 */}
          <Link
            to="/search"
            state={{ from: `${location.pathname}${location.search}` }}
            title="検索"
            aria-label="検索"
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50"
          >
            🔍
          </Link>
        </div>
      </header>

      <main className="p-6">
        <Routes>
          {/* boardsをそのままpropsで渡す（CrossBoardView自身にGET /api/boardsを
              呼ばせない）。elementに書けるのはただのJSXなので、他のpropsと同じように
              値を渡せる（docs/react/05-router.md 13章参照）。 */}
          <Route path="/" element={<CrossBoardView boards={boards} />} />
          <Route path="/boards/:boardId" element={<BoardDetailView />} />
          <Route path="/search" element={<SearchView />} />
        </Routes>
      </main>

      <BoardManageModal
        open={boardManageOpen}
        boards={boards ?? []}
        onCreated={refetchBoards}
        onClose={() => setBoardManageOpen(false)}
      />
    </div>
  )
}

export default App
