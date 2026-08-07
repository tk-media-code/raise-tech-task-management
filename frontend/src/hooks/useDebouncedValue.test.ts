import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from './useDebouncedValue'

/**
 * useDebouncedValue のテスト。
 *
 * このフックの本体は「タイマーを仕掛け、次の変化で消す」というクリーンアップ処理にある。
 * 実時間を待つと1件ごとに数百msかかるため、Vitestの「偽のタイマー」でテスト側から
 * 時間を進める。これにより「300ms経過した」状況を一瞬で作り出せる。
 */
describe('useDebouncedValue', () => {
  beforeEach(() => {
    // setTimeout/clearTimeout をVitestの制御下に置き換える。
    vi.useFakeTimers()
  })

  afterEach(() => {
    // 本物のタイマーに戻す。これを忘れると後続のテストファイルにまで影響が残る。
    vi.useRealTimers()
  })

  it('初期値はそのまま即座に返る', () => {
    const { result } = renderHook(() => useDebouncedValue('見積', 300))

    expect(result.current).toBe('見積')
  })

  it('値が変わっても、指定時間が経つまでは前の値を返し続ける', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: '見' },
    })

    rerender({ value: '見積' })
    // まだ時間を進めていないので、確定値は古いまま。
    expect(result.current).toBe('見')

    // 299ms時点でもまだ確定しない（境界の確認）。
    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(result.current).toBe('見')

    // 300msに達した瞬間に確定する。
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('見積')
  })

  it('連続して値が変わると、途中の値は一度も確定しない', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: '見' },
    })

    // 打鍵のたびに前のタイマーが破棄され、新しいタイマーが仕掛け直される。
    // t=0 で「見積」に変化 → このときのタイマーは t=300 に発火する予定。
    rerender({ value: '見積' })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    // t=100 で「見積書」に変化 → 前のタイマーは破棄され、新しいタイマーが t=400 に発火する予定。
    rerender({ value: '見積書' })

    // t=350 まで進める。ここが要点で、破棄されたはずのタイマーの発火予定時刻（t=300）を
    // 超えている。もしクリーンアップのclearTimeoutが無ければ、この時点で中間値の
    // 「見積」が確定してしまう。デバウンスが効いていれば「見」のままでなければならない。
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(result.current).toBe('見')

    // t=450。最後に仕掛けたタイマー（t=400）だけが発火している。
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('見積書')
  })

  it('アンマウントすると保留中のタイマーが残らない', () => {
    const { rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: '見' },
    })

    rerender({ value: '見積' })
    // この時点では発火待ちのタイマーが1本ある。
    expect(vi.getTimerCount()).toBe(1)

    unmount()

    // クリーンアップでclearTimeoutが呼ばれ、保留中のタイマーが0になること。
    // 「アンマウント後に result.current が変わらない」ことを見るだけでは、
    // タイマーが残っていても検出できない（アンマウント済みのフックの戻り値は
    // そもそも更新されないため）。タイマーの本数を直接数えるのが確実。
    expect(vi.getTimerCount()).toBe(0)
  })

  it('文字列以外の値でも同じように扱える（ジェネリクス）', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: [1, 2] as number[] },
    })

    rerender({ value: [1, 2, 3] })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current).toEqual([1, 2, 3])
  })
})
