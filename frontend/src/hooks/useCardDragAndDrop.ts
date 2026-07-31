import { useEffect, useState } from 'react'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
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
  handleDragEnd: (event: DragEndEvent) => void
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
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setOptimisticCards(null)
  }, [cards])

  // PointerSensorのactivationConstraint.distanceは、「8px動くまではドラッグ開始と
  // 見なさない」しきい値。これが無いと、カードをクリックしただけ（カード詳細を開く操作、
  // または「移動」セレクトを開く操作）がすべてドラッグ開始と誤認識され、CardItem側の
  // onClick・<select>のクリックが機能しなくなる。
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

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null)
    const { active, over } = event

    // overがnull（＝どのドロップ領域の外でも指を離した）場合、および元の位置に
    // そのままドロップした場合（over.idが自分自身）は何もしない。
    if (over === null || active.id === over.id) return

    const source = optimisticCards ?? cards ?? []
    const draggedCard = source.find((card) => card.id === active.id)
    if (draggedCard === undefined) return

    // over.idは「他のカードのID（数値）」か「列そのものの識別子（"status:boardId"の文字列）」の
    // どちらか。parseColumnIdが解釈できれば列自体（空の列・列内の余白）へのドロップ、
    // できなければカードのIDとして扱う。
    const overColumn = parseColumnId(String(over.id))
    const overCard = overColumn === null ? source.find((card) => card.id === over.id) : undefined
    const destination = overColumn ?? (overCard === undefined ? null : { status: overCard.status, boardId: overCard.boardId })
    if (destination === null) return

    // 横断ビューで別ボードのセクションへドロップした場合は何もしない
    // （カードを別ボードへ付け替える機能は要件のスコープ外。prototype/README.mdに、
    // 「横断ビュー内でカードを別ボードのセクションへドラッグしても移動しない仕様」と明記されている）。
    if (destination.boardId !== draggedCard.boardId) return

    // 移動先列に現在並んでいるカード（対象カード自身は除く）を表示順で抽出する。
    const destinationCards = source
      .filter((card) => card.boardId === destination.boardId && card.status === destination.status && card.id !== draggedCard.id)
      .sort((a, b) => a.position - b.position)

    // 挿入位置：over.idが列自体（空の列・列内の余白）なら末尾。カードの上にドロップした
    // 場合は「そのカードの手前」に挿入する（over先のカードの半分から上か下かは見ない、
    // 簡略化した割り切り。ドラッグ中に指を離した瞬間の見た目上の位置と多少ずれることは
    // あるが、要件5.3の「列内の並び順を保持する」自体は満たせる）。
    const insertIndex =
      overCard === undefined ? destinationCards.length : destinationCards.findIndex((card) => card.id === overCard.id)

    // --- 楽観的更新：ローカルの配列を並べ替えて即座に表示へ反映する ---
    const reorderedDestination = [...destinationCards]
    reorderedDestination.splice(insertIndex, 0, { ...draggedCard, status: destination.status })
    // reorderedDestinationは新しい表示順そのものなので、その並び順どおりにposition(1始まり)を
    // 割り当て直す。バックエンド（CardService.updateStatus）が行う再採番と同じ考え方を
    // フロント側で先取りして見せているだけで、実際の確定値は後続のrefetchで取り直す。
    const renumbered = reorderedDestination.map((card, index) => ({ ...card, position: index + 1 }))
    // 移動元・移動先どちらの列にも属さないカードはそのまま。移動元列（ドラッグしたカードが
    // 抜けた後の列）はここでは詰め直さない（バックエンドのupdateStatusが移動元列の position を
    // 詰め直さないのと同じ理由。表示上の並び順自体は崩れないため実害が無い）。
    const untouched = source.filter(
      (card) => card.id !== draggedCard.id && !(card.boardId === destination.boardId && card.status === destination.status),
    )
    setOptimisticCards([...untouched, ...renumbered])
    setError(null)

    try {
      await patchJson<CardStatusUpdateRequest, CardResponse>(apiPaths.updateCardStatus(draggedCard.id), {
        status: destination.status,
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

  return {
    cards: optimisticCards ?? cards ?? [],
    sensors,
    activeCard,
    handleDragStart,
    handleDragEnd,
    error,
  }
}
