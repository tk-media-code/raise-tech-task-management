import { apiPaths } from '../api/client'
import { useMutation } from '../hooks/useMutation'
import { STATUS_LABELS } from '../lib/status'
import type { CardArchiveUpdateRequest, CardResponse } from '../types/api'
import DueDateBadge from './DueDateBadge'
import LabelChip from './LabelChip'
import StatusMessage from './StatusMessage'

type Props = {
  card: CardResponse
  /** 行がクリックされたとき（カード詳細モーダルを開くため）に呼ばれる */
  onSelect: (cardId: number) => void
  /** 「復元」に成功したとき（一覧の再取得を親に依頼するため）に呼ばれる */
  onRestored: () => void
}

/**
 * アーカイブ一覧の1行（要件定義 6.2 ⑥）。
 *
 * useMutationは呼び出された時点のpathを固定するフックのため、一覧全体で1つのmutateを
 * 使い回すと「どの行の『復元』を押しても同じcard.idへ送られる」事故になる。
 * components/CardItem.tsxの「移動」メニューと同じ理由で、行ごとにこのコンポーネントへ切り出し、
 * 各自が自分のcard.idに対するuseMutationを持つようにしている。
 */
function ArchivedCardItem({ card, onSelect, onRestored }: Props) {
  const { mutate: restore, submitting, error } = useMutation<CardArchiveUpdateRequest, CardResponse>(
    'PATCH',
    apiPaths.updateCardArchive(card.id),
  )

  async function handleRestore() {
    const updated = await restore({ archived: false })
    // restoreは失敗時にnullを返す（例外は投げない。hooks/useMutation.ts参照）。
    if (updated === null) return
    onRestored()
  }

  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <button type="button" onClick={() => onSelect(card.id)} className="block w-full text-left">
        <p className="text-sm font-medium text-slate-800">{card.title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {/* 元のボード・ステータスを明示する（SearchResultItem.tsxと同じ理由：この画面には
              「どの列を見ているか」という前後関係が無いため、行の中に文脈を書く必要がある）。
              ワイヤーフレーム6.2⑥の「元: 仕事」表記に合わせ、ステータスも併記する。 */}
          <span>
            元: {card.boardName} / {STATUS_LABELS[card.status]}
          </span>
          {card.dueDate !== null && <DueDateBadge dueDate={card.dueDate} />}
          {card.labels.map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
        </div>
      </button>

      <div className="mt-2 flex items-center justify-end gap-2">
        {/* 完全削除はDELETE系APIが未実装のため、BoardManageModal.tsxの改名・削除ボタンと同じ
            作法でdisabledのまま置いておく（押せるが何も起きないボタンより、無効だと分かる方が
            誤解が少ないという方針）。 */}
        <button
          type="button"
          disabled
          title="完全削除は次回対応します"
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-400"
        >
          完全削除
        </button>
        <button
          type="button"
          onClick={handleRestore}
          disabled={submitting}
          className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? '復元中…' : '復元'}
        </button>
      </div>
      {error !== null && <StatusMessage kind="error">{error.message}</StatusMessage>}
    </div>
  )
}

export default ArchivedCardItem
