import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchJson } from '../api/client'
import { useApi } from './useApi'

// api/client の fetchJson をモックに差し替える。本物を呼ぶと実際にfetchが走り、
// テストがバックエンドの起動状態やネットワークに依存してしまう。
// ここで検証したいのは通信そのものではなく、useApiが状態（data/loading/error）を
// どう遷移させるかという「フックの振る舞い」なので、境界であるfetchJsonを偽物にする。
vi.mock('../api/client', () => ({
  fetchJson: vi.fn(),
}))

const fetchJsonMock = vi.mocked(fetchJson)

/** 解決も拒否もしない、永久に保留のままのPromise（「読み込み中」の状態を作るために使う）。 */
function pending<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

describe('useApi', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset()
  })

  it('pathがnullのときは通信せず、読み込み中にもならない', () => {
    const { result } = renderHook(() => useApi<string[]>(null))

    expect(fetchJsonMock).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('取得中はloading=trueで、dataもerrorもnullのまま', () => {
    fetchJsonMock.mockReturnValue(pending())

    const { result } = renderHook(() => useApi<string[]>('/api/boards'))

    // 初期値をpath!==nullにしているため、初回描画の時点で既にloading=true。
    // ここが一瞬でもfalseになると「取得前」と「0件」の区別がつかない画面になる。
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('成功するとdataが入り、loadingが下りる', async () => {
    fetchJsonMock.mockResolvedValue(['仕事', '家事'])

    const { result } = renderHook(() => useApi<string[]>('/api/boards'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.data).toEqual(['仕事', '家事'])
    expect(result.current.error).toBeNull()
  })

  it('失敗するとerrorが入り、dataはnullのまま', async () => {
    fetchJsonMock.mockRejectedValue(new Error('サーバーに接続できませんでした'))

    const { result } = renderHook(() => useApi<string[]>('/api/boards'))

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })
    expect(result.current.error?.message).toBe('サーバーに接続できませんでした')
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('Error以外がthrowされてもErrorに包まれる', async () => {
    // 型はunknownなので、文字列や数値がthrowされる可能性を排除できない。
    fetchJsonMock.mockRejectedValue('文字列がthrowされた')

    const { result } = renderHook(() => useApi<string[]>('/api/boards'))

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error)
    })
    expect(result.current.error?.message).toBe('文字列がthrowされた')
  })

  it('pathが変わると再取得され、前のpathのdataは残らない', async () => {
    fetchJsonMock.mockResolvedValue(['ボードAのカード'])

    const { result, rerender } = renderHook(({ path }) => useApi<string[]>(path), {
      initialProps: { path: '/api/cards?boardId=1' },
    })
    await waitFor(() => {
      expect(result.current.data).toEqual(['ボードAのカード'])
    })

    // 次のpathでは永久に保留のPromiseを返し、「読み込み中」で止める。
    fetchJsonMock.mockReturnValue(pending())
    rerender({ path: '/api/cards?boardId=2' })

    // ボードBの読み込み中に、ボードAのカードが表示されたままにならないこと。
    // これが残ると「別のボードを開いたのに前のカードが見えている」という不具合になる。
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  it('アンマウントすると進行中の通信が中断される', () => {
    fetchJsonMock.mockReturnValue(pending())

    const { unmount } = renderHook(() => useApi<string[]>('/api/boards'))

    const signal = fetchJsonMock.mock.calls[0]?.[1]
    expect(signal?.aborted).toBe(false)

    unmount()

    // クリーンアップでcontroller.abort()が呼ばれていること。
    // これが無いと、画面を離れた後に古い結果が届いて状態を書き換えてしまう。
    expect(signal?.aborted).toBe(true)
  })

  it('中断された通信の失敗は、画面に見せるerrorにしない', async () => {
    // 中断（abort）は「呼び出し側が意図してやめた」だけで、ユーザーに見せる失敗ではない。
    // pathを切り替えた瞬間に前の通信が失敗するが、それをerrorとして表示すると
    // 画面切り替えのたびにエラーが出てしまう。
    let rejectFirst: (reason: Error) => void = () => {}
    fetchJsonMock.mockReturnValueOnce(
      new Promise<string[]>((_resolve, reject) => {
        rejectFirst = reject
      }),
    )

    const { result, rerender } = renderHook(({ path }) => useApi<string[]>(path), {
      initialProps: { path: '/api/cards?boardId=1' },
    })

    // 2つ目のpathへ切り替え（この時点で1本目がabortされる）。
    fetchJsonMock.mockReturnValue(pending())
    rerender({ path: '/api/cards?boardId=2' })

    // 中断された1本目が、遅れて失敗として返ってくる状況を作る。
    await act(async () => {
      rejectFirst(new Error('The operation was aborted'))
      await Promise.resolve()
    })

    expect(result.current.error).toBeNull()
  })

  it('refetchを呼ぶと同じpathで再取得される', async () => {
    fetchJsonMock.mockResolvedValue(['1件目'])

    const { result } = renderHook(() => useApi<string[]>('/api/boards'))
    await waitFor(() => {
      expect(result.current.data).toEqual(['1件目'])
    })
    expect(fetchJsonMock).toHaveBeenCalledTimes(1)

    fetchJsonMock.mockResolvedValue(['1件目', '2件目'])
    act(() => {
      result.current.refetch()
    })

    // pathは変わっていないが、reloadCountの変化でuseEffectが再実行される。
    await waitFor(() => {
      expect(result.current.data).toEqual(['1件目', '2件目'])
    })
    expect(fetchJsonMock).toHaveBeenCalledTimes(2)
  })

  it('refetchの関数インスタンスは再描画をまたいでも変わらない', async () => {
    fetchJsonMock.mockResolvedValue([])

    const { result, rerender } = renderHook(() => useApi<string[]>('/api/boards'))
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const first = result.current.refetch
    rerender()

    // useCallbackで安定させているため同一インスタンスであること。
    // ここが毎回新しくなると、refetchを依存配列に入れている呼び出し元で
    // 意図しない再実行が起きる。
    expect(result.current.refetch).toBe(first)
  })
})
