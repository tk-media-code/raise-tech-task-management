import { useState } from 'react'
import { apiPaths } from '../api/client'
import ArchivedCardItem from '../components/ArchivedCardItem'
import CardDetailModal from '../components/CardDetailModal'
import StatusMessage from '../components/StatusMessage'
import { useApi } from '../hooks/useApi'
import type { CardResponse } from '../types/api'

/**
 * アーカイブ画面（要件定義 docs/requirements/03-screens.md 6章の⑥）。
 * アーカイブ済みカード（{@code GET /api/cards?archived=true}）だけを一覧表示し、
 * 各行の「復元」から元のボード・元のステータス列へ戻せる（要件5.7）。
 *
 * ボード詳細・横断ビューのような3列のカンバン表示ではなく、SearchView.tsxと同じ
 * フラットな縦一覧にしている。アーカイブ済みカードにとって重要なのは「どの列にいたか」
 * より「元はどのボードのものか」であり、各行にそれを明示すれば足りるため
 * （components/ArchivedCardItem.tsx参照）。
 */
function ArchiveView() {
  const { data: cards, loading, error, refetch } = useApi<CardResponse[]>(
    apiPaths.cards({ archived: true }),
  )
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null)

  function renderContent() {
    if (loading) return <StatusMessage kind="loading">読み込み中…</StatusMessage>
    if (error !== null) {
      return <StatusMessage kind="error">読み込みに失敗しました：{error.message}</StatusMessage>
    }
    if (cards === null) return null
    if (cards.length === 0) {
      return <StatusMessage kind="empty">アーカイブ済みのカードはありません。</StatusMessage>
    }

    return (
      <div className="flex flex-col gap-2">
        {cards.map((card) => (
          <ArchivedCardItem
            key={card.id}
            card={card}
            onSelect={(cardId) => setSelectedCardId(cardId)}
            onRestored={refetch}
          />
        ))}
      </div>
    )
  }

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">📥 アーカイブ</h2>

      {renderContent()}

      {/* 復元後もモーダルはCardDetailModal自身がonClose()を呼んで閉じる
          （アーカイブから外れたカードの詳細をこの画面上で開いたままにしないため）。
          refetchはonUpdatedとして渡し、モーダル内の編集操作にもこの一覧を追従させる。 */}
      <CardDetailModal cardId={selectedCardId} onUpdated={refetch} onClose={() => setSelectedCardId(null)} />
    </section>
  )
}

export default ArchiveView
