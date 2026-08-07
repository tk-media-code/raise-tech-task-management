import { STATUS_LABELS } from '../lib/status'
import type { CardResponse } from '../types/api'
import DueDateBadge from './DueDateBadge'
import LabelChip from './LabelChip'

type Props = {
  card: CardResponse
  /** 行がクリックされたとき（カード詳細モーダルを開くため）に呼ばれる */
  onSelect: (cardId: number) => void
}

/**
 * 検索結果の1行（要件定義 6.2 ⑤）。
 *
 * components/CardItem.tsxと役割は近いが、検索結果は横断ビュー・ボード詳細のように
 * 「どのボード・どの列を見ているか」という前後関係が無いため、行の中に
 * 「ボード名 / ステータス」を明示する点が異なる（CardItemはその文脈が既に外側の
 * 列・セクションで表現されているため省略している）。この差のためにコンポーネントを分けた。
 */
function SearchResultItem({ card, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(card.id)}
      // CardItem と同じホバー（背景・枠・影・指カーソル）で、クリックして詳細を開ける行だと分かるようにする。
      className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition-all duration-150 hover:border-slate-400 hover:bg-slate-50 hover:shadow-md"
    >
      <p className="text-sm font-medium text-slate-800">{card.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>
          {card.boardName} / {STATUS_LABELS[card.status]}
        </span>
        {card.dueDate !== null && <DueDateBadge dueDate={card.dueDate} />}
        {card.labels.map((label) => (
          <LabelChip key={label.id} label={label} />
        ))}
      </div>
    </button>
  )
}

export default SearchResultItem
