import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { CollisionDetection, DragEndEvent } from '@dnd-kit/core'
import { closestCenter, DndContext, useDroppable } from '@dnd-kit/core'
import type { SortingStrategy } from '@dnd-kit/sortable'
import { SortableContext } from '@dnd-kit/sortable'
import { apiPaths } from '../api/client'
import { BOARD_LIST_DROPPABLE_ID, useBoardDragAndDrop } from '../hooks/useBoardDragAndDrop'
import { useMutation } from '../hooks/useMutation'
import type { BoardCreateRequest, BoardResponse } from '../types/api'
import SortableBoardRow from './SortableBoardRow'
import StatusMessage from './StatusMessage'

type Props = {
  /** モーダルが開いているか。falseのときは何も描画しない（CardDetailModal.tsxのcardId===nullと同じ考え方） */
  open: boolean
  /** 表示するボード一覧（App.tsxがGET /api/boardsで取得したものをそのまま渡す） */
  boards: BoardResponse[]
  /**
   * 新規作成・改名・並べ替えが成功したとき（ヘッダーのセレクトボックス・このモーダル自身の
   * 一覧を更新するため）に呼ばれる。以前は`onCreated`という名前だったが、改名・並べ替えも
   * 同じ「ボード一覧を再取得する」処理を必要とするようになったため、実態に合わせて改名した。
   */
  onChanged: () => void
  /**
   * 削除が成功したとき。単なる再取得だけでは済まないため（削除したボードを表示中だった場合の
   * 画面遷移、他画面のカード一覧の最新化）、onChangedとは別のコールバックにしている
   * （詳しくはApp.tsxのhandleBoardDeleted参照）。
   */
  onDeleted: (boardId: number) => void
  /** モーダルを閉じるとき（× ／背景クリック／Escape）に呼ばれる */
  onClose: () => void
}

/**
 * ボード一覧のドラッグ中、他の行を動かさない（要件定義5.3のカード列と同じ理由。
 * components/SortableCardList.tsxのnoSortingと同じ技法をボード一覧にも適用したもの）。
 * dnd-kit標準のverticalListSortingStrategyは同一列内で他の行をCSS transformでずらす仕組みだが、
 * ここでは代わりにSortableBoardRowの挿入ライン（showDropLine）だけで挿入位置を示すため、
 * 「常に動かさない」を返すこの関数に差し替える。
 */
const noSorting: SortingStrategy = () => null

/**
 * ボード一覧全体のドロップ判定。列が1本しかないボード管理では、カード側のような
 * 「列のuseDroppableとカードのuseSortableが重なって列自体にヒットしてしまう」問題が
 * そもそも起きないため、hooks/useCardDragAndDrop.tsのcardCollisionDetectionのような
 * 自前の判定は不要で、dnd-kit標準のclosestCenterをそのまま使えばよい。
 */
const boardCollisionDetection: CollisionDetection = closestCenter

/**
 * ボード管理モーダル（要件定義 6.2 ②）。ヘッダーの `⚙` から開く。
 * ボードの新規作成・名称変更・削除・並べ替え、すべてこのモーダルの中で行う。
 *
 * 構造・開閉の作法はCardDetailModal.tsxを踏襲している
 * （フックは早期returnより前にすべて呼ぶ・背景クリック判定・Escapeキー処理など）。
 */
function BoardManageModal({ open, boards, onChanged, onDeleted, onClose }: Props) {
  const [name, setName] = useState('')
  const { mutate: create, submitting, error } = useMutation<BoardCreateRequest, BoardResponse>(
    'POST',
    apiPaths.createBoard(),
  )

  // 現在改名編集中のボードID。同時に2行が編集状態にならないよう、このモーダルが1つだけ持つ
  // （プロトタイプのui.renamingBoardIdと同じ）。SortableBoardRow側ではなくここに置いているのは、
  // 下のEscapeハンドラが「モーダルを閉じる」か「編集をキャンセルする」かを分岐する必要があり、
  // その判断材料（今どの行を編集中か）を親が握っておく必要があるため。
  const [renamingBoardId, setRenamingBoardId] = useState<number | null>(null)

  // ボード一覧全体をドロップ領域として登録する。空の一覧・最後の行より下の余白へのドロップ
  // （＝末尾への挿入）を検出するため（components/SortableCardList.tsxのuseDroppableと同じ役割）。
  const { setNodeRef: setListNodeRef } = useDroppable({ id: BOARD_LIST_DROPPABLE_ID })

  const dragAndDrop = useBoardDragAndDrop(boards, onChanged)
  // 一覧そのものへの挿入（末尾）を示すインジケーター。beforeBoardId===nullのときは
  // 個々の行ではなく一覧全体（下のulの外枠）に破線の枠で示す
  // （components/SortableCardList.tsxのshowEmptyIndicatorと同じ考え方）。
  const showEndIndicator = dragAndDrop.dropIndicator !== null && dragAndDrop.dropIndicator.beforeBoardId === null

  // モーダルを開いた直後にボード名入力欄へフォーカスを当てる（CardCreateForm.tsxと同じ理由）。
  const nameInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) {
      nameInputRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      // 改名編集中のEscapeは「モーダルを閉じる」ではなく「編集をキャンセルする」を優先する。
      // SortableBoardRow側で個別にstopPropagationするのではなく、ここで一元的に分岐している
      // 理由はrenamingBoardIdのコメント参照。
      if (renamingBoardId !== null) {
        setRenamingBoardId(null)
      } else {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose, renamingBoardId])

  // 全hooks呼び出しの後に置く早期return（フックのルール。CardDetailModal.tsxと同じ理由）。
  if (!open) return null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const created = await create({ name: name.trim() })
    if (created === null) return

    // モーダルは開いたままにする（ボード管理はカード作成と違い、続けて何件も
    // 作成する使い方が自然なため。CardCreateFormは1件ごとに折りたたむ設計だが、
    // こちらは常に開いているリスト画面なので、閉じずに入力欄だけ空にする）。
    setName('')
    onChanged()
  }

  function handleDragEnd(event: DragEndEvent) {
    void dragAndDrop.handleDragEnd(event)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="ボード管理"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 className="text-base font-bold">ボード管理</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded px-2 text-lg leading-none text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </header>

        <div className="space-y-3 p-4 text-sm">
          <DndContext
            sensors={dragAndDrop.sensors}
            collisionDetection={boardCollisionDetection}
            onDragMove={dragAndDrop.handleDragMove}
            onDragEnd={handleDragEnd}
            onDragCancel={dragAndDrop.handleDragCancel}
          >
            <ul
              ref={setListNodeRef}
              className={`space-y-2 rounded-lg ${showEndIndicator ? 'outline-2 -outline-offset-2 outline-dashed outline-blue-500' : ''}`}
            >
              <SortableContext items={dragAndDrop.boards.map((board) => board.id)} strategy={noSorting}>
                {dragAndDrop.boards.length === 0 && (
                  <li className="rounded border border-dashed border-slate-300 px-3 py-2 text-slate-400">
                    ボードがありません。下のフォームから追加してください。
                  </li>
                )}
                {dragAndDrop.boards.map((board, index) => (
                  <SortableBoardRow
                    key={board.id}
                    board={board}
                    isFirst={index === 0}
                    isLast={index === dragAndDrop.boards.length - 1}
                    isRenaming={renamingBoardId === board.id}
                    onStartRename={setRenamingBoardId}
                    onEndRename={() => setRenamingBoardId(null)}
                    onChanged={onChanged}
                    onDeleted={onDeleted}
                    onMove={dragAndDrop.moveBoard}
                    showDropLine={dragAndDrop.dropIndicator?.beforeBoardId === board.id}
                  />
                ))}
              </SortableContext>
            </ul>
          </DndContext>
          {dragAndDrop.error !== null && (
            <StatusMessage kind="error">ボードの並べ替えに失敗しました：{dragAndDrop.error.message}</StatusMessage>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="新しいボード名"
              aria-label="新しいボード名"
              maxLength={50}
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={name.trim() === '' || submitting}
              title={name.trim() === '' ? 'ボード名を入力してください' : undefined}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              ＋ 追加
            </button>
          </form>

          {error !== null && <StatusMessage kind="error">{error.message}</StatusMessage>}
        </div>
      </div>
    </div>
  )
}

export default BoardManageModal
