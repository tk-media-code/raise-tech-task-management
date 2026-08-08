import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteRequest } from '../api/client'
import type { CardResponse } from '../types/api'
import ArchivedCardItem from './ArchivedCardItem'

// 通信の境界（api/client）だけを差し替える方針はLabelPicker.test.tsxと同じ。
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    fetchJson: vi.fn(),
    postJson: vi.fn(),
    deleteRequest: vi.fn(),
  }
})

const deleteRequestMock = vi.mocked(deleteRequest)

const archivedCard: CardResponse = {
  id: 7,
  boardId: 1,
  boardName: '仕事',
  title: '買い物リスト',
  description: null,
  dueDate: null,
  status: 'done',
  isArchived: true,
  position: 1,
  labels: [],
}

function renderItem(onDeleted = vi.fn()) {
  render(
    <ArchivedCardItem card={archivedCard} onSelect={vi.fn()} onRestored={vi.fn()} onDeleted={onDeleted} />,
  )
  return onDeleted
}

/**
 * アーカイブ一覧の行（要件5.7）のうち、カード完全削除のテスト。
 *
 * 最初のテストが、この機能で実際に起きた不具合そのものにあたる。以前はwindow.confirm()で
 * 確認していたため、ブラウザ側の設定でダイアログが無効化されていると、確認を挟まずに
 * DELETEが飛ぶ（あるいは何も起きない）状態になり得た。「押した時点ではまだ削除されない」ことを
 * 自動テストで固定しておく。
 */
describe('ArchivedCardItem（カードの完全削除）', () => {
  beforeEach(() => {
    deleteRequestMock.mockReset()
    deleteRequestMock.mockResolvedValue(undefined)
  })

  it('「完全削除」を押した時点ではDELETEを送らず、確認ダイアログを開く', async () => {
    const user = userEvent.setup()
    renderItem()

    await user.click(screen.getByRole('button', { name: '完全削除' }))

    expect(deleteRequestMock).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'カードの完全削除' })).toBeInTheDocument()
    expect(screen.getByText(/「買い物リスト」をアーカイブから完全に削除します/)).toBeInTheDocument()
    expect(screen.getByText(/この操作は取り消せません/)).toBeInTheDocument()
  })

  it('確認ダイアログで実行すると、正しいパスへDELETEを送りonDeletedを呼ぶ', async () => {
    const user = userEvent.setup()
    const onDeleted = renderItem()

    await user.click(screen.getByRole('button', { name: '完全削除' }))
    await user.click(screen.getByRole('button', { name: '完全に削除する' }))

    await waitFor(() => {
      expect(deleteRequestMock).toHaveBeenCalledWith('/api/cards/7')
    })
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledTimes(1)
    })
    // 成功したらダイアログは閉じる。
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('キャンセルすると確認ダイアログが閉じ、DELETEは送られない', async () => {
    const user = userEvent.setup()
    const onDeleted = renderItem()

    await user.click(screen.getByRole('button', { name: '完全削除' }))
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deleteRequestMock).not.toHaveBeenCalled()
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it('削除に失敗すると、ダイアログを閉じずエラーを表示する', async () => {
    const user = userEvent.setup()
    deleteRequestMock.mockRejectedValue(new Error('削除に失敗しました'))
    const onDeleted = renderItem()

    await user.click(screen.getByRole('button', { name: '完全削除' }))
    await user.click(screen.getByRole('button', { name: '完全に削除する' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('削除に失敗しました')
    // やり直せるよう、ダイアログは開いたまま。
    expect(screen.getByRole('dialog', { name: 'カードの完全削除' })).toBeInTheDocument()
    expect(onDeleted).not.toHaveBeenCalled()
  })
})
