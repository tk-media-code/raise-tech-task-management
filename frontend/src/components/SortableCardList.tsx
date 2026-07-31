import type { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { CardResponse } from '../types/api'
import CardItem from './CardItem'

type Props = {
  /** このリストのドロップ先識別子（"ステータス:ボードID"）。hooks/useCardDragAndDrop.tsのcolumnIdで組み立てる */
  id: string
  cards: CardResponse[]
  onSelect: (cardId: number) => void
  onMoved: () => void
  /**
   * cardsが0件のときにドロップ領域の中へ表示するプレースホルダー（例:「カードはまだありません」）。
   * 省略時（undefined）は何も表示しない（横断ビューの各ボードセクションのように、
   * 0件のときは見出しの下に何も出さない画面もあるため）。
   */
  emptyHint?: ReactNode
}

/**
 * ドラッグ＆ドロップ対応の、1列（1ステータス×1ボード）ぶんのカード一覧（要件定義5.3）。
 * StatusColumnの中身（children）として置く。StatusColumn自身はドラッグ＆ドロップの仕組みを
 * 知らずに済むようにするため、dnd-kitのフック（useDroppable・SortableContext）はこちらに
 * 閉じ込めている（components/StatusColumn.tsxのdocblockにある「中身が何かを一切知らずに済む」
 * という関心の分離を保つため）。
 *
 * useDroppableとSortableContextを両方使うのは、dnd-kitの「複数コンテナsortable」の標準的な
 * 構成: useDroppableは「カードが1枚も無い列」「列内の最後のカードより下の余白」へ
 * ドロップされたケースを検出するための、列そのものを表すドロップ領域。SortableContextは
 * 「列内のカードどうしの並べ替え」を検出するための、カードID一覧の入れ物。
 *
 * 外枠の<div>にmin-h-8（最小の高さ）を必ず与えているのは、カードが1枚も無い列でも
 * ドロップ可能な領域として十分な大きさを保つため。高さ0の要素は、ドラッグ中の
 * 当たり判定（重なり検出）が実質的に機能せず、「空の列へドロップする」という
 * 操作自体が成立しなくなってしまう。
 */
function SortableCardList({ id, cards, onSelect, onMoved, emptyHint }: Props) {
  const { setNodeRef } = useDroppable({ id })

  return (
    <div ref={setNodeRef} className="flex min-h-8 flex-col gap-3">
      <SortableContext id={id} items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        {cards.length === 0 ? emptyHint : null}
        {cards.map((card) => (
          <CardItem key={card.id} card={card} onSelect={onSelect} onMoved={onMoved} />
        ))}
      </SortableContext>
    </div>
  )
}

export default SortableCardList
