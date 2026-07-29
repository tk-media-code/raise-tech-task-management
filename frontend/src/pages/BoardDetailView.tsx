import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { apiPaths } from '../api/client'
import CardDetailModal from '../components/CardDetailModal'
import CardItem from '../components/CardItem'
import StatusColumn from '../components/StatusColumn'
import StatusMessage from '../components/StatusMessage'
import { useApi } from '../hooks/useApi'
import { groupCardsByStatus } from '../lib/grouping'
import { STATUSES, STATUS_LABELS } from '../lib/status'
import type { CardResponse } from '../types/api'

/**
 * ボード詳細画面（要件定義 docs/requirements/03-screens.md 6章の①）。
 * 単一ボードのカードを「未着手／作業中／完了」の3列カンバンで表示する。
 * 横断ビュー（③）と3列の枠組みは同じだが、こちらはボード別セクションを
 * 挟まず、カードをそのままステータス列に並べる点が違う。
 *
 * ドラッグ＆ドロップによるステータス変更（要件5.3）は書き込みAPIが必要なため、
 * このセッションでは対象外（今回はカードの閲覧のみ）。
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
  const { data: cards, loading, error } = useApi<CardResponse[]>(path)

  // 横断ビューと違い、この画面はボード別セクションが要らないので
  // groupCardsByStatus（ステータス→カードの2階層）を使う。
  const grouped = useMemo(() => groupCardsByStatus(cards), [cards])

  const [selectedCardId, setSelectedCardId] = useState<number | null>(null)

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
    if (cards === null || cards.length === 0) {
      return <StatusMessage kind="empty">表示できるカードがありません。</StatusMessage>
    }

    return (
      <div className="grid gap-4 md:grid-cols-3">
        {STATUSES.map((status) => {
          const statusCards = grouped[status]
          return (
            <StatusColumn key={status} title={STATUS_LABELS[status]} count={statusCards.length}>
              {statusCards.length === 0 ? (
                <p className="text-xs text-slate-400">カードはまだありません</p>
              ) : (
                statusCards.map((card) => (
                  <CardItem
                    key={card.id}
                    card={card}
                    onSelect={(cardId) => setSelectedCardId(cardId)}
                  />
                ))
              )}
            </StatusColumn>
          )
        })}
      </div>
    )
  }

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">ボード詳細</h2>
      {renderContent()}
      <CardDetailModal cardId={selectedCardId} onClose={() => setSelectedCardId(null)} />
    </section>
  )
}

export default BoardDetailView
