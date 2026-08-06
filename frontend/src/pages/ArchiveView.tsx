import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { apiPaths } from '../api/client'
import ArchivedCardItem from '../components/ArchivedCardItem'
import CardDetailModal from '../components/CardDetailModal'
import StatusMessage from '../components/StatusMessage'
import { useApi } from '../hooks/useApi'
import type { CardResponse } from '../types/api'

/** App.tsxの<Link to="/archive" state={...}>から渡される、遷移元のパス情報（pages/SearchView.tsxと同じ形） */
type ArchiveLocationState = {
  from?: string
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
 * 「← 戻る」もSearchView.tsxと同じ仕組み：開く直前の画面のパスをLinkのstateとして
 * 受け取り、そこへnavigateする。この画面は検索画面と違い、開いている間に自分自身の
 * URL（クエリパラメータ等）が変化することは無いため、SearchView.tsxのような
 * 「マウント時の1回だけ読み取ってローカルstateに固定する」工夫は不要で、
 * location.stateから毎回そのまま導出するだけで足りる。
 */
function ArchiveView() {
  const navigate = useNavigate()
  const location = useLocation()
  // state自体が無い（例：URLを直接開いた／リロードした）場合は、アプリの入口である
  // 横断ビューへ戻す（SearchView.tsxのfromPathと同じフォールバック）。
  const fromPath = (location.state as ArchiveLocationState | null)?.from ?? '/'

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
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(fromPath)}
          className="text-sm text-blue-600 hover:underline"
        >
          ← 戻る
        </button>
        <h2 className="text-lg font-semibold">📥 アーカイブ</h2>
      </div>

      {renderContent()}

      {/* 復元後もモーダルはCardDetailModal自身がonClose()を呼んで閉じる
          （アーカイブから外れたカードの詳細をこの画面上で開いたままにしないため）。
          refetchはonUpdatedとして渡し、モーダル内の編集操作にもこの一覧を追従させる。 */}
      <CardDetailModal cardId={selectedCardId} onUpdated={refetch} onClose={() => setSelectedCardId(null)} />
    </section>
  )
}

export default ArchiveView
