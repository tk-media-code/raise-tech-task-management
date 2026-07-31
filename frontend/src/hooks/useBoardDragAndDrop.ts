import { useEffect, useState } from 'react'
import type { DragEndEvent, DragMoveEvent } from '@dnd-kit/core'
import { KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { apiPaths, ApiError, patchJson } from '../api/client'
import type { BoardPositionUpdateRequest, BoardResponse } from '../types/api'

/**
 * ボード一覧全体を表すドロップ領域のid。一覧が0件のときや、最後の行より下の余白へ
 * ドロップされたとき（＝「末尾へ挿入」）を検出するために使う。
 * hooks/useCardDragAndDrop.tsのcolumnId（"ステータス:ボードID"）に相当するものだが、
 * ボード管理モーダルには列が1本しか無く組み立てる必要が無いため、固定の文字列1つで足りる。
 * BoardManageModal.tsxがこのidで一覧全体を覆うuseDroppableを呼ぶ。
 */
export const BOARD_LIST_DROPPABLE_ID = 'board-list'

/** ドラッグ中のボード行を、一覧のどの位置へ挿入しようとしているかを表す */
type DropTarget = {
  /** 対象ボードを除いた並びにおける0始まりの挿入位置。APIのpositionにそのまま渡せる */
  insertIndex: number
  /** 挿入位置の直後に来るボードのID。末尾（または0件）への挿入ならnull */
  beforeBoardId: number | null
}

/** SortableBoardRow・BoardManageModalへ渡す、挿入位置の表示用データ */
export type BoardDropIndicator = {
  beforeBoardId: number | null
}

/** ▲/▼ボタンが表す移動方向 */
export type BoardMoveDirection = 'up' | 'down'

export type UseBoardDragAndDropResult = {
  /**
   * 表示に使うボード一覧。ドラッグ・▲▼ボタンの操作直後、サーバーへの反映（PATCH）とその後の
   * refetchが完了するまでの間は、ローカルで並べ替え済みの一覧を優先して返す（下記docblock参照）。
   */
  boards: BoardResponse[]
  sensors: ReturnType<typeof useSensors>
  /** ドラッグ中、ポインタ（および対象行）が動くたびに呼ばれる。挿入位置プレビューの更新に使う */
  handleDragMove: (event: DragMoveEvent) => void
  handleDragEnd: (event: DragEndEvent) => void
  /** ドラッグがキャンセルされた（Escapeキー等）ときに呼ばれる */
  handleDragCancel: () => void
  /** 挿入位置プレビュー。ドラッグ中でない、またはドロップ不可の場所の上にいる間はnull */
  dropIndicator: BoardDropIndicator | null
  /**
   * ▲/▼ボタンから呼ぶ、1つ上/下のボードとの入れ替え。
   * 先頭でのup・末尾でのdownはSortableBoardRow側でボタン自体をdisabledにして呼ばれないように
   * している（プロトタイプのmoveBoardUp/moveBoardDownの範囲チェックに相当）。
   */
  moveBoard: (boardId: number, direction: BoardMoveDirection) => Promise<void>
  /** 直近の並べ替えが失敗した場合のエラー */
  error: Error | null
}

/**
 * ボードの並べ替え（要件定義5.1：ボード管理モーダルでの`⠿`ドラッグ＋`▲`/`▼`ボタン）を扱うフック。
 * hooks/useCardDragAndDrop.tsをボード管理モーダル向けに単純化したもので、骨格
 * （sensors・楽観的更新・挿入位置プレビュー）は同じだが、カード版にあった以下の要素は
 * 「列が1本しか無い」ため不要になっている:
 * - columnId/parseColumnId（「ステータス×ボード」という列の識別子の組み立て）
 * - cardCollisionDetection（列のuseDroppableとカードのuseSortableが重なって誤判定する問題への対処）。
 *   代わりに呼び出し側（BoardManageModal.tsx）は dnd-kit 標準の closestCenter をそのまま使う。
 *
 * hooks/useApi.tsは「並び順の決定権はサーバーにあるので楽観的更新はしない」という方針を
 * 採っているが、ここではその方針の例外として、ドラッグ・▲▼操作の直後だけローカルで
 * 並べ替えた結果を先に見せる（楽観的更新）。指を離した／ボタンを押した場所に行が収まることが
 * 操作の結果そのものであり、PATCH＋refetchが終わるまでの間だけ元の位置に戻って見えてしまうと、
 * 操作が取り消されたかのように誤解を招くため（hooks/useCardDragAndDrop.tsと同じ理由）。
 *
 * @param boards  現在のボード一覧（GET /api/boards の結果。App.tsxからboards ?? []で渡される）
 * @param refetch 親のuseApiのrefetch。PATCH成功後、サーバー側の最終状態（position再採番の
 *                確定結果を含む）を取り直すために呼ぶ
 */
export function useBoardDragAndDrop(boards: BoardResponse[], refetch: () => void): UseBoardDragAndDropResult {
  // ドラッグ・▲▼操作の直後だけ使う、ローカルで並べ替え済みのボード一覧。
  // 親（useApi）のboardsが新しくなった＝refetchが完了した合図なので、下のuseEffectでnullに戻す
  // （以後はboards自体をそのまま表示に使う）。
  const [optimisticBoards, setOptimisticBoards] = useState<BoardResponse[] | null>(null)
  // ドラッグ中の挿入位置プレビュー。handleDragMoveで更新し、handleDragEnd・handleDragCancelでクリアする。
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setOptimisticBoards(null)
  }, [boards])

  // 各設定値の意味はhooks/useCardDragAndDrop.tsのsensorsと同じ。8pxのdistanceが、行のクリック操作
  // （改名・削除・▲▼ボタン）と`⠿`からのドラッグ開始を区別する。TouchSensorのdelay/toleranceは
  // スマートフォンでのスクロール操作をドラッグ開始と誤認識しないための猶予。
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const source = optimisticBoards ?? boards

  /**
   * ドラッグ中のイベントから、挿入先の位置を求める。hooks/useCardDragAndDrop.tsのresolveDropTargetと
   * 同じく、ドラッグ中の見た目（プレビューのライン）と指を離した瞬間の確定処理の両方がこの関数を
   * 呼ぶことで、「ラインが示していた場所」と「実際にカードが収まる場所」を必ず一致させる。
   * カード版と違い「どの列か」を判定する必要が無い分だけ単純になっている。
   */
  function resolveDropTarget(event: DragMoveEvent): DropTarget | null {
    const { active, over } = event
    if (over === null || active.id === over.id) return null

    // 自分自身を除いた並び。この並びの中での位置を基準にinsertIndexを決める
    // （hooks/useCardDragAndDrop.tsのgetDestinationCardsと同じ考え方）。
    const others = source.filter((board) => board.id !== active.id)

    let insertIndex: number
    if (over.id === BOARD_LIST_DROPPABLE_ID) {
      // 一覧そのもの（最後の行より下の余白）へのドロップは常に末尾。
      insertIndex = others.length
    } else {
      const overIndex = others.findIndex((board) => board.id === over.id)
      if (overIndex === -1) return null
      // ドラッグ中の行の実測rect（activeのtranslated＝初期位置+移動量）の中心が、重なった相手の行の
      // 中心より下にあるかどうかで「相手の手前」か「相手の後ろ」かを決める
      // （hooks/useCardDragAndDrop.tsのresolveDropTargetと同じ判定方法）。
      const activeRect = active.rect.current.translated
      const isAfter =
        activeRect !== null && activeRect.top + activeRect.height / 2 > over.rect.top + over.rect.height / 2
      insertIndex = isAfter ? overIndex + 1 : overIndex
    }

    const beforeBoardId = insertIndex < others.length ? others[insertIndex].id : null
    return { insertIndex, beforeBoardId }
  }

  function handleDragMove(event: DragMoveEvent) {
    const next = resolveDropTarget(event)
    // 同じ挿入位置の間は同じstateの参照を返し、高頻度に呼ばれるonDragMoveでの無駄な再レンダリングを
    // 防ぐ（hooks/useCardDragAndDrop.tsのhandleDragMoveと同じ理由）。
    setDropTarget((prev) => {
      if (prev === null && next === null) return prev
      if (prev !== null && next !== null && prev.insertIndex === next.insertIndex) return prev
      return next
    })
  }

  /**
   * 挿入位置を確定し、楽観的更新＋PATCH送信を行う共通処理。ドラッグ確定（handleDragEnd）・
   * ▲▼ボタン（moveBoard）の両方がここへ委譲する。プロトタイプはドラッグ（全体の振り直し）と
   * ▲▼ボタン（2件のposition交換）で別々のロジックを持っていたが、こちらはCardService.updateStatusと
   * 同じ「取り出す→挿し込む→振り直す」処理1つに両方の操作を委ねている。
   *
   * @param boardId     移動対象のボードID
   * @param insertIndex 対象を除いた並びにおける0始まりの挿入位置（範囲外は先頭/末尾へ丸める）
   */
  async function commitReorder(boardId: number, insertIndex: number): Promise<void> {
    const draggedBoard = source.find((board) => board.id === boardId)
    if (draggedBoard === undefined) return

    const others = source.filter((board) => board.id !== boardId)
    const clampedIndex = Math.min(Math.max(insertIndex, 0), others.length)

    // --- 楽観的更新：ローカルの配列を並べ替えて即座に表示へ反映する ---
    const reordered = [...others]
    reordered.splice(clampedIndex, 0, draggedBoard)
    // バックエンド（BoardService.updatePosition）が行う再採番と同じ考え方をフロント側で
    // 先取りして見せているだけで、実際の確定値は後続のrefetchで取り直す。
    const renumbered = reordered.map((board, index) => ({ ...board, position: index + 1 }))
    setOptimisticBoards(renumbered)
    setError(null)

    try {
      await patchJson<BoardPositionUpdateRequest, BoardResponse>(apiPaths.updateBoardPosition(boardId), {
        position: clampedIndex,
      })
      // 成功時はサーバー側の最終状態（position再採番の確定結果）を取り直す。optimisticBoardsの
      // クリアはここでは行わず、上のuseEffectがboards（refetch結果）の到着を検知してから行う
      // （それまでは楽観的な表示を維持する）。
      refetch()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new Error(String(cause)))
      // 失敗時はrefetchを呼ばない（サーバー側は何も変わっていないため）ので、上のuseEffectに
      // 頼らずここで直接、楽観的な表示を取り消す。
      setOptimisticBoards(null)
    }
  }

  async function handleDragEnd(event: DragEndEvent): Promise<void> {
    // ドラッグ中に表示していたインジケーターと同じ計算結果を使うことで、ラインが示していた
    // 位置と実際の着地点を一致させる（dropTargetがまだ無い場合に備え、改めてresolveDropTargetを呼ぶ）。
    const target = dropTarget ?? resolveDropTarget(event)
    setDropTarget(null)
    if (target === null) return

    const draggedBoard = source.find((board) => board.id === event.active.id)
    if (draggedBoard === undefined) return

    await commitReorder(draggedBoard.id, target.insertIndex)
  }

  // dnd-kitはEscapeキー等でドラッグが中断されたとき、onDragEndではなくonDragCancelを呼ぶ
  // （hooks/useCardDragAndDrop.tsのhandleDragCancelと同じ理由）。
  function handleDragCancel(): void {
    setDropTarget(null)
  }

  /**
   * ▲/▼ボタンから呼ぶ、1つ上/下のボードとの入れ替え。
   * 表示順（0始まり）でindex番目の行を、上へならindex-1、下へならindex+1の挿入位置へ
   * 動かすと、ちょうど隣のボードと入れ替わる（commitReorderのinsertIndexは「対象を除いた並び」
   * における位置なので、この±1がそのまま「隣の行の元の位置」に一致する）。
   */
  async function moveBoard(boardId: number, direction: BoardMoveDirection): Promise<void> {
    const index = source.findIndex((board) => board.id === boardId)
    if (index === -1) return
    const insertIndex = direction === 'up' ? index - 1 : index + 1
    await commitReorder(boardId, insertIndex)
  }

  const dropIndicator: BoardDropIndicator | null =
    dropTarget === null ? null : { beforeBoardId: dropTarget.beforeBoardId }

  return {
    boards: source,
    sensors,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
    dropIndicator,
    moveBoard,
    error,
  }
}
