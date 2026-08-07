import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { apiPaths } from '../api/client'
import CardCreateForm from '../components/CardCreateForm'
import CardDetailModal from '../components/CardDetailModal'
import CardDragPreview from '../components/CardDragPreview'
import MobileStatusTabs from '../components/MobileStatusTabs'
import SortableCardList from '../components/SortableCardList'
import StatusColumn from '../components/StatusColumn'
import StatusMessage from '../components/StatusMessage'
import { useApi } from '../hooks/useApi'
import { cardCollisionDetection, columnId, useCardDragAndDrop } from '../hooks/useCardDragAndDrop'
import { groupCardsByStatus } from '../lib/grouping'
import { STATUSES, STATUS_LABELS } from '../lib/status'
import type { CardResponse, CardStatus } from '../types/api'

/**
 * ボード詳細画面（要件定義 docs/requirements/03-screens.md 6章の①）。
 * 単一ボードのカードを「未着手／作業中／完了」の3列カンバンで表示する。
 * 横断ビュー（③）と3列の枠組みは同じだが、こちらはボード別セクションを
 * 挟まず、カードをそのままステータス列に並べる点が違う。
 *
 * ドラッグ＆ドロップによる列間の移動・列内の並べ替え（要件5.3）は
 * hooks/useCardDragAndDrop.tsに実装をまとめ、この画面はDndContextで包んで
 * センサー・イベントハンドラを繋ぐだけにしている。
 */
function BoardDetailView() {
  // useParamsはURLの動的セグメント（App.tsxの":boardId"部分）を文字列として返す。
  const { boardId } = useParams<{ boardId: string }>()

  // boardIdの型はstring | undefined（React Routerは「このURLパターンに実際に
  // マッチしたか」を型では表現できないため）。App.tsxのルート定義
  // ("/boards/:boardId") を通ってこの画面が描画される限り実際には必ず文字列になるが、
  // 型どおりundefinedの可能性にも備えておく。undefinedのときはuseApiにnullを渡し、
  // 意味のないURL（"/api/cards?boardId=undefined&..."）でのフェッチを起こさない。
  const path = boardId === undefined ? null : apiPaths.cards({ boardId })
  const { data: cards, loading, error, refetch } = useApi<CardResponse[]>(path)

  // CardCreateFormが要求するboardId（number）。文字列のままNumber()に渡さず、
  // undefinedガードを一箇所にまとめておく（pathの組み立てと同じ理由）。
  const boardIdNumber = boardId === undefined ? null : Number(boardId)

  // ドラッグ＆ドロップの状態一式。dragAndDrop.cardsは、ドラッグ直後の一時的な期間だけ
  // useApiの生のcardsではなくローカルで並べ替え済みの一覧を返す（詳細はフックのdocblock参照）。
  const dragAndDrop = useCardDragAndDrop(cards, refetch)

  // 横断ビューと違い、この画面はボード別セクションが要らないので
  // groupCardsByStatus（ステータス→カードの2階層）を使う。
  const grouped = useMemo(() => groupCardsByStatus(dragAndDrop.cards), [dragAndDrop.cards])

  const [selectedCardId, setSelectedCardId] = useState<number | null>(null)

  // スマートフォン幅（768px未満）で表示中のタブ。プロトタイプ（prototype/app.js の
  // ui.mobileActiveStatus）と同じく初期値は'todo'。
  const [mobileActiveStatus, setMobileActiveStatus] = useState<CardStatus>('todo')

  // ボードを切り替える（＝boardIdが変わる）と、この画面はアンマウントされず再利用される
  // （components/BoardSelect.tsxのnavigate(`/boards/${value}`)は、同じRouteパターン
  // ("/boards/:boardId")内でのパラメータ変更にすぎないため。React Routerの標準挙動）。
  // 何もしなければ「ボードAで『作業中』タブを見ていた」状態のままボードBへ切り替わって
  // しまう。boardIdが変わるたびにタブを'todo'へ戻し、プロトタイプ（prototype/app.js:1408、
  // ビュー切替時にui.mobileActiveStatus='todo'とする処理）と挙動を揃える。
  useEffect(() => {
    setMobileActiveStatus('todo')
  }, [boardId])

  /**
   * 画面の中身（3列 or 状態メッセージ）を組み立てる。関数として呼ぶ理由は
   * CrossBoardView.tsxの同名関数のコメントを参照（コンポーネント化すると
   * 毎レンダリングで中身が作り直されてしまうため）。
   */
  function renderContent() {
    if (loading) return <StatusMessage kind="loading">読み込み中…</StatusMessage>
    if (error !== null) {
      return <StatusMessage kind="error">読み込みに失敗しました：{error.message}</StatusMessage>
    }
    if (cards === null || boardIdNumber === null) {
      // loading=false かつ error=null であれば useApi は必ず data をセットしているため、
      // cards===nullにここで到達することは実質無い。boardIdNumber===nullも同様
      // （pathがnullでない＝boardIdが文字列である場合にしかcardsは非nullにならないため）。
      // どちらも型を満たすためのガード。
      return <StatusMessage kind="empty">表示できるカードがありません。</StatusMessage>
    }

    // 以前はcards.length === 0のときここで打ち切り、3列そのものを描画していなかった。
    // しかしそれでは「カードが1件もないボード」＝「＋ カードを追加が最も必要な状況」で
    // フォーム自体が画面から消えてしまう（作成直後の空ボードがまさにこのケース）。
    // 0件でも3列は必ず描画し、各列の中でカードの有無を出し分ける形に変更した。
    return (
      <DndContext
        sensors={dragAndDrop.sensors}
        collisionDetection={cardCollisionDetection}
        onDragStart={dragAndDrop.handleDragStart}
        onDragMove={dragAndDrop.handleDragMove}
        onDragEnd={dragAndDrop.handleDragEnd}
        onDragCancel={dragAndDrop.handleDragCancel}
      >
        <MobileStatusTabs
          activeStatus={mobileActiveStatus}
          countsByStatus={{ todo: grouped.todo.length, doing: grouped.doing.length, done: grouped.done.length }}
          onSelect={setMobileActiveStatus}
        />
        <div className="grid gap-4 md:grid-cols-3">
          {STATUSES.map((status) => {
            const statusCards = grouped[status]
            return (
              <StatusColumn
                key={status}
                title={STATUS_LABELS[status]}
                count={statusCards.length}
                isActiveOnMobile={status === mobileActiveStatus}
              >
                <SortableCardList
                  id={columnId(status, boardIdNumber)}
                  cards={statusCards}
                  onSelect={(cardId) => setSelectedCardId(cardId)}
                  onMoved={refetch}
                  emptyHint={<p className="text-xs text-slate-400">カードはまだありません</p>}
                  dropIndicator={dragAndDrop.dropIndicator}
                />
                {/* 「＋ カードを追加」は未着手列の下にのみ置く（ワイヤーフレーム6.2①）。
                    新規作成されたカードは常にstatus=todoなので、置き場所もここ一択になる。 */}
                {status === 'todo' && <CardCreateForm boardId={boardIdNumber} onCreated={refetch} />}
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
      {/* 画面上部の「ボード詳細」見出しは、ヘッダーのボード選択で現在のボードが分かるため置かない
          （CrossBoardView.tsx の横断ビュー見出し削除と同じ考え方）。 */}
      {renderContent()}
      {dragAndDrop.error !== null && (
        <StatusMessage kind="error">カードの移動に失敗しました：{dragAndDrop.error.message}</StatusMessage>
      )}
      <CardDetailModal cardId={selectedCardId} onUpdated={refetch} onClose={() => setSelectedCardId(null)} />
    </section>
  )
}

export default BoardDetailView
