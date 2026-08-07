/** ヘッダーのボード切替で選ばれている対象（「すべて」または特定ボードのID） */
export type SelectedBoardId = 'all' | number

/**
 * 選択中のボードに対応する一覧画面のパスを返す。
 * 「すべて」→ 横断ビュー（/）、特定ボード → ボード詳細（/boards/:id）。
 */
export function boardListPath(selectedBoardId: SelectedBoardId): string {
  return selectedBoardId === 'all' ? '/' : `/boards/${selectedBoardId}`
}
