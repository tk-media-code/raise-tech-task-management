import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, patchJson, postJson, putJson } from '../api/client'
import { useMutation } from './useMutation'

// api/client の送信関数だけを差し替える。ApiErrorは実物のクラスをそのまま使いたいので
// （instanceof判定がテスト対象のロジックに含まれるため）、importActualで本物を取り込んでから
// 送信関数だけを上書きする。
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    postJson: vi.fn(),
    putJson: vi.fn(),
    patchJson: vi.fn(),
  }
})

const postJsonMock = vi.mocked(postJson)
const putJsonMock = vi.mocked(putJson)
const patchJsonMock = vi.mocked(patchJson)

describe('useMutation', () => {
  beforeEach(() => {
    postJsonMock.mockReset()
    putJsonMock.mockReset()
    patchJsonMock.mockReset()
  })

  it('methodに応じて対応する送信関数が呼ばれる', async () => {
    postJsonMock.mockResolvedValue({ id: 1 })
    putJsonMock.mockResolvedValue({ id: 1 })
    patchJsonMock.mockResolvedValue({ id: 1 })

    const post = renderHook(() => useMutation<{ title: string }, { id: number }>('POST', '/api/cards'))
    await act(async () => {
      await post.result.current.mutate({ title: 'カード' })
    })
    expect(postJsonMock).toHaveBeenCalledWith('/api/cards', { title: 'カード' })

    const put = renderHook(() => useMutation<{ title: string }, { id: number }>('PUT', '/api/cards/1'))
    await act(async () => {
      await put.result.current.mutate({ title: 'カード' })
    })
    expect(putJsonMock).toHaveBeenCalledWith('/api/cards/1', { title: 'カード' })

    const patch = renderHook(() =>
      useMutation<{ status: string }, { id: number }>('PATCH', '/api/cards/1/status'),
    )
    await act(async () => {
      await patch.result.current.mutate({ status: 'doing' })
    })
    expect(patchJsonMock).toHaveBeenCalledWith('/api/cards/1/status', { status: 'doing' })
  })

  it('成功するとレスポンスを返し、errorはnullのまま', async () => {
    postJsonMock.mockResolvedValue({ id: 18 })

    const { result } = renderHook(() => useMutation<{ title: string }, { id: number }>('POST', '/api/cards'))

    let returned: { id: number } | null = null
    await act(async () => {
      returned = await result.current.mutate({ title: 'カード' })
    })

    expect(returned).toEqual({ id: 18 })
    expect(result.current.error).toBeNull()
    expect(result.current.submitting).toBe(false)
  })

  it('失敗しても例外を投げず、nullを返してerrorへ詰める', async () => {
    // 「例外を投げずnullを返す」のは、呼び出し側がtry/catchを書かずに
    // `if (result === null) return` の1行で打ち切れるようにするための設計。
    postJsonMock.mockRejectedValue(new ApiError('タイトルを入力してください', 400, null))

    const { result } = renderHook(() => useMutation<{ title: string }, { id: number }>('POST', '/api/cards'))

    let returned: { id: number } | null = { id: 0 }
    await act(async () => {
      returned = await result.current.mutate({ title: '' })
    })

    expect(returned).toBeNull()
    expect(result.current.error).toBeInstanceOf(ApiError)
    expect(result.current.error?.message).toBe('タイトルを入力してください')
  })

  it('ApiError以外の失敗はErrorに包み直される', async () => {
    postJsonMock.mockRejectedValue('想定外の何か')

    const { result } = renderHook(() => useMutation<{ title: string }, { id: number }>('POST', '/api/cards'))
    await act(async () => {
      await result.current.mutate({ title: 'カード' })
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error).not.toBeInstanceOf(ApiError)
  })

  it('送信中はsubmittingがtrueになる', async () => {
    let resolveSend: (value: { id: number }) => void = () => {}
    postJsonMock.mockReturnValue(
      new Promise<{ id: number }>((resolve) => {
        resolveSend = resolve
      }),
    )

    const { result } = renderHook(() => useMutation<{ title: string }, { id: number }>('POST', '/api/cards'))

    act(() => {
      void result.current.mutate({ title: 'カード' })
    })
    // 送信ボタンのdisabled（二重送信の防止）がこのフラグに依存している。
    await waitFor(() => {
      expect(result.current.submitting).toBe(true)
    })

    await act(async () => {
      resolveSend({ id: 1 })
    })
    expect(result.current.submitting).toBe(false)
  })

  it('前回の失敗は、次のmutate開始時にクリアされる', async () => {
    postJsonMock.mockRejectedValue(new ApiError('失敗しました', 500, null))

    const { result } = renderHook(() => useMutation<{ title: string }, { id: number }>('POST', '/api/cards'))
    await act(async () => {
      await result.current.mutate({ title: 'カード' })
    })
    expect(result.current.error).not.toBeNull()

    postJsonMock.mockResolvedValue({ id: 2 })
    await act(async () => {
      await result.current.mutate({ title: 'カード' })
    })

    // 成功した以上、前回のエラー表示が残り続けてはいけない。
    expect(result.current.error).toBeNull()
  })
})
