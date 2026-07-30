import { useMemo, useState } from 'react'
import { closestCenter, DndContext, DragOverlay } from '@dnd-kit/core'
import { apiPaths } from '../api/client'
import CardCreateForm from '../components/CardCreateForm'
import CardDetailModal from '../components/CardDetailModal'
import CardDragPreview from '../components/CardDragPreview'
import SortableCardList from '../components/SortableCardList'
import StatusColumn from '../components/StatusColumn'
import StatusMessage from '../components/StatusMessage'
import { useApi } from '../hooks/useApi'
import { columnId, useCardDragAndDrop } from '../hooks/useCardDragAndDrop'
import { groupCardsByStatusAndBoard } from '../lib/grouping'
import { STATUSES, STATUS_LABELS } from '../lib/status'
import type { BoardResponse, CardResponse } from '../types/api'

type Props = {
  /**
   * ヘッダーの⚙ボード管理と同じくApp.tsxが取得済みのボード一覧をそのまま受け取る。
   * このコンポーネント自身がGET /api/boardsを呼ばないのは、App.tsxのdocblockに
   * 書かれている「ボード一覧のAPIをアプリ起動あたり1回叩くだけで済む」という
   * 設計を崩さないため（二重フェッチを避ける）。未取得・取得失敗のときはnull。
   */
  boards: BoardResponse[] | null
}

/**
 * 横断ビュー画面（要件定義 docs/requirements/03-screens.md 6章の③）。
 * アプリの初期表示画面で、全ボードのカードを「未着手／作業中／完了」の3列で
 * 横断的に見せる。ボード詳細画面（①）と同じ3列の枠組みを保ったまま、
 * 各列の中身をボード単位でグループ化して表示するのがこの画面の要点
 * （要件5.4 横断マージビュー）。
 *
 * プロトタイプ（prototype/app.js）は横断ビューの未着手列でも、ボードごとの
 * セクションそれぞれに「＋ カードを追加」を置いていた（buildQuickAddHtmlを
 * ボード詳細画面と共有）。この画面も同じくボードごとに独立した`CardCreateForm`を
 * 未着手セクションへ置くことでこれに揃えている。
 *
 * ドラッグ＆ドロップ（要件5.3）は「ステータス×ボード」を1つの列（hooks/useCardDragAndDrop.tsの
 * columnId）として扱う。ボードをまたいだドロップは、useCardDragAndDrop側で
 * 「別ボードのセクションへのドロップは無視する」判定が入っているため、この画面の側では
 * 何も特別な考慮をせず、ボード詳細画面と同じ1本のDndContextで済ませられる。
 */
function CrossBoardView({ boards }: Props) {
  // boardIdを指定せずGET /api/cardsを呼ぶと、全ボードのカードが返る
  // （archived=falseはapiPaths.cards()の中で常に付与される）。
  // refetchはCardCreateFormでのカード追加後、一覧を取り直すために使う
  // （BoardDetailView.tsxと同じ理由。hooks/useApi.tsのrefetch参照）。
  const { data: cards, loading, error, refetch } = useApi<CardResponse[]>(apiPaths.cards())

  // ドラッグ＆ドロップの状態一式。dragAndDrop.cardsは、ドラッグ直後の一時的な期間だけ
  // useApiの生のcardsではなくローカルで並べ替え済みの一覧を返す（詳細はフックのdocblock参照）。
  const dragAndDrop = useCardDragAndDrop(cards, refetch)

  // フラットな配列を「ステータス→ボード→カード」の3階層に組み替える。
  // boardsも依存配列に含めるのは、ボード管理モーダルでの新規作成直後、
  // カード側は変わらずボード一覧だけが更新されるケースでも組み替えを
  // やり直す必要があるため（新しいボードのセクションを出現させる）。
  const grouped = useMemo(() => groupCardsByStatusAndBoard(dragAndDrop.cards, boards), [dragAndDrop.cards, boards])

  // 開いているカード詳細モーダルのカードID。nullは「閉じている」を表す。
  // このstateをApp.tsxではなくこのページ自身が持つのは、モーダルを開く操作
  // （カードのクリック）がこのページの中でしか起きないため。
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null)

  /**
   * 画面の中身（3列 or 状態メッセージ）を組み立てる。
   * ネストした三項演算子ではなく「上から順に早期returnする」形にすると、
   * 読み込み中→失敗→0件→正常、という優先順位がそのまま縦に並んで読める。
   *
   * これは <RenderContent /> のようなコンポーネントとしてではなく、ただの関数として
   * 呼び出している（JSXの中で renderContent() のように呼ぶ）。コンポーネントとして
   * 呼び出す形（<RenderContent />）にすると、Reactが毎レンダリングで「別の型の
   * コンポーネント」と見なして中身を作り直してしまう（内部にstateがあれば消える）。
   */
  function renderContent() {
    if (loading) return <StatusMessage kind="loading">読み込み中…</StatusMessage>
    if (error !== null) {
      return <StatusMessage kind="error">読み込みに失敗しました：{error.message}</StatusMessage>
    }
    if (cards === null) {
      // loading=false かつ error=null であれば useApi は必ず data をセットしているため、
      // ここに到達することは実質無い。cards: T | null という型を満たすためのガード
      // （pages/BoardDetailView.tsxの同じ分岐と同じ理由）。
      return <StatusMessage kind="empty">表示できるカードがありません。</StatusMessage>
    }

    // 以前は`cards.length === 0`もここで打ち切っていたが、それでは「カードが1枚も
    // 無いボード」＝横断ビューから＋カードを追加するのが最も必要な状況で3列自体が
    // 消えてしまう（pages/BoardDetailView.tsxで同じ理由により先に直した判断と同じ）。
    // 0件でも3列・各ボードのセクションは必ず描画する。
    return (
      <DndContext
        sensors={dragAndDrop.sensors}
        collisionDetection={closestCenter}
        onDragStart={dragAndDrop.handleDragStart}
        onDragEnd={dragAndDrop.handleDragEnd}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {STATUSES.map((status) => {
            const boardGroups = grouped[status]
            return (
              <StatusColumn
                key={status}
                title={STATUS_LABELS[status]}
                // 列見出しの件数は「ボードごとの件数の合計」。reduceで1つずつ足し込む。
                count={boardGroups.reduce((sum, group) => sum + group.cards.length, 0)}
              >
                {boardGroups.length === 0 ? (
                  // カードが0件なのではなく、ボード自体が1つも無い状態
                  // （lib/grouping.tsのgroupCardsByStatusAndBoardはboardsを事前登録するため、
                  // ボードが1つでもあればここには来ない）。
                  <p className="text-xs text-slate-400">ボードがありません。⚙ から作成してください</p>
                ) : (
                  boardGroups.map((group) => (
                    // keyはboardId（中身が変わっても揺れないID）を使う。
                    // gap-2はh4見出し・カード一覧・（todo列のみ）追加フォームの3つを
                    // 均等な間隔で縦に並べるため（3つとも常に揃っているとは限らない）。
                    <div key={group.boardId} className="flex flex-col gap-2">
                      {/* ▼ はワイヤーフレーム（03-screens.md 6.2③）に合わせた
                          ボード別セクションの見出し記号。列見出し(h3)の下なのでh4にする。 */}
                      <h4 className="text-xs font-semibold text-slate-500">▼ {group.boardName}</h4>
                      {/* カードが0件のボードセクションでも、SortableCardList自体は描画する
                          （emptyHintを渡さないため見た目には何も出ないが、ドロップ領域としては
                          存在し続ける。プロトタイプ同様、空の一覧に「カードはまだありません」
                          文言までは出さない、という以前からの方針は保っている）。 */}
                      <SortableCardList
                        id={columnId(status, group.boardId)}
                        cards={group.cards}
                        onSelect={(cardId) => setSelectedCardId(cardId)}
                        onMoved={refetch}
                      />
                      {/* 「＋ カードを追加」はボードごとに1つ、未着手セクションの下にのみ置く
                          （pages/BoardDetailView.tsxと同じくワイヤーフレーム6.2①の配置ルール。
                          新規作成されたカードは常にstatus=todoなので置き場所もここ一択になる）。
                          group.boardIdは常にnumberなので、BoardDetailView.tsxのような
                          undefinedガードは不要（あちらはURLの文字列から変換していたため必要だった）。 */}
                      {status === 'todo' && <CardCreateForm boardId={group.boardId} onCreated={refetch} />}
                    </div>
                  ))
                )}
              </StatusColumn>
            )
          })}
        </div>

        {/* ドラッグ中、ポインタに追従する見た目のコピー。activeCardがnull（ドラッグしていない）
            間は何も描画しない。 */}
        <DragOverlay>
          {dragAndDrop.activeCard !== null && <CardDragPreview card={dragAndDrop.activeCard} />}
        </DragOverlay>
      </DndContext>
    )
  }

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">横断ビュー</h2>
      {renderContent()}
      {dragAndDrop.error !== null && (
        <StatusMessage kind="error">カードの移動に失敗しました：{dragAndDrop.error.message}</StatusMessage>
      )}
      {/* selectedCardIdがnullのときCardDetailModalは何も描画しない(return null)。
          「開いているときだけ<CardDetailModal>をJSXに書く」のではなく、常に置いて
          cardIdの値で開閉を制御しているのは、モーダルの内部stateをReactに
          維持させ続けるため（都度マウント/アンマウントを避ける）。 */}
      <CardDetailModal cardId={selectedCardId} onUpdated={refetch} onClose={() => setSelectedCardId(null)} />
    </section>
  )
}

export default CrossBoardView
