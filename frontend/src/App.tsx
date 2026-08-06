import { useState } from 'react'
import { Link, Route, Routes, useLocation, useMatch, useNavigate } from 'react-router'
import { apiPaths } from './api/client'
import BoardManageModal from './components/BoardManageModal'
import BoardSelect from './components/BoardSelect'
import { useApi } from './hooks/useApi'
import ArchiveView from './pages/ArchiveView'
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
  const navigate = useNavigate()
  // 「今表示しているボード詳細のID」を判定するためだけに使う。BoardSelect.tsxが選択状態の
  // 判定に使っているのと同じuseMatchで、ボード削除時に「削除したボードをまさに見ていたか」を
  // 判断する（handleBoardDeleted参照）。
  const boardDetailMatch = useMatch('/boards/:boardId')

  // ボード削除のたびに増える値。<Routes>のkeyに渡すことで、削除の瞬間に今表示中のページ
  // （CrossBoardView・ArchiveView・SearchViewなど）を強制的に再マウントさせる。
  // これらのページは自前のuseApiでカード一覧を取得しており、Appからはrefetchを呼べない。
  // ボードを削除すると、そのボードに属していたカードもDB側でカスケード削除されるが、
  // 何もしなければ「削除したはずのボードのカードが、開いたままの画面に残り続ける」ことになる。
  // keyを変えてコンポーネントを丸ごと作り直すと、内部のuseApiが最初から走り直し、
  // サーバーの最新状態（＝カードが消えた状態）に揃う。削除以外の操作ではこの値を変えないため、
  // 通常の操作で余計な再マウントは起きない。
  const [dataVersion, setDataVersion] = useState(0)

  /**
   * ボード削除（BoardManageModal経由）が成功したときに呼ばれる。
   * 改名・並べ替え・新規作成（refetchBoardsだけで足りる操作）と違い、削除は
   * 「今まさにそのボードの詳細画面を見ていた」可能性があるぶん、追加の後始末が要る。
   */
  function handleBoardDeleted(deletedBoardId: number) {
    // 削除したボードの詳細画面（/boards/{id}）を表示中であれば、存在しなくなった画面に
    // 取り残されないよう横断ビューへ戻す（プロトタイプが選択中ビューを削除したとき
    // 「すべて」表示へ戻すのと同じ考え方）。
    if (boardDetailMatch !== null && boardDetailMatch.params.boardId === String(deletedBoardId)) {
      navigate('/')
    }
    refetchBoards()
    setDataVersion((version) => version + 1)
  }

  return (
    // min-h-screen: コンテンツが短くてもビューポート全体を覆う（背景色の塗り残しを防ぐ）
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-300 bg-white px-6 py-4 shadow-sm">
        <h1 className="text-xl font-bold">タスク管理アプリ</h1>
        <div className="mt-3 flex items-center gap-2">
          <BoardSelect boards={boards} loading={boardsLoading} error={boardsError} />
          {/* ⚙ ボード管理（要件6.2②）。新規作成・改名・削除・並べ替えのすべてを
              components/BoardManageModal.tsxの中で行う。 */}
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
          {/* 📥 アーカイブ（要件5.7）。ワイヤーフレーム6.2では①ボード詳細・③横断ビューの
              両方から開ける導線として描かれているが、🔍検索と同じ理由でヘッダー
              （<Routes>の外側）に1つ置けば両画面から開けるため、個別に配置し直さない。
              stateの渡し方も🔍検索と同じ（pages/ArchiveView.tsxの「← 戻る」が使う）。 */}
          <Link
            to="/archive"
            state={{ from: `${location.pathname}${location.search}` }}
            title="アーカイブ"
            aria-label="アーカイブ"
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50"
          >
            📥
          </Link>
        </div>
      </header>

      <main className="p-6">
        {/* keyにdataVersionを渡している理由はdataVersion自体のコメント参照。
            ボード削除以外のタイミングでは値が変わらないため、通常のページ遷移・再レンダリングでは
            これまで通りアンマウントされない。 */}
        <Routes key={dataVersion}>
          {/* boardsをそのままpropsで渡す（CrossBoardView自身にGET /api/boardsを
              呼ばせない）。elementに書けるのはただのJSXなので、他のpropsと同じように
              値を渡せる（docs/react/05-router.md 13章参照）。 */}
          <Route path="/" element={<CrossBoardView boards={boards} />} />
          <Route path="/boards/:boardId" element={<BoardDetailView />} />
          <Route path="/search" element={<SearchView />} />
          <Route path="/archive" element={<ArchiveView />} />
        </Routes>
      </main>

      <BoardManageModal
        open={boardManageOpen}
        boards={boards ?? []}
        onChanged={refetchBoards}
        onDeleted={handleBoardDeleted}
        onClose={() => setBoardManageOpen(false)}
      />
    </div>
  )
}

export default App
