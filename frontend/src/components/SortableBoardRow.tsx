import type { ChangeEvent, KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { apiPaths, fetchJson } from '../api/client'
import type { BoardMoveDirection } from '../hooks/useBoardDragAndDrop'
import { useDelete } from '../hooks/useDelete'
import { useMutation } from '../hooks/useMutation'
import type { BoardResponse, BoardUpdateRequest, CardResponse } from '../types/api'

type Props = {
  board: BoardResponse
  /** 一覧の先頭かどうか。`▲`ボタンをdisabledにするために使う */
  isFirst: boolean
  /** 一覧の末尾かどうか。`▼`ボタンをdisabledにするために使う */
  isLast: boolean
  /** このボードが改名編集中かどうか（同時に編集できるのは1件だけ。BoardManageModalが管理するstate） */
  isRenaming: boolean
  /** 「改名」ボタンが押されたとき（親のrenamingBoardIdをこのボードのIDにする） */
  onStartRename: (boardId: number) => void
  /** 改名を確定・キャンセルしたとき（親のrenamingBoardIdをnullに戻す） */
  onEndRename: () => void
  /** 改名・並べ替えが成功したとき（親のボード一覧を再取得させる） */
  onChanged: () => void
  /**
   * 削除が成功したとき。単なる再取得だけでは済まず、いま削除したボードの詳細画面を
   * 見ていた場合の遷移や、他画面のカード一覧の最新化もApp.tsx側で行うため、
   * onChangedとは別の専用コールバックにしている（詳しくはApp.tsxのhandleBoardDeleted参照）。
   */
  onDeleted: (boardId: number) => void
  /** ▲/▼ボタンが押されたとき */
  onMove: (boardId: number, direction: BoardMoveDirection) => Promise<void>
  /** ドラッグ中、このボードの直前に挿入されようとしているときtrue（BoardManageModal参照） */
  showDropLine: boolean
}

/**
 * ボード管理モーダルの1行（要件定義 6.2 ②）。components/CardItem.tsxのボード版にあたる。
 *
 * CardItem.tsxと違い、`⠿`という専用のドラッグハンドルを持つ点が最大の違い。カードは
 * 「行全体がクリック＝詳細を開く」の1操作だけだったため、8pxのactivationConstraintで
 * クリックとドラッグを区別すれば行全体をドラッグ開始点にできたが、この行には
 * `▲▼`・`改名`・`削除`という複数の独立したクリック領域が同居しており、行全体を
 * ドラッグ開始点にするとそれらのクリックがドラッグに奪われかねない。そのため
 * useSortableの`setNodeRef`（位置・transformの適用対象）と`setActivatorNodeRef`
 * （実際にドラッグ操作のリスナーを貼る対象）をあえて別のDOM要素に分け、
 * 後者は`⠿`のボタンだけに絞っている（要件定義03-screens.md「`⠿` … ドラッグで並べ替え」にも忠実）。
 */
function SortableBoardRow({
  board,
  isFirst,
  isLast,
  isRenaming,
  onStartRename,
  onEndRename,
  onChanged,
  onDeleted,
  onMove,
  showDropLine,
}: Props) {
  // disabled: isRenamingは、改名中の行をドラッグ操作・他行のドロップ先の両方から除外する
  // （プロトタイプの編集中<li>にdraggable属性が付かないのと同じ効果）。
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: board.id,
    disabled: isRenaming,
  })

  const [draftName, setDraftName] = useState(board.name)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // 改名編集に入るたびに、入力値を現在のボード名へ揃え、フォーカス＋全選択する
  // （components/BoardManageModal.tsxの新規作成フォームと同じ「開いた直後にフォーカス」の考え方）。
  // このコンポーネント自体はisRenamingがfalse⇔trueと切り替わるだけでアンマウントされないため、
  // 「マウント時に1回」ではなく「isRenamingがtrueになるたび」に行う必要がある。
  //
  // board.nameを意図的に依存配列から外している。もし含めると、編集中に何らかの理由で
  // 親から渡されるboards一覧が更新された（例：他の行の並べ替えのrefetch）だけで
  // このeffectが再実行され、setDraftNameがユーザーの入力途中の文字を上書きしてしまう。
  // 「isRenamingがfalse→trueに切り替わった、その瞬間の名前で1回だけ揃える」ことが目的であり、
  // 以後board.nameが変わっても追従させたくないため、あえてisRenamingだけを依存にしている
  // （pages/SearchView.tsxのkeywordInUrl除外と同じ考え方）。
  useEffect(() => {
    if (!isRenaming) return
    setDraftName(board.name)
    nameInputRef.current?.focus()
    nameInputRef.current?.select()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRenaming])

  const { mutate: renameBoard, submitting: renaming, error: renameError } = useMutation<
    BoardUpdateRequest,
    BoardResponse
  >('PUT', apiPaths.board(board.id))
  const { remove: deleteBoard, submitting: deleting, error: deleteError } = useDelete(apiPaths.board(board.id))

  async function handleSaveRename() {
    const trimmed = draftName.trim()
    if (trimmed === '') return
    const updated = await renameBoard({ name: trimmed })
    if (updated === null) return
    onEndRename()
    onChanged()
  }

  function handleNameInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Escapeでのキャンセルはこの行では処理しない。BoardManageModal.tsxが持つdocumentレベルの
    // keydownリスナーは、Reactの合成イベント経由ではなくネイティブのbubbleでも必ず発火するため、
    // ここで個別に拾わなくても親（renamingBoardIdを見て分岐）で確実にキャンセルできる
    // （行ごとにstopPropagationするより、状態を親に集約する方が単純で確実という判断）。
    if (event.key === 'Enter') {
      event.preventDefault()
      void handleSaveRename()
    }
  }

  /**
   * 削除ボタンの確認ダイアログに使うカード件数を取得する。アーカイブ済みも物理削除の対象になるため、
   * 非アーカイブ・アーカイブ済みの両方を合算する（プロトタイプのcountActiveCardsForBoardと違い、
   * アーカイブ済みを含めないと「実際に消える件数」を過少に伝えてしまうため）。
   * 件数はこの確認メッセージのためだけに使う値であり、一覧取得APIの応答（BoardResponse）に
   * 集計フィールドを常時持たせるより、必要なとき（削除ボタンを押した瞬間）だけ2本のGETで
   * 数えるほうが、一覧取得のたびに発生する集計コストを避けられる。
   */
  async function countCardsForDeleteConfirm(): Promise<number | null> {
    try {
      const controller = new AbortController()
      const [active, archived] = await Promise.all([
        fetchJson<CardResponse[]>(apiPaths.cards({ boardId: board.id, archived: false }), controller.signal),
        fetchJson<CardResponse[]>(apiPaths.cards({ boardId: board.id, archived: true }), controller.signal),
      ])
      return active.length + archived.length
    } catch {
      // 件数の取得に失敗しても削除フロー自体は続行する（下のhandleDeleteClickが件数無しの
      // 汎用メッセージにフォールバックする）。件数が分からないことを理由に削除操作自体を
      // ブロックすると、件数取得用のGETがたまたま失敗しただけで本来できるはずの削除ができなくなる。
      return null
    }
  }

  async function handleDeleteClick() {
    const cardCount = await countCardsForDeleteConfirm()

    // window.confirm()というブラウザ標準のアラートで確認する（要件定義5.1「削除時は所属する
    // カードも削除される旨を確認する」・プロトタイプconfirmDeleteBoardと同じ文面の方針）。
    // カスタムモーダルではなく標準アラートを使うのは、削除という取り消せない操作の確認に
    // ちょうどよい重さで、開閉状態の管理やフォーカストラップの作り込みが一切不要になるため。
    const lines = [`「${board.name}」を削除します。`]
    if (cardCount === null) {
      lines.push('このボードに含まれるカード・ラベルもすべて削除されます。')
    } else if (cardCount > 0) {
      lines.push(`このボードに含まれる${cardCount}件のカード（アーカイブ済みを含む）とラベルもすべて削除されます。`)
    }
    lines.push('この操作は取り消せません。よろしいですか？')
    if (!window.confirm(lines.join('\n'))) return

    const ok = await deleteBoard()
    if (!ok) return
    onDeleted(board.id)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  if (isRenaming) {
    return (
      <li ref={setNodeRef} style={style} className="relative rounded border border-slate-200 px-3 py-2">
        {showDropLine && <DropLine />}
        <div className="flex items-center gap-2">
          {/* 編集中も⠿の位置に何か置いておくことで、通常表示との横幅のガタつきを防ぐ
              （プロトタイプの編集中<li>も同じ位置に静的な⠿を残している）。ドラッグ操作自体は
              useSortableのdisabled:isRenamingで止めているため、ここでは飾りとして置くだけでよい。 */}
          <span aria-hidden="true" className="cursor-not-allowed text-slate-300">
            ⠿
          </span>
          <input
            ref={nameInputRef}
            type="text"
            value={draftName}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setDraftName(event.target.value)}
            onKeyDown={handleNameInputKeyDown}
            maxLength={50}
            aria-label={`「${board.name}」の新しい名前`}
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <span className="flex gap-1">
            <button
              type="button"
              onClick={handleSaveRename}
              disabled={draftName.trim() === '' || renaming}
              className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              保存
            </button>
            <button
              type="button"
              onClick={onEndRename}
              className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
            >
              キャンセル
            </button>
          </span>
        </div>
        {/* StatusMessageコンポーネントを使わないのは、このモーダルの入力欄と同じ行の直下という
            狭い幅に収めたいため（StatusMessageは横幅いっぱいのボックスを想定した見た目のため、
            行単位のインライン表示にはそぐわない）。absolute配置にしない（＝通常のブロックとして
            置く）のは、components/BoardManageModal.tsxの新規作成フォームのエラー表示と同じく、
            発生時は素直にレイアウトを押し下げる方が、他の行に重なって読めなくなる事故が無いため。 */}
        {renameError !== null && (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {renameError.message}
          </p>
        )}
      </li>
    )
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`relative rounded border border-slate-200 px-3 py-2 ${isDragging ? 'opacity-40' : ''}`}
    >
      {showDropLine && <DropLine />}
      <div className="flex items-center gap-2">
        {/* ⠿：ドラッグハンドル。setActivatorNodeRef・listeners・attributesをこのボタンにだけ
            与えることで、行全体ではなくこのボタンからのドラッグだけがsetNodeRef先（<li>自身）を
            動かす（このコンポーネントのdocblock参照）。 */}
        <button
          ref={setActivatorNodeRef}
          type="button"
          title="ドラッグで並べ替え"
          aria-label={`「${board.name}」を並べ替え`}
          className="cursor-grab touch-none text-slate-400 hover:text-slate-600 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <span className="flex flex-col">
          <button
            type="button"
            onClick={() => void onMove(board.id, 'up')}
            disabled={isFirst}
            title="上へ"
            aria-label={`「${board.name}」を1つ上へ`}
            className="leading-none text-slate-500 hover:text-slate-800 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => void onMove(board.id, 'down')}
            disabled={isLast}
            title="下へ"
            aria-label={`「${board.name}」を1つ下へ`}
            className="leading-none text-slate-500 hover:text-slate-800 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            ▼
          </button>
        </span>
        <span className="flex-1">{board.name}</span>
        <span className="flex gap-1">
          <button
            type="button"
            onClick={() => onStartRename(board.id)}
            className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
          >
            改名
          </button>
          <button
            type="button"
            onClick={handleDeleteClick}
            disabled={deleting}
            className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
          >
            削除
          </button>
        </span>
      </div>
      {deleteError !== null && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {deleteError.message}
        </p>
      )}
    </li>
  )
}

/**
 * ドラッグ中、この行の直前に挿入されようとしていることを示すライン。
 * components/CardItem.tsxの挿入ラインと同じ理由でabsolute配置（inset-x-0 -top-2）にし、
 * 行の高さ自体は変えない（dnd-kitが実測するrectとずれないようにするため）。
 */
function DropLine() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 -top-2 z-10 h-1 rounded-full bg-blue-500"
      aria-hidden="true"
    />
  )
}

export default SortableBoardRow
