import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '../api/client'

/**
 * useApiが返す3つの状態。
 * 「読み込み中」「失敗した」「成功してデータがある」を別々の値として持つのがポイント。
 * dataがnullなだけでは「まだ読み込んでいない」のか「失敗した」のかが区別できないため、
 * 画面側で正しい表示を出し分けられない。
 */
export type UseApiResult<T> = {
  /** 取得したJSON。読み込み中・失敗時・未取得時はnull */
  data: T | null
  /** 通信中かどうか */
  loading: boolean
  /** 失敗した場合のエラー。成功時・読み込み中はnull */
  error: Error | null
  /**
   * 同じpathへ再度GETを実行し、data/loading/errorを更新する。
   * カードやボードの新規作成（POST）が成功したあと、その変更を画面に反映させるために使う
   * （docs/react/08-form-and-mutation.md 19章参照）。
   *
   * 楽観的更新（ローカルのdata配列にその場で1件足す）ではなく、必ずサーバーに再取得しに行く
   * 設計にしているのは、カードの並び順（position）がサーバー側だけが把握している情報で、
   * lib/grouping.tsもフロントエンド側では一切ソートしない前提になっているため。
   * ローカルで配列に追加すると、この「並び順はサーバーが決める」という契約が崩れてしまう。
   */
  refetch: () => void
}

/**
 * 指定したパスのAPIをGETで取得し、その状態（data / loading / error）を返すカスタムフック。
 *
 * 「カスタムフック」とは、useStateやuseEffectといった組み込みフックを内部で呼ぶ、
 * `use` で始まる名前のただの関数。これを画面から呼ぶだけで、
 * 「stateを3つ用意して、useEffectで通信して、後片付けもする」という定型を1行に畳める。
 *
 * @param path APIのパス（例: "/api/cards?archived=false"）。
 *             nullを渡すと通信しない。モーダルを閉じているときや、
 *             URLパラメータがまだ確定していないときに使う。
 *
 * なぜURLオブジェクトや関数ではなく「パス文字列」を受け取るのか:
 *   useEffectの依存配列はObject.isで比較されるため、依存に置けるのは
 *   「レンダリングのたびに作り直しても中身が同じなら等しいと判定される値」
 *   ＝プリミティブ（文字列・数値）が最も安全。
 *   ここでオブジェクト（{ boardId: 1 } など）や関数を受け取ると、
 *   毎レンダリングで新しいインスタンスになり「変わった」と判定され、
 *   無限に再フェッチが走ってしまう。useCallback/useMemoで包む回避策もあるが、
 *   そもそも文字列にしてしまえばその問題自体が発生しない。
 */
export function useApi<T>(path: string | null): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null)
  // 初期値をpath!==nullにしているのは、初回描画で一瞬だけ
  // 「loading=false かつ data=null」＝「空データ」に見える状態を挟まないため。
  // useStateの引数は初回レンダリング時にしか使われない（2回目以降は無視される）。
  const [loading, setLoading] = useState(path !== null)
  const [error, setError] = useState<Error | null>(null)
  // reloadCountは値そのものに意味はなく、「増えた」という事実だけを使う。
  // pathは変わっていないのにuseEffectをもう一度実行させたい（＝再取得したい）ときの
  // トリガーとして、依存配列に加える専用のstate。
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    // pathがnullのときは通信せず、前回の結果だけ片付けて終わる。
    // ここでreturnしても後片付け関数を返さないのは、購読も通信も始めていないため。
    if (path === null) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    // AbortControllerは「進行中のfetchを外から中断するためのリモコン」。
    // controller.signal をfetchに渡しておき、controller.abort() を呼ぶと通信が中断される。
    const controller = new AbortController()

    // pathが変わったとき、前のpathで取得したdataが画面に残り続けないよう、
    // 通信の開始時点で必ずリセットする（例: ボードAの詳細→ボードBの詳細に切り替えた瞬間、
    // Bの読み込み中にAのカードが表示されたままになるのを防ぐ）。
    setLoading(true)
    setError(null)
    setData(null)

    // useEffectのコールバック自体はasyncにできない。asyncな関数は必ずPromiseを返すが、
    // useEffectの戻り値は「後片付け関数」か「undefined」でなければならないため
    // （Promiseを返すとReactがそれを後片付け関数と誤認する）。そのため、内部に
    // 即時実行のasync関数を1つ置いて、その中でawaitする。
    // voidを付けているのは「このPromiseの結果は使わない」という意思表示。
    void (async () => {
      try {
        setData(await fetchJson<T>(path, controller.signal))
      } catch (cause: unknown) {
        // 中断（abort）は「呼び出し側が意図してやめた」だけで、ユーザーに見せる失敗ではない。
        // signal.abortedを見るのは、err.nameを見るより確実なため
        // （fetchが解決した直後・setDataの実行前に中断されたケースも拾える）。
        if (controller.signal.aborted) return
        setError(cause instanceof Error ? cause : new Error(String(cause)))
      } finally {
        // 中断された実行でloadingをfalseに倒すと、後続の新しい実行が立てたloading=trueを
        // 打ち消してしまう。ここでも中断チェックが要る。
        // catch側と違いreturnではなくifで囲うのは、finallyの中のreturnがcatchのreturnを
        // 上書きしてしまうというJavaScriptの落とし穴を避けるため（ここでは戻り値を
        // 使っていないので実害は無いが、紛らわしい書き方をしない）。
        if (!controller.signal.aborted) setLoading(false)
      }
    })()

    // useEffectが返した関数＝後片付け（クリーンアップ）。Reactは
    //   (1) 依存配列の値が変わって効果を実行し直す直前
    //   (2) コンポーネントが画面から消える（アンマウント）とき
    // にこれを呼ぶ。ここで通信を中断しないと、画面を離れたあとに
    // 存在しないコンポーネントのsetStateが走ったり、古い結果が新しい結果を
    // 上書きする「競合状態（レースコンディション）」が起きる。
    //
    // 開発時にStrictModeが有効だと、Reactは意図的に
    // マウント→アンマウント→再マウント を1往復させ、この後片付けが正しく
    // 書けているかを検査する。結果としてNetworkタブにリクエストが2本並ぶが、
    // 1本目は必ずabortされるので正しい挙動。本番ビルドでは1回しか走らない。
    return () => {
      controller.abort()
    }
  }, [path, reloadCount]) // 依存配列。pathが変わったとき「または」reloadCountが変わったときに、この効果を実行し直す。
  // 空配列[]なら初回だけ、配列そのものを省略すると毎レンダリング実行される（＝無限ループ）。

  // useCallbackで関数自体を安定させる（依存配列が空なので、このフックが返すrefetchは
  // 呼び出し側の再レンダリングをまたいで常に同じ関数インスタンスであり続ける）。
  // ここを素の関数式のままにすると、useApiを呼んでいるコンポーネントが再レンダリングされるたびに
  // 新しいrefetch関数が作られ、それをuseEffectの依存配列に置いている呼び出し側
  // （例: components/CardCreateForm.tsx）で意図しない再実行を招きかねない。
  //
  // setReloadCount(c => c + 1) という「更新関数を渡す」形（関数型更新）を使っているのは、
  // このコールバック定義時点のreloadCountの値をクロージャに閉じ込めず、実行時点の最新値を
  // Reactから受け取るため。もし setReloadCount(reloadCount + 1) と書くと、依存配列を空にした
  // 弊害でクロージャが常に初回描画時のreloadCount（0）を見続けてしまい、2回目以降のrefetchが
  // 効かなくなる（0+1=1にしかならない）。
  const refetch = useCallback(() => {
    setReloadCount((count) => count + 1)
  }, [])

  return { data, loading, error, refetch }
}
