import { useCallback, useState } from 'react'
import { ApiError, deleteRequest } from '../api/client'

export type UseDeleteResult = {
  /**
   * 指定したパスへDELETEリクエストを送る。
   * 成功時はtrue、失敗時はerrorへ詰めてfalseを返す。hooks/useMutation.ts の mutate と同じく
   * 例外を投げない設計にしているのは、呼び出し側（削除ボタンのクリックハンドラ）が
   * try/catchを書かずに `if (!(await remove())) return` の1行で失敗時の処理を打ち切れるようにするため。
   */
  remove: () => Promise<boolean>
  /** 送信中かどうか。trueの間は削除ボタンをdisabledにして二重送信を防ぐために使う */
  submitting: boolean
  /** 直近の削除が失敗した場合のエラー。成功時・未送信時はnull */
  error: Error | null
}

/**
 * 指定したパスへDELETEを送り、リソースを削除するための汎用フック（ボード削除で使う）。
 *
 * hooks/useMutation.ts（POST/PUT/PATCH用）とほぼ同じ骨格だが、統合せず別のフックにしている。
 * useMutationの`mutate`は「成功時はレスポンスのJSON（TResponse型）、失敗時はnull」という
 * 約束で成り立っているが、DELETEはリクエストボディを送らず、成功時のレスポンス（204 No Content）
 * にも本文が無い。つまり「成功を表す値」自体が存在しないため、成功と失敗をnullで区別する
 * useMutationの形はそのままでは使えない。代わりにこのフックは、成功/失敗をboolean（true/false）で
 * 区別する。
 *
 * @param path 削除対象のAPIパス（例: apiPaths.board(boardId)）
 */
export function useDelete(path: string): UseDeleteResult {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // useMutation.mutateと同じ理由（呼び出し側でuseCallbackの依存に置く可能性への備え）でuseCallback化する。
  const remove = useCallback(async (): Promise<boolean> => {
    setSubmitting(true)
    setError(null)
    try {
      await deleteRequest(path)
      return true
    } catch (cause) {
      // useMutationのcatchと同じ考え方：ApiErrorであればそのまま使い、それ以外（コードのバグなど）はErrorへ包み直す。
      setError(cause instanceof ApiError ? cause : new Error(String(cause)))
      return false
    } finally {
      setSubmitting(false)
    }
  }, [path])

  return { remove, submitting, error }
}
