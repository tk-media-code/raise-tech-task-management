import { useCallback, useState } from 'react'
import { ApiError, postJson } from '../api/client'

export type UseCreateResult<TRequest, TResponse> = {
  /**
   * 指定した内容でリソースを作成する。
   * 成功時は作成されたリソース（TResponse）を返し、失敗時はerrorへ詰めてnullを返す。
   * 例外を投げずnullを返す形にしているのは、呼び出し側（フォームのonSubmit）が
   * try/catchを書かずに `if (created === null) return` の1行で失敗時の処理を打ち切れるようにするため。
   */
  create: (request: TRequest) => Promise<TResponse | null>
  /** 送信中かどうか。trueの間は追加ボタンをdisabledにして二重送信を防ぐために使う */
  submitting: boolean
  /** 直近の作成が失敗した場合のエラー。成功時・未送信時はnull */
  error: Error | null
}

/**
 * 指定したパスへPOSTしてリソースを新規作成するための汎用フック。
 * カード作成（components/CardCreateForm.tsx）・ボード作成（components/BoardManageModal.tsx）の
 * 両方から、リクエスト・レスポンスの型だけを変えて共用する
 * （docs/react/08-form-and-mutation.md 19章参照）。
 *
 * hooks/useApi.tsをそのまま使わない理由:
 * useApiは「pathの変化を検知してuseEffectでGETする」という、コンポーネントの描画に
 * 追従する取得系の設計になっている。POSTは逆に「ボタンを押すという明示的な操作」で
 * 一度だけ実行したい書き込みであり、依存配列に乗せて自動発火させる仕組みとは相性が悪い。
 * そのため、hooks/useLabelsByBoard.tsと同様に、data/loading/errorという骨格だけを踏襲しつつ、
 * 中身はこの用途向けに書き直している。
 *
 * @param path 作成先のAPIパス（例: apiPaths.createCard()）
 */
export function useCreate<TRequest, TResponse>(path: string): UseCreateResult<TRequest, TResponse> {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // useCallbackにしているのは、この関数をuseEffectの依存配列に置く用途は無いものの、
  // フォームコンポーネント側でuseCallback化した送信ハンドラの依存として使う可能性に備え、
  // useApi.refetchと同じく「呼び出しても再生成されない安定した関数」にしておくため。
  const create = useCallback(
    async (request: TRequest): Promise<TResponse | null> => {
      setSubmitting(true)
      setError(null)
      try {
        // postJsonにsignalを渡さない（＝中断できない）理由は api/client.ts の
        // postJsonのコメントを参照。
        const created = await postJson<TRequest, TResponse>(path, request)
        return created
      } catch (cause) {
        // ApiErrorであれば（バリデーションエラーのerrors.フィールド名を含め）そのまま使い、
        // それ以外（コードのバグなど）はErrorへ包み直す。useApiのcatchと同じ考え方。
        setError(cause instanceof ApiError ? cause : new Error(String(cause)))
        return null
      } finally {
        setSubmitting(false)
      }
    },
    [path],
  )

  return { create, submitting, error }
}
