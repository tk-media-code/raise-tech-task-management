import type { ChangeEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { apiPaths } from '../api/client'
import { useMutation } from '../hooks/useMutation'
import { isCardStatus, STATUSES, STATUS_LABELS } from '../lib/status'
import type { CardResponse, CardStatusUpdateRequest } from '../types/api'
import DueDateBadge from './DueDateBadge'
import LabelChip from './LabelChip'

type Props = {
  card: CardResponse
  /** カードがクリックされたとき（カード詳細モーダルを開くため）に呼ばれる */
  onSelect: (cardId: number) => void
  /** 「移動」メニューでステータス変更に成功したとき（一覧の再取得を親に依頼するため）に呼ばれる */
  onMoved: () => void
  /** ドラッグ中、このカードの直前に挿入されようとしているときtrue（SortableCardList参照） */
  showDropLine: boolean
}

/**
 * カンバンの列に並ぶカード1枚（要件定義 6.2 ①）。
 *
 * カード本体のクリック領域（タイトル・期日・ラベル）と、末尾の「移動」メニューという
 * 2つの独立した操作を持つため、外枠は<div>にし、クリック領域だけを内側の<button>にしている
 * （<button>は入れ子にできないため、外枠ごと<button>だったこれまでの実装からは変更が必要になった）。
 * クリック領域を<div onClick>ではなく<button>にしているのは、キーボードだけでも
 * （Tabで移動してEnter/Spaceで選択）操作できるようにするため。
 *
 * useSortable（要件5.3のドラッグ＆ドロップ）は外枠の<div>に直接適用している。専用の
 * 「つまみ」（ドラッグハンドル）を別に設けず、カード全体をドラッグ開始点にできるのは、
 * hooks/useCardDragAndDrop.tsのPointerSensorに設定したactivationConstraint.distanceにより、
 * 「8pxを超えて動くまではドラッグ開始と見なさない」しきい値を設けているため。これにより、
 * 動かさない単純なクリック（下のonClick・<select>の操作）はドラッグに奪われず、
 * そのまま通常のクリック・選択として扱われる。
 * このコンポーネントはCardItem自身をsortableのidに使うが、これがBoardDetailView・
 * CrossBoardViewの両方でしか使われていない（検索結果はSearchResultItemという別コンポーネント）
 * ことを前提にしている。
 */
function CardItem({ card, onSelect, onMoved, showDropLine }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })

  // ステータス変更（要件5.3）。ドラッグ＆ドロップが主な操作導線だが、要件5.3は
  // 「スマートフォン・タブレット表示では、ドラッグ＆ドロップに加え…明示的な操作手段を提供する」
  // としている。プロトタイプ（prototype/styles.css の.card-move-btn）に合わせ、PC幅では
  // 出さずスマートフォン幅（768px未満）限定で表示する（下のclassNameのmd:hidden参照）。
  // PCでの代替手段は、ドラッグ＆ドロップに加えてカード詳細モーダルの「ステータス」欄がある。
  const { mutate: changeStatus, submitting } = useMutation<CardStatusUpdateRequest, CardResponse>(
    'PATCH',
    apiPaths.updateCardStatus(card.id),
  )

  // 移動先の選択肢は「今のステータス以外」の2つ。自分自身への移動は意味が無いため除外する。
  const destinations = STATUSES.filter((status) => status !== card.status)

  async function handleMove(event: ChangeEvent<HTMLSelectElement>) {
    const nextStatus = event.target.value
    // プレースホルダー（value=""）が選択されることは無い（disabledのため）が、
    // <select>の値は実行時にはただの文字列であり、TypeScript上はCardStatusと確定できないため
    // 型ガードを通す（lib/status.tsのisCardStatus参照）。
    if (!isCardStatus(nextStatus)) return

    const updated = await changeStatus({ status: nextStatus })
    // changeStatusは失敗時にnullを返す（例外は投げない。hooks/useMutation.ts参照）。
    if (updated === null) return
    onMoved()
  }

  return (
    <div
      ref={setNodeRef}
      // transformはドラッグ中の移動量、transitionはドロップ後に本来の位置へ滑らかに
      // 収まるアニメーション。CSS.Transform.toString はdnd-kitのtransform（x/y/scaleの
      // オブジェクト）をCSSのtransformプロパティ文字列（例:"translate3d(10px, 0px, 0)"）へ
      // 変換するヘルパー。
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      // ドラッグ中の元位置は半透明にする（実際に指に追従する見た目はCardDragPreview＝
      // <DragOverlay>が担うため、元の位置は「ここから動かしている最中」と分かる程度の
      // 表示で十分）。relativeは、下の挿入ライン（absolute配置）の基準位置にするため。
      className={`relative w-full rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow ${isDragging ? 'opacity-40' : ''}`}
    >
      {showDropLine && (
        // ドラッグ中、このカードの直前に挿入されようとしていることを示すライン。
        // absolute配置（inset-x-0 -top-2）にしているのは、カードの高さ自体は変えず、
        // 親のgap-3（12px）の中央あたりに重ねて表示するため。カードの高さが変わると
        // dnd-kitが実測しているrect（resolveDropTargetの判定に使う）とずれてしまう。
        <div
          className="pointer-events-none absolute inset-x-0 -top-2 z-10 h-1 rounded-full bg-blue-500"
          aria-hidden="true"
        />
      )}
      <button
        type="button"
        onClick={() => onSelect(card.id)}
        className="block w-full text-left"
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

      {/* 「移動」メニュー（要件5.3、ワイヤーフレーム6.2①の[移動 ▾]）。
          カスタムのドロップダウンではなくネイティブの<select>を使うのは、開閉状態・
          外側クリックでの閉じる処理・キーボード操作といった作り込みが一切不要になるうえ、
          スマートフォン・タブレットでもOS標準のピッカーUIで操作でき、要件が挙げる
          「長押しドラッグの分かりづらさ」「ドラッグ距離が長くなる操作しづらさ」への
          対策として過不足が無いため。
          value=""を常に指定し、選択後の値をstateに反映しない「使い切りの操作メニュー」
          にしている。ステータス変更が成功するとこのカード自体が元の列から消える
          （親のgroupingで別の列に移る）ため、選択後の表示を気にする必要が無い。
          md:hiddenは、Tailwindのレスポンシブ修飾子（768px以上を"md"として扱う）で
          PC幅を非表示にする指定。768px未満（プロトタイプのブレークポイントと同じ）だけ表示する。 */}
      <select
        value=""
        onChange={handleMove}
        disabled={submitting}
        aria-label={`「${card.title}」の移動先`}
        className="mt-2 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500 disabled:opacity-50 md:hidden"
      >
        <option value="" disabled>
          移動 ▾
        </option>
        {destinations.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}へ移動
          </option>
        ))}
      </select>
    </div>
  )
}

export default CardItem
