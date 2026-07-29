import { useEffect, useState } from 'react'

/**
 * 値の変化を`delayMs`だけ遅らせて反映する汎用フック（デバウンス）。
 *
 * 検索キーワードのように「入力のたびに何か重い処理（API呼び出し等）を伴う値」を
 * 扱うときに使う。入力欄自体はこのフックを介さず即座に表示し、実際にAPIへ渡す値だけを
 * このフックの戻り値に差し替えることで、「画面は毎打鍵で反応するが、通信は打鍵が
 * 止まってから1回だけ発生する」という体験になる。
 *
 * @param value    元の値（例: 入力欄の生の文字列）。変わるたびにタイマーが仕掛け直される
 * @param delayMs  最後の変化からこの時間（ミリ秒）静止したら確定とみなす
 * @returns 確定した値。`value`が変わり続けている間は、直前に確定した値を返し続ける
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    // valueが変わるたびにこのeffectが実行され、delayMs後にdebouncedを更新するタイマーを仕掛ける。
    const timer = setTimeout(() => {
      setDebounced(value)
    }, delayMs)

    // クリーンアップ＝「次にvalueが変わったとき、または画面から消えるとき」に必ず呼ばれる。
    // ここで前回のタイマーをclearTimeoutで消すのがデバウンスの本体。
    // 例えば「見」→「見積」と2回値が変わった場合:
    //   1. 「見」でタイマーAを仕掛ける
    //   2. 「見積」に変わった瞬間、cleanupが先に走りタイマーAを消す→タイマーBを仕掛ける
    //   3. delayMs後、生き残ったタイマーBだけが発火し、debouncedが「見積」になる
    // 「見」の状態がdebouncedに反映されることは無い（タイマーAは発火前に消されるため）。
    return () => {
      clearTimeout(timer)
    }
  }, [value, delayMs])

  return debounced
}
