import { apiPaths } from '../api/client'
import { useApi } from '../hooks/useApi'
import { useLabelsByBoard } from '../hooks/useLabelsByBoard'
import type { BoardResponse } from '../types/api'
import LabelToggleChip from './LabelToggleChip'
import StatusMessage from './StatusMessage'

type Props = {
  /** 現在絞り込みに使われているラベルIDの一覧 */
  selectedLabelIds: number[]
  /** チップがクリックされたとき（選択⇔解除のトグル）に呼ばれる */
  onToggle: (labelId: number) => void
}

/**
 * 検索画面（要件5.8）のラベル絞り込みUI。
 * ラベルはボード単位で管理されているため、絞り込み候補もボードごとにグループ化して表示する。
 *
 * ボード一覧はこのコンポーネント自身が取得する（components/BoardSelect.tsxも同じ
 * GET /api/boardsを独立して呼んでいる）。このプロジェクトはまだコンポーネント間で
 * データを共有する仕組み（Contextなど）を持っておらず、「必要なコンポーネントが
 * それぞれ自分で取りに行く」という既存方針をここでも踏襲している
 * （3ボード程度の小さな一覧を1回多く取得するコストは無視できる）。
 */
function LabelFilterBar({ selectedLabelIds, onToggle }: Props) {
  const { data: boards, loading: boardsLoading, error: boardsError } = useApi<BoardResponse[]>(
    apiPaths.boards(),
  )
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
