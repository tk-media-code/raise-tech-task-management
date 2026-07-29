import type { CardResponse } from '../types/api'
import DueDateBadge from './DueDateBadge'
import LabelChip from './LabelChip'

type Props = {
  card: CardResponse
  /** カードがクリックされたとき（カード詳細モーダルを開くため）に呼ばれる */
  onSelect: (cardId: number) => void
}

/**
 * カンバンの列に並ぶカード1枚（要件定義 6.2 ①）。
 *
 * <div onClick> ではなく <button> で実装しているのは、キーボードだけでも
 * （Tabで移動してEnter/Spaceで選択）操作できるようにするため。
 * <div> にonClickを付けただけではキーボードフォーカスが当たらず、
 * マウス操作前提のUIになってしまう。
 */
function CardItem({ card, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(card.id)}
      className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-slate-300 hover:shadow"
    >
      <p className="text-sm font-medium text-slate-800">{card.title}</p>

      {/* 期日・ラベルのどちらも無いカードでは、この行自体を描画する必要がない。
          `card.dueDate !== null || card.labels.length > 0` を先に判定してもよいが、
          ここでは2つのフラグメントをそれぞれ独立して出し分ける方が単純なため、
          個別に条件分岐している。 */}
      {(card.dueDate !== null || card.labels.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {/* card.dueDateがnullでないことを確認してからDueDateBadgeに渡す。
              DueDateBadgeのProps型はdueDate: string（null不可）なので、
              ここでnullを弾いておかないとコンパイルが通らない
              （strictモードだからこそ、この見落としを防いでくれる）。 */}
          {card.dueDate !== null && <DueDateBadge dueDate={card.dueDate} />}
          {card.labels.map((label) => (
            // keyは配列描画のたびにReactが「どの要素がどのDOMに対応するか」を
            // 判断するための目印。indexではなくlabel.id（中身が変わっても
            // ぶれないID）を使うのが鉄則（BoardSelectの<option>と同じ理由）。
            <LabelChip key={label.id} label={label} />
          ))}
        </div>
      )}
    </button>
  )
}

export default CardItem
