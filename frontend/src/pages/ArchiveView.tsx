import { useState } from 'react'
import { useNavigate } from 'react-router'
import { apiPaths } from '../api/client'
import ArchivedCardItem from '../components/ArchivedCardItem'
import CardDetailModal from '../components/CardDetailModal'
import StatusMessage from '../components/StatusMessage'
import SubpageHeader from '../components/SubpageHeader'
import { useApi } from '../hooks/useApi'
import type { CardResponse } from '../types/api'

type Props = {
  /** ヘッダーで選択中のボードに対応する一覧画面へのパス（App.tsx から渡される） */
  boardListPath: string
}

/**
 * アーカイブ画面（要件定義 docs/requirements/03-screens.md 6章の⑥）。
 * アーカイブ済みカード（{@code GET /api/cards?archived=true}）だけを一覧表示し、
 * 各行の「復元」から元のボード・元のステータス列へ戻せる（要件5.7）。
 *
 * ボード詳細・横断ビューのような3列のカンバン表示ではなく、SearchView.tsxと同じ
 * フラットな縦一覧にしている。アーカイブ済みカードにとって重要なのは「どの列にいたか」
 * より「元はどのボードのものか」であり、各行にそれを明示すれば足りるため
 * （components/ArchivedCardItem.tsx参照）。
 *
 * 「← 戻る」は、ヘッダーのボード選択（App.tsx が保持）に対応する一覧画面
 * （横断ビューまたはボード詳細）へ戻る。
 */
function ArchiveView({ boardListPath }: Props) {
  const navigate = useNavigate()

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
            // 完全削除の後もこの一覧を取り直すだけでよい。アーカイブ済みカードは横断ビュー・
            // ボード詳細・検索結果のいずれにも元から出ていない（どの画面もarchived=falseで
            // 取得している）ため、ボード削除のときのようなApp.tsx側の後始末（dataVersionを
            // 変えてページ全体を作り直す）は不要（components/ArchivedCardItem.tsxのonDeleted参照）。
            onDeleted={refetch}
          />
        ))}
      </div>
    )
  }

  return (
    <section>
      <SubpageHeader title="アーカイブ" onBack={() => navigate(boardListPath)} />

      {renderContent()}

      {/* 復元後もモーダルはCardDetailModal自身がonClose()を呼んで閉じる
          （アーカイブから外れたカードの詳細をこの画面上で開いたままにしないため）。
          refetchはonUpdatedとして渡し、モーダル内の編集操作にもこの一覧を追従させる。 */}
      <CardDetailModal cardId={selectedCardId} onUpdated={refetch} onClose={() => setSelectedCardId(null)} />
    </section>
  )
}

export default ArchiveView
