import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteRequest, fetchJson } from '../api/client'
import type { CardResponse, LabelResponse } from '../types/api'
import LabelPicker from './LabelPicker'

// 通信の境界（api/client）だけを差し替える。apiPathsは実物をそのまま使いたいので
// importOriginalで本物を取り込んでから、送信・取得の関数だけを上書きする
// （CardCreateForm.test.tsxと同じ方針）。
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    fetchJson: vi.fn(),
    postJson: vi.fn(),
    deleteRequest: vi.fn(),
  }
})

const fetchJsonMock = vi.mocked(fetchJson)
const deleteRequestMock = vi.mocked(deleteRequest)

const urgentLabel: LabelResponse = { id: 1, name: '緊急', color: '#e74c3c' }
const importantLabel: LabelResponse = { id: 2, name: '重要', color: '#3498db' }

function card(id: number): CardResponse {
  return {
    id,
    boardId: 1,
    boardName: '仕事',
    title: `カード${id}`,
    description: null,
    dueDate: null,
    status: 'todo',
    isArchived: false,
    position: 1,
    labels: [urgentLabel],
  }
}

/**
 * LabelPicker（要件5.5）のうち、ラベル削除機能のテスト。
 *
 * ラベル一覧の取得（useApi）・削除確認パネルの件数取得（countCardsForLabel）・
 * 削除リクエスト（useDelete）のすべてがfetchJson/deleteRequestを経由するため、
 * fetchJsonはパスに応じて返す値を出し分ける実装にしている。
 */
describe('LabelPicker（ラベル削除）', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset()
    deleteRequestMock.mockReset()
    fetchJsonMock.mockImplementation(async (path: string) => {
      if (path === '/api/boards/1/labels') return [urgentLabel, importantLabel]
      if (path.startsWith('/api/cards') && path.includes('archived=false')) return [card(10), card(11)]
      if (path.startsWith('/api/cards') && path.includes('archived=true')) return [card(12)]
      throw new Error(`unexpected path: ${path}`)
    })
  })

  it('各ラベルの隣に削除ボタンが表示される', async () => {
    render(<LabelPicker boardId={1} selectedLabelIds={[]} onChange={vi.fn()} onLabelDeleted={vi.fn()} />)

    expect(await screen.findByRole('button', { name: 'ラベル「緊急」を削除' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ラベル「重要」を削除' })).toBeInTheDocument()
  })

  it('削除ボタンを押すと確認パネルが開き、使用中カード件数（非アーカイブ+アーカイブ済み）が表示される', async () => {
    const user = userEvent.setup()
    render(<LabelPicker boardId={1} selectedLabelIds={[]} onChange={vi.fn()} onLabelDeleted={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'ラベル「緊急」を削除' }))

    // active 2枚（card 10, 11）+ archived 1枚（card 12）= 3枚。
    expect(await screen.findByText(/このラベルは3枚のカードで使われています/)).toBeInTheDocument()
    expect(fetchJsonMock).toHaveBeenCalledWith(expect.stringContaining('archived=false'), expect.anything())
    expect(fetchJsonMock).toHaveBeenCalledWith(expect.stringContaining('archived=true'), expect.anything())
  })

  it('キャンセルすると確認パネルが閉じ、deleteRequestは呼ばれない', async () => {
    const user = userEvent.setup()
    render(<LabelPicker boardId={1} selectedLabelIds={[]} onChange={vi.fn()} onLabelDeleted={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'ラベル「緊急」を削除' }))
    await screen.findByText(/削除しますか/)
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(screen.queryByText(/削除しますか/)).not.toBeInTheDocument()
    expect(deleteRequestMock).not.toHaveBeenCalled()
  })

  it('削除するとdeleteRequestが正しいパスで呼ばれ、成功後にラベル一覧が再取得されonLabelDeletedが呼ばれる', async () => {
    const user = userEvent.setup()
    const onLabelDeleted = vi.fn()
    deleteRequestMock.mockResolvedValue(undefined)
    render(<LabelPicker boardId={1} selectedLabelIds={[]} onChange={vi.fn()} onLabelDeleted={onLabelDeleted} />)

    await user.click(await screen.findByRole('button', { name: 'ラベル「緊急」を削除' }))
    await screen.findByText(/削除しますか/)
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(deleteRequestMock).toHaveBeenCalledWith('/api/boards/1/labels/1')
    })
    expect(screen.queryByText(/削除しますか/)).not.toBeInTheDocument()
    await waitFor(() => {
      expect(onLabelDeleted).toHaveBeenCalledTimes(1)
    })
    // refetchLabelsにより、ラベル一覧のGET（マウント時1回＋削除成功後1回）が2回以上発生していること。
    await waitFor(() => {
      const labelFetchCalls = fetchJsonMock.mock.calls.filter(([path]) => path === '/api/boards/1/labels')
      expect(labelFetchCalls.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('削除対象が選択中だった場合、削除成功後にonChangeで選択から除外される', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    deleteRequestMock.mockResolvedValue(undefined)
    render(<LabelPicker boardId={1} selectedLabelIds={[1, 2]} onChange={onChange} onLabelDeleted={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'ラベル「緊急」を削除' }))
    await screen.findByText(/削除しますか/)
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([2])
    })
  })

  it('削除に失敗すると、確認パネルを閉じずエラーメッセージを表示する', async () => {
    const user = userEvent.setup()
    const onLabelDeleted = vi.fn()
    deleteRequestMock.mockRejectedValue(new Error('削除に失敗しました'))
    render(<LabelPicker boardId={1} selectedLabelIds={[]} onChange={vi.fn()} onLabelDeleted={onLabelDeleted} />)

    await user.click(await screen.findByRole('button', { name: 'ラベル「緊急」を削除' }))
    await screen.findByText(/削除しますか/)
    await user.click(screen.getByRole('button', { name: '削除する' }))

    expect(await screen.findByText(/削除に失敗しました/)).toBeInTheDocument()
    // 確認パネル自体は開いたまま。
    expect(screen.getByText(/削除しますか/)).toBeInTheDocument()
    expect(onLabelDeleted).not.toHaveBeenCalled()
  })
})
