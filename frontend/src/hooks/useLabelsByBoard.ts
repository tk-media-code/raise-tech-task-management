import { useEffect, useState } from 'react'
import { apiPaths, fetchJson } from '../api/client'
import type { BoardResponse, LabelResponse } from '../types/api'

/** ボードIDをキーにした、ボードごとのラベル一覧 */
export type LabelsByBoard = Record<number, LabelResponse[]>

export type UseLabelsByBoardResult = {
  /** ボードごとのラベル一覧。未取得・boardsがnullの間はnull */
  labelsByBoard: LabelsByBoard | null
  loading: boolean
  error: Error | null
}

/**
 * ボード一覧から、ボードごとのラベル一覧をまとめて取得するフック（検索画面のラベル
 * 絞り込みUIで、ボードごとにグループ化して表示するために使う）。
 *
 * hooks/useApi.tsは「1つのパスをGETする」ことに特化しているため、ボードの数だけ
 * `GET /api/boards/{id}/labels`を呼びたいこの用途には使えない（フックはループの中で
 * 呼び出せないというReactの制約もある）。そのため、api/client.tsの低レベルな関数
 * `fetchJson`を直接使い、`Promise.all`でボードの数だけ並列に呼び出す形で実装している。
 * data/loading/error・AbortControllerでの後片付けという骨格自体はuseApiと同じ考え方。
 *
 * @param boards ボード一覧（GET /api/boardsの結果）。読み込み中・未取得はnullが渡る
 */
export function useLabelsByBoard(boards: BoardResponse[] | null): UseLabelsByBoardResult {
  const [labelsByBoard, setLabelsByBoard] = useState<LabelsByBoard | null>(null)
  const [loading, setLoading] = useState(boards !== null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // boardsがまだ届いていない間は、こちらも「まだ何も無い」状態のままにする。
    if (boards === null) {
      setLabelsByBoard(null)
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    // ボード1件につき1本のfetchJsonを呼び、[boardId, そのボードのラベル一覧]という
    // タプルに変換する。Promise.allは渡した配列の**全部**が成功して初めて解決する
    // （1件でも失敗すれば、その時点でPromise.all自体が失敗する）。
    Promise.all(
      boards.map((board) =>
        fetchJson<LabelResponse[]>(apiPaths.boardLabels(board.id), controller.signal).then(
          (labels): [number, LabelResponse[]] => [board.id, labels],
        ),
      ),
    )
      .then((entries) => {
        // [[1, [...]], [2, [...]], ...] という配列を { 1: [...], 2: [...] } に変換する。
        setLabelsByBoard(Object.fromEntries(entries))
      })
      .catch((cause: unknown) => {
        // useApiと同じ理由で、中断（abort）はエラー表示に昇格させない。
        if (controller.signal.aborted) return
        setError(cause instanceof Error ? cause : new Error(String(cause)))
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setLoading(false)
      })

    // 1つのAbortControllerをN本のfetchJsonすべてに共有しているため、abort()を1回呼ぶだけで
    // 進行中の全リクエストをまとめて中断できる（boardsが変わったとき・画面を離れたとき）。
    return () => {
      controller.abort()
    }
  }, [boards])

  return { labelsByBoard, loading, error }
}
