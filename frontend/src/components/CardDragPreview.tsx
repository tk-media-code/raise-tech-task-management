import type { CardResponse } from '../types/api'
import DueDateBadge from './DueDateBadge'
import LabelChip from './LabelChip'

type Props = {
  card: CardResponse
}

/**
 * ドラッグ中、ポインタ（指）に追従して表示されるカードの見た目のコピー（{@code <DragOverlay>}の中身）。
 * CardItemと見た目をほぼ揃えているが、useSortableのバインディングを持たない「表示専用」の
 * コンポーネントである点が違う。
 *
 * CardItem自身をそのままDragOverlayに描画しない理由: そうすると同じsortable id（card.id）に対して
 * 「実際のリスト内の1枚（CardItemがuseSortableで登録するもの）」と「オーバーレイの1枚」という
 * 2つのuseSortableバインディングが同時に存在することになり、dnd-kit内部の状態管理と衝突する。
 * そのため見た目だけを複製した、この別コンポーネントに分離した。
 */
function CardDragPreview({ card }: Props) {
  return (
    <div className="w-full rounded-lg border border-slate-300 bg-white p-3 shadow-lg">
      <p className="text-sm font-medium text-slate-800">{card.title}</p>
      {(card.dueDate !== null || card.labels.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {card.dueDate !== null && <DueDateBadge dueDate={card.dueDate} />}
          {card.labels.map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
        </div>
      )}
    </div>
  )
}

export default CardDragPreview
