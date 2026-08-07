import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useMatch, useNavigate } from 'react-router'
import { apiPaths } from './api/client'
import BoardManageModal from './components/BoardManageModal'
import BoardSelect from './components/BoardSelect'
import { useApi } from './hooks/useApi'
import { boardListPath, type SelectedBoardId } from './lib/boardListPath'
import ArchiveView from './pages/ArchiveView'
import CrossBoardView from './pages/CrossBoardView'
import BoardDetailView from './pages/BoardDetailView'
import NotFoundView from './pages/NotFoundView'
import SearchView from './pages/SearchView'
import type { BoardResponse } from './types/api'

/**
 * ヘッダーのサブ画面導線（タスク検索・アーカイブ）用クラス。
 * 現在の URL と一致するときアクティブ見た目にし、サブ画面側の h2 タイトルを置かなくても
 * どの画面か分かるようにする（MobileStatusTabs の選択中タブと同系統の塗り）。
 */
function headerNavLinkClass(isActive: boolean) {
  return [
    'cursor-pointer rounded border px-2 py-1 text-sm transition',
    isActive
      ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
      : 'border-slate-300 hover:bg-slate-50',
  ].join(' ')
}

/**
 * アプリ全体の共通レイアウトとルーティング定義。
 * ヘッダーはどの画面でも表示し続け、その下の <Routes> 部分だけが
 * URLに応じて切り替わる（＝いわゆるSPAのシェル構造）。
 *
 * ヘッダーのボード切替セレクトボックス（BoardSelect）を <Routes> の外側に
 * 置いているのが要点。画面が切り替わってもアンマウントされないため、
 * ボード一覧のAPIをアプリ起動あたり1回叩くだけで済む。
 *
 * ボード一覧（GET /api/boards）はこのコンポーネントが取得し、BoardSelect・BoardManageModal・
 * CrossBoardView・SearchView（配下のLabelFilterBarが使う）へpropsで配る。以前はBoardSelectが
 * 自分でuseApiを呼んでいたが、ボード管理モーダルでの新規作成をセレクトボックスへ反映させる
 * 必要が生まれたため、状態をここへ引き上げた（詳しい経緯はcomponents/BoardSelect.tsxの
 * docblock参照）。この一覧を必要とするコンポーネントは、例外なくここから受け取る。
 *
 * ルート構成は要件定義（docs/requirements/03-screens.md 6章）の画面遷移に対応する。
 * これら4つに加え、どのpathにも一致しなかったURLを受け止める404ルート
 * （pages/NotFoundView.tsx）を末尾に置いている。
 */
function App() {
  const { data: boards, loading: boardsLoading, error: boardsError, refetch: refetchBoards } =
    useApi<BoardResponse[]>(apiPaths.boards())

  // ボード管理モーダルの開閉。「今どの画面を見ているか」に関係なく、
  // ヘッダー（<Routes>の外側）から常に開けるモーダルなので、Appがこの状態を持つ。
  const [boardManageOpen, setBoardManageOpen] = useState(false)

  const location = useLocation()
  const navigate = useNavigate()
  const boardDetailMatch = useMatch('/boards/:boardId')

  // 検索・アーカイブへ移動してもヘッダーのボード選択を維持するため、App が選択状態を保持する。
  // 一覧画面（/ または /boards/:id）にいる間だけ URL と同期し、サブ画面では直前の選択を残す。
  const [selectedBoardId, setSelectedBoardId] = useState<SelectedBoardId>('all')
  useEffect(() => {
    if (boardDetailMatch?.params.boardId) {
      setSelectedBoardId(Number(boardDetailMatch.params.boardId))
    } else if (location.pathname === '/') {
      setSelectedBoardId('all')
    }
  }, [boardDetailMatch, location.pathname])

  const currentBoardListPath = boardListPath(selectedBoardId)

  // 「今表示しているボード詳細のID」を判定するためだけに使う。ボード削除時に
  // 「削除したボードをまさに見ていたか」を判断する（handleBoardDeleted参照）。

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
    if (selectedBoardId === deletedBoardId) {
      setSelectedBoardId('all')
    }
    refetchBoards()
    setDataVersion((version) => version + 1)
  }

  return (
    // min-h-screen: コンテンツが短くてもビューポート全体を覆う（背景色の塗り残しを防ぐ）
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-300 bg-white px-6 py-4 shadow-sm">
        {/* スマートフォン幅では1行に詰めるとボード選択と操作ボタンが窮屈になるため、
            縦2行（上: ボード選択、下: 操作ボタン）。768px以上（md）では横1行で左右に寄せる。 */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-2">
          <BoardSelect
            boards={boards}
            loading={boardsLoading}
            error={boardsError}
            selectedBoardId={selectedBoardId}
          />
          <div className="flex flex-wrap items-center gap-2">
            {/* ボード管理（要件6.2②）。新規作成・改名・削除・並べ替えのすべてを
                components/BoardManageModal.tsxの中で行う。
                アイコンだけだと役割が伝わりにくいので、ラベル文言をそのままボタン表示にする。
                button / Link はブラウザ既定だと矢印カーソルのままのことがあるため、
                cursor-pointer を明示して「押せる」ことが分かるようにする。 */}
            <button
              type="button"
              onClick={() => setBoardManageOpen(true)}
              className="cursor-pointer rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50"
            >
              ボード管理
            </button>
            {/* タスク検索（要件5.8）。横断ビュー・ボード詳細のどちらからでも開ける独立画面のため、
                BoardSelectと同じくヘッダー（<Routes>の外側）に置く。
                NavLink で現在画面をアクティブ表示し、SearchView 側の h2 は置かない。 */}
            <NavLink to="/search" className={({ isActive }) => headerNavLinkClass(isActive)}>
              タスク検索
            </NavLink>
            {/* アーカイブ（要件5.7）。ワイヤーフレーム6.2では①ボード詳細・③横断ビューの
                両方から開ける導線として描かれているが、タスク検索と同じ理由でヘッダー
                （<Routes>の外側）に1つ置けば両画面から開けるため、個別に配置し直さない。 */}
            <NavLink to="/archive" className={({ isActive }) => headerNavLinkClass(isActive)}>
              アーカイブ
            </NavLink>
          </div>
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
          {/* SearchView自身はboardsを使わない。配下のLabelFilterBar（ラベル絞り込みUI）へ
              中継させるために渡している。以前はLabelFilterBarが独自にGET /api/boardsを
              呼んでおり、上のdocblockに書いた「アプリ起動あたり1回」という方針を破る
              唯一の箇所だった。 */}
          <Route
            path="/search"
            element={
              <SearchView
                boards={boards}
                boardsLoading={boardsLoading}
                boardsError={boardsError}
                boardListPath={currentBoardListPath}
              />
            }
          />
          <Route path="/archive" element={<ArchiveView boardListPath={currentBoardListPath} />} />
          {/* 上のどれにも一致しなかったURLの受け皿。path="*"は必ず最後に置く
              （<Routes>は一致した最初の1つだけを描画するため、先頭に書くと
              すべてのURLがここで止まってしまう）。 */}
          <Route path="*" element={<NotFoundView />} />
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
