import { useCallback, useState } from 'react'
import { ApiError, patchJson, postJson, putJson } from '../api/client'

/** このフックが対応する、ボディを伴う書き込み系HTTPメソッド */
export type HttpWriteMethod = 'POST' | 'PUT' | 'PATCH'

export type UseMutationResult<TRequest, TResponse> = {
  /**
   * 指定した内容でリクエストを送信する。
   * 成功時は結果（TResponse）を返し、失敗時はerrorへ詰めてnullを返す。
   * 例外を投げずnullを返す形にしているのは、呼び出し側（フォームのonSubmitやドラッグ&ドロップの
   * ドロップハンドラ）がtry/catchを書かずに `if (result === null) return` の1行で
   * 失敗時の処理を打ち切れるようにするため。
   */
  mutate: (request: TRequest) => Promise<TResponse | null>
  /** 送信中かどうか。trueの間は送信ボタンをdisabledにして二重送信を防ぐために使う */
  submitting: boolean
  /** 直近の送信が失敗した場合のエラー。成功時・未送信時はnull */
  error: Error | null
}

/**
 * 指定したパスへ指定したHTTPメソッド（POST/PUT/PATCH）でリクエストを送り、
 * リソースを作成・更新するための汎用フック。
 *
 * 元は`useCreate`という名前でPOST専用（カード・ボード作成）のフックだったが、
 * カードの編集（PUT）・ステータス変更（PATCH）が加わったことを機に、メソッドを引数として
 * 受け取る形へ一般化した。「送信中かどうか」「失敗時はnullを返し例外を投げない」という
 * 骨格は元のuseCreateから変えていない（呼び出し側のコードは`create`が`mutate`に
 * 名前を変えるだけで、ほぼそのまま移行できる）。
 *
 * hooks/useApi.tsをそのまま使わない理由:
 * useApiは「pathの変化を検知してuseEffectでGETする」という、コンポーネントの描画に
 * 追従する取得系の設計になっている。書き込み系は逆に「ボタンを押す・カードをドロップする」という
 * 明示的な操作で一度だけ実行したいものであり、依存配列に乗せて自動発火させる仕組みとは相性が悪い。
 * そのため、hooks/useLabelsByBoard.tsと同様に、data/loading/errorという骨格だけを踏襲しつつ、
 * 中身はこの用途向けに書き直している。
 *
 * @param method 送信に使うHTTPメソッド
 * @param path   送信先のAPIパス（例: apiPaths.card(cardId)）。カード詳細モーダルのように
 *               対象が確定するまで（モーダルが閉じている間）待つ必要がある場合は、
 *               空文字列などのプレースホルダーを渡してよい（Reactのフックは呼び出し側の
 *               早期returnより前で、常に同じ回数呼ばれる必要があるため）。実際に送信ボタンや
 *               ドロップ操作が存在しない間はmutateが呼ばれることも無いので、実害は無い。
 */
export function useMutation<TRequest, TResponse>(
  method: HttpWriteMethod,
  path: string,
): UseMutationResult<TRequest, TResponse> {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // useCallbackにしているのは、この関数をuseEffectの依存配列に置く用途は無いものの、
  // フォームコンポーネント側でuseCallback化した送信ハンドラの依存として使う可能性に備え、
  // useApi.refetchと同じく「呼び出しても再生成されない安定した関数」にしておくため。
  const mutate = useCallback(
    async (request: TRequest): Promise<TResponse | null> => {
      setSubmitting(true)
      setError(null)
      try {
        // メソッドごとの送信関数（api/client.ts）を選ぶだけで、それ以外の処理（送信中フラグ・
        // エラーの拾い方）はメソッドによらず完全に共通。POST/PUT/PATCHのいずれもsignalを
        // 渡さない（＝中断できない）理由はapi/client.tsの各関数のコメントを参照。
        const send = method === 'POST' ? postJson : method === 'PUT' ? putJson : patchJson
        return await send<TRequest, TResponse>(path, request)
      } catch (cause) {
        // ApiErrorであれば（バリデーションエラーのerrors.フィールド名を含め）そのまま使い、
        // それ以外（コードのバグなど）はErrorへ包み直す。useApiのcatchと同じ考え方。
        setError(cause instanceof ApiError ? cause : new Error(String(cause)))
        return null
      } finally {
        setSubmitting(false)
      }
    },
    [method, path],
  )

  return { mutate, submitting, error }
}
