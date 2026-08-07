import { useLabelsByBoard } from '../hooks/useLabelsByBoard'
import type { BoardResponse } from '../types/api'
import LabelToggleChip from './LabelToggleChip'
import StatusMessage from './StatusMessage'

type Props = {
  /** ボード一覧。App.tsxが取得したものをSearchView経由で受け取る（未取得・取得失敗はnull） */
  boards: BoardResponse[] | null
  /** ボード一覧の取得中かどうか */
  boardsLoading: boolean
  /** ボード一覧の取得に失敗した場合のエラー */
  boardsError: Error | null
  /** 現在絞り込みに使われているラベルIDの一覧 */
  selectedLabelIds: number[]
  /** チップがクリックされたとき（選択⇔解除のトグル）に呼ばれる */
  onToggle: (labelId: number) => void
}

/**
 * 検索画面（要件5.8）のラベル絞り込みUI。
 * ラベルはボード単位で管理されているため、絞り込み候補もボードごとにグループ化して表示する。
 *
 * ボード一覧は自分では取得せず、App.tsx → SearchView とpropsでリレーされたものを使う。
 * 以前はこのコンポーネントが独自にuseApi(apiPaths.boards())を呼んでおり、App.tsxのdocblockが
 * 明記する「ボード一覧のAPIをアプリ起動あたり1回叩くだけで済む」という設計を破る唯一の箇所に
 * なっていた（BoardSelect・BoardManageModal・CrossBoardViewはいずれもApp.tsxから受け取る形に
 * 揃っている）。検索画面を開くたびに2回目のGET /api/boardsが飛んでいたのを、他と同じ
 * リレー方式へ統一した。
 *
 * 一方、ラベル一覧（ボードごとのGET /api/boards/{id}/labels）は引き続きこのコンポーネントが
 * useLabelsByBoardで取得する。ラベルの一覧を必要とするのは今のところこの画面だけであり、
 * App.tsxまで引き上げる理由が無いため（必要とする画面が2つ目に増えた時点で、ボード一覧が
 * たどったのと同じリフトアップを検討すればよい）。
 */
function LabelFilterBar({
  boards,
  boardsLoading,
  boardsError,
  selectedLabelIds,
  onToggle,
}: Props) {
  const { labelsByBoard, loading: labelsLoading, error: labelsError } = useLabelsByBoard(boards)

  if (boardsLoading || labelsLoading) {
    return <StatusMessage kind="loading">ラベルを読み込み中…</StatusMessage>
  }
  if (boardsError !== null) {
    return <StatusMessage kind="error">ボード一覧の取得に失敗しました：{boardsError.message}</StatusMessage>
  }
  if (labelsError !== null) {
    return <StatusMessage kind="error">ラベル一覧の取得に失敗しました：{labelsError.message}</StatusMessage>
  }

  // ラベルが1件も無いボードはセクションごと表示しない（prototype/app.jsのbuildLabelFilterChipsHtmlと同じ挙動）。
  const boardsWithLabels = (boards ?? []).filter(
    (board) => (labelsByBoard?.[board.id] ?? []).length > 0,
  )

  if (boardsWithLabels.length === 0) {
    return <p className="text-xs text-slate-400">ラベルがまだありません</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {boardsWithLabels.map((board) => (
        <div key={board.id}>
          <p className="mb-1 text-xs font-semibold text-slate-500">{board.name}</p>
          <div className="flex flex-wrap gap-1">
            {(labelsByBoard?.[board.id] ?? []).map((label) => (
              <LabelToggleChip
                key={label.id}
                label={label}
                selected={selectedLabelIds.includes(label.id)}
                onToggle={onToggle}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default LabelFilterBar
