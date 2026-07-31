import { useEffect, useState } from 'react'
import type { CollisionDetection, DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import { closestCenter, KeyboardSensor, pointerWithin, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { apiPaths, ApiError, patchJson } from '../api/client'
import { isCardStatus } from '../lib/status'
import type { CardResponse, CardStatus, CardStatusUpdateRequest } from '../types/api'

/**
 * ドロップ先の列を表す識別子（"ステータス:ボードID"）を組み立てる。
 * 横断ビュー（ステータスごとにボード別セクションがある）・ボード詳細（ボードは常に1つ）の
 * どちらも「ステータス×ボード」という同じ粒度の列を持つため、この形式1つで両画面をまかなえる。
 */
export function columnId(status: CardStatus, boardId: number): string {
  return `${status}:${boardId}`
}

/** columnIdの逆変換。カードのID（sortable id）が渡された場合はnullを返す（下記参照） */
function parseColumnId(id: string): { status: CardStatus; boardId: number } | null {
  const [status, boardIdRaw] = id.split(':')
  const boardId = Number(boardIdRaw)
  // カードのsortable idは単なる数値（例:"123"）で、":"を含まずboardIdRaw部分がundefinedになる。
  // その場合isCardStatus("123")がfalse、または後段のNumber(undefined)がNaNになるため、
  // どちらのガードでも確実にnullへ倒れる（＝「これは列IDではなくカードIDだ」と判定できる）。
  if (!isCardStatus(status) || Number.isNaN(boardId)) return null
  return { status, boardId }
}

/**
 * カード列（「ステータス×ボード」の1列）の中で、対象カードを除いた表示順を返す。
 * ドラッグ中の挿入位置プレビュー（resolveDropTarget）と、確定時の並べ替え（handleDragEnd）の
 * 両方が同じ並びを基準にする必要があるため、共通のヘルパーとして切り出している。
 */
function getDestinationCards(
  source: CardResponse[],
  boardId: number,
  status: CardStatus,
  excludeCardId: number,
): CardResponse[] {
  return source
    .filter((card) => card.boardId === boardId && card.status === status && card.id !== excludeCardId)
    .sort((a, b) => a.position - b.position)
}

/**
 * dnd-kitの衝突判定（collisionDetection）。標準の`closestCenter`は「全ドロップ領域の中心との
 * 距離」で判定するため、列全体を覆う`useDroppable`（SortableCardList）の中心の方が個々のカードの
 * 中心より近くなる場面があり、カードとカードの間にポインタがあっても「列そのものへのドロップ
 * （＝末尾）」と判定されてしまう。これがドラッグ＆ドロップの挿入位置を分かりづらくしていた原因の
 * 一つ。プロトタイプ（prototype/app.js）が`e.target.closest('.card-list')`でポインタの真下の要素を
 * 直接見ているのと同じ考え方で、まず`pointerWithin`（ポインタが実際に重なっている領域）を優先し、
 * 見つからないとき（キーボード操作でポインタ座標が無い場合等）だけ`closestCenter`にフォールバックする。
 */
export const cardCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length > 0) {
    // カードは列のuseDroppableの内側にあるため、ポインタがカードの上にあると列・カード両方が
    // ヒットする。sortable idの型（カード＝number、列＝columnIdで組み立てたstring）で見分け、
    // より具体的なカード側を優先する。
    const overCard = pointerCollisions.find((collision) => typeof collision.id === 'number')
    return overCard === undefined ? pointerCollisions : [overCard]
  }
  return closestCenter(args)
}

/** ドラッグ中のカードを、どの列のどの位置へ挿入しようとしているかを表す */
type DropTarget = {
  status: CardStatus
  boardId: number
  /** 移動先列（対象カード自身を除く）における0始まりの挿入位置。APIのpositionにそのまま渡せる */
  insertIndex: number
  /** 挿入位置の直後に来るカードのID。末尾（または空の列）への挿入ならnull */
  beforeCardId: number | null
}

/**
 * ドラッグ中のイベント（DragMoveEvent・DragEndEvent。この2つはactive/over等まったく同じ形なので
 * DragMoveEventの型でまとめて受けられる）から、挿入先の列と位置を求める。ドラッグ中の見た目
 * （プレビューのライン）と指を離した瞬間の確定処理の両方がこの関数を呼ぶことで、「ラインが
 * 示していた場所」と「実際にカードが収まる場所」を必ず一致させる。
 */
function resolveDropTarget(event: DragMoveEvent, source: CardResponse[]): DropTarget | null {
  const { active, over } = event

  // overがnull（＝どのドロップ領域の外でも指を離した）場合、および元の位置に
  // そのままドロップした場合（over.idが自分自身）はインジケーターを出さない。
  if (over === null || active.id === over.id) return null

  const draggedCard = source.find((card) => card.id === active.id)
  if (draggedCard === undefined) return null

  // over.idは「他のカードのID（数値）」か「列そのものの識別子（"status:boardId"の文字列）」の
  // どちらか。parseColumnIdが解釈できれば列自体（空の列・列内の余白）へのドロップ、
  // できなければカードのIDとして扱う。
  const overColumn = parseColumnId(String(over.id))
  const overCard = overColumn === null ? source.find((card) => card.id === over.id) : undefined
  const destination = overColumn ?? (overCard === undefined ? null : { status: overCard.status, boardId: overCard.boardId })
  if (destination === null) return null

  // 横断ビューで別ボードのセクションへドロップした場合は何もしない（インジケーターも出さない）。
  // カードを別ボードへ付け替える機能は要件のスコープ外（prototype/README.md参照）。
  if (destination.boardId !== draggedCard.boardId) return null

  const destinationCards = getDestinationCards(source, destination.boardId, destination.status, draggedCard.id)

  let insertIndex: number
  if (overCard === undefined) {
    // 列自体（空の列・最後のカードより下の余白）へのドロップは常に末尾。
    insertIndex = destinationCards.length
  } else {
    const overIndex = destinationCards.findIndex((card) => card.id === overCard.id)
    // ドラッグ中カードの実測rect（activeのtranslated＝初期位置+移動量）の中心が、重なった
    // 相手カードの中心より下にあるかどうかで「相手の手前」か「相手の後ろ」かを決める。
    // プロトタイプのgetDragAfterElementがカーソルYと各カードの中心線を比較するのと同じ考え方を、
    // dnd-kitのイベントから直接取れる値（カーソル座標そのものはonDragMove/onDragEndの引数に
    // 含まれないため、代わりにドラッグ中カード自身の位置を使う）に置き換えたもの。
    const activeRect = active.rect.current.translated
    const isAfter = activeRect !== null && activeRect.top + activeRect.height / 2 > over.rect.top + over.rect.height / 2
    insertIndex = isAfter ? overIndex + 1 : overIndex
  }

  const beforeCardId = insertIndex < destinationCards.length ? destinationCards[insertIndex].id : null

  return { status: destination.status, boardId: destination.boardId, insertIndex, beforeCardId }
}

/** SortableCardList・CardItemへ渡す、挿入位置の表示用データ */
export type CardDropIndicator = {
  /** ラインを表示する列の識別子。SortableCardListのid（columnId()で組み立てたもの）と比較する */
  columnId: string
  /** この直前に挿入ラインを表示する。nullは列の末尾（または空の列）を意味する */
  beforeCardId: number | null
}

export type UseCardDragAndDropResult = {
  /**
   * 表示に使うカード一覧。ドラッグ直後、サーバーへの反映（PATCH）とその後のrefetchが
   * 完了するまでの間は、ローカルで並べ替え済みの一覧を優先して返す（下記docblock参照）。
   */
  cards: CardResponse[]
  sensors: ReturnType<typeof useSensors>
  /** 現在ドラッグ中のカード。<DragOverlay>に渡す。ドラッグ中でなければnull */
  activeCard: CardResponse | null
  handleDragStart: (event: DragStartEvent) => void
  /** ドラッグ中、ポインタ（および対象カード）が動くたびに呼ばれる。挿入位置プレビューの更新に使う */
  handleDragMove: (event: DragMoveEvent) => void
  handleDragEnd: (event: DragEndEvent) => void
  /** ドラッグがキャンセルされた（Escapeキー等）ときに呼ばれる */
  handleDragCancel: () => void
  /** 挿入位置プレビュー。ドラッグ中でない、またはドロップ不可の場所の上にいる間はnull */
  dropIndicator: CardDropIndicator | null
  /** 直近のステータス変更が失敗した場合のエラー */
  error: Error | null
}

/**
 * カードのドラッグ＆ドロップ（要件定義5.3：列間の移動＋列内の並べ替え）を、
 * ボード詳細画面・横断ビューの両方で共通利用するためのフック。
 *
 * hooks/useApi.tsは「並び順の決定権はサーバーにあるので楽観的更新はしない」という方針を
 * 採っていた（useApi.tsのrefetchのコメント参照）。ここではその方針の**例外**として、
 * ドラッグ操作の直後だけローカルで並べ替えた結果を先に見せる（楽観的更新）。
 * カード作成のような「新しい行が増えるだけ」の操作は反映が数百ミリ秒遅れても
 * 違和感が薄いが、ドラッグ＆ドロップは「指を離した場所にカードが収まる」ことが
 * 操作の結果そのものであり、PATCH＋refetchが終わるまでの間だけ元の位置に戻って
 * 見えてしまうと、操作が取り消されたかのように誤解を招く。この体感の差が
 * 例外を設ける理由になっている。
 *
 * @param cards   現在のカード一覧（GET /api/cards の結果。読み込み中はnull）
 * @param refetch 親のuseApiのrefetch。PATCH成功後、サーバー側の最終状態
 *                （position再採番の確定結果を含む）を取り直すために呼ぶ
 */
export function useCardDragAndDrop(cards: CardResponse[] | null, refetch: () => void): UseCardDragAndDropResult {
  // ドラッグ直後だけ使う、ローカルで並べ替え済みのカード一覧。
  // 親（useApi）のcardsが新しくなった＝refetchが完了した合図なので、下のuseEffectで
  // nullに戻す（以後はcards自体をそのまま表示に使う）。
  const [optimisticCards, setOptimisticCards] = useState<CardResponse[] | null>(null)
  const [activeCard, setActiveCard] = useState<CardResponse | null>(null)
  // ドラッグ中の挿入位置プレビュー。handleDragMoveで更新し、handleDragEnd・handleDragCancelで
  // クリアする（詳細はresolveDropTargetのdocblock参照）。
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setOptimisticCards(null)
  }, [cards])

  // PointerSensorのactivationConstraint.distanceは、「8px動くまではドラッグ開始と
  // 見なさない」しきい値。これが無いと、カードをクリックしただけ（カード詳細を開く操作、
  // またはスマートフォン幅（767px以下）で表示される「移動」セレクトを開く操作）がすべて
  // ドラッグ開始と誤認識され、CardItem側のonClick・<select>のクリックが機能しなくなる。
  // TouchSensorのdelay/toleranceは、指でスクロールしようとした操作をドラッグ開始と
  // 誤認識しないための猶予（要件5.3のタッチ対応・8.1参照）。delay(ms)だけ指を置いたままにし、
  // その間toleranceを超えて指が動いたら「スクロールの意図」と判断してドラッグを開始しない。
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  )

  function handleDragStart(event: DragStartEvent) {
    const source = optimisticCards ?? cards ?? []
    setActiveCard(source.find((card) => card.id === event.active.id) ?? null)
  }

  function handleDragMove(event: DragMoveEvent) {
    const source = optimisticCards ?? cards ?? []
    const next = resolveDropTarget(event, source)
    // 値が実質的に変わっていなければ同じstateの参照を返す。onDragMoveはポインタが動くたびに
    // 高頻度で呼ばれるため、これが無いと同じ挿入位置の間も毎回再レンダリングが走ってしまう。
    setDropTarget((prev) => {
      if (prev === null && next === null) return prev
      if (
        prev !== null &&
        next !== null &&
        prev.status === next.status &&
        prev.boardId === next.boardId &&
        prev.insertIndex === next.insertIndex
      ) {
        return prev
      }
      return next
    })
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null)
    const source = optimisticCards ?? cards ?? []
    // ドラッグ中に表示していたインジケーターと同じ計算結果を使うことで、ラインが示していた
    // 位置と実際の着地点を一致させる。dropTargetがまだ無い場合（onDragMoveが一度も発火しない
    // まま指を離した等）に備え、ここでも改めてresolveDropTargetを呼べるようにしておく。
    const destination = dropTarget ?? resolveDropTarget(event, source)
    setDropTarget(null)
    if (destination === null) return

    const draggedCard = source.find((card) => card.id === event.active.id)
    if (draggedCard === undefined) return

    const { status, boardId, insertIndex } = destination
    const destinationCards = getDestinationCards(source, boardId, status, draggedCard.id)

    // --- 楽観的更新：ローカルの配列を並べ替えて即座に表示へ反映する ---
    const reorderedDestination = [...destinationCards]
    reorderedDestination.splice(insertIndex, 0, { ...draggedCard, status })
    // reorderedDestinationは新しい表示順そのものなので、その並び順どおりにposition(1始まり)を
    // 割り当て直す。バックエンド（CardService.updateStatus）が行う再採番と同じ考え方を
    // フロント側で先取りして見せているだけで、実際の確定値は後続のrefetchで取り直す。
    const renumbered = reorderedDestination.map((card, index) => ({ ...card, position: index + 1 }))
    // 移動元・移動先どちらの列にも属さないカードはそのまま。移動元列（ドラッグしたカードが
    // 抜けた後の列）はここでは詰め直さない（バックエンドのupdateStatusが移動元列の position を
    // 詰め直さないのと同じ理由。表示上の並び順自体は崩れないため実害が無い）。
    const untouched = source.filter((card) => card.id !== draggedCard.id && !(card.boardId === boardId && card.status === status))
    setOptimisticCards([...untouched, ...renumbered])
    setError(null)

    try {
      await patchJson<CardStatusUpdateRequest, CardResponse>(apiPaths.updateCardStatus(draggedCard.id), {
        status,
        position: insertIndex,
      })
      // 成功時はサーバー側の最終状態（position再採番の確定結果を含む）を取り直す。
      // optimisticCardsのクリアはこの関数の中では行わず、上のuseEffectがcards（refetch結果）の
      // 到着を検知してから行う（それまでは楽観的な表示を維持する）。
      refetch()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new Error(String(cause)))
      // 失敗時はrefetchを呼ばない（サーバー側は何も変わっていないため）ので、
      // 上のuseEffectに頼らずここで直接、楽観的な表示を取り消す。
      setOptimisticCards(null)
    }
  }

  // dnd-kitはEscapeキー等でドラッグが中断されたとき、onDragEndではなくonDragCancelを呼ぶ。
  // これが無いとactiveCard・dropTargetが残ったままになり、キャンセルしたはずのドラッグの
  // 見た目（DragOverlay・挿入ライン）が消えなくなる。
  function handleDragCancel() {
    setActiveCard(null)
    setDropTarget(null)
  }

  const dropIndicator: CardDropIndicator | null =
    dropTarget === null
      ? null
      : { columnId: columnId(dropTarget.status, dropTarget.boardId), beforeCardId: dropTarget.beforeCardId }

  return {
    cards: optimisticCards ?? cards ?? [],
    sensors,
    activeCard,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
    dropIndicator,
    error,
  }
}
