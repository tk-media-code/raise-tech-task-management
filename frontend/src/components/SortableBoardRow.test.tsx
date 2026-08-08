import { DndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteRequest, fetchJson } from '../api/client'
import type { BoardResponse, CardResponse } from '../types/api'
import SortableBoardRow from './SortableBoardRow'

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

const fetchJsonMock = vi.mocked(fetchJson)
const deleteRequestMock = vi.mocked(deleteRequest)

const board: BoardResponse = { id: 1, name: '仕事', position: 1, createdAt: '2026-01-01T00:00:00' }

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
    labels: [],
  }
}

/**
 * この行はuseSortableを使うため、DndContext・SortableContextの中でしか描画できない
 * （どちらもContextの提供元であり、外で呼ぶとdnd-kit側がエラーになる）。
 * 実アプリのBoardManageModalと同じ入れ子構造をテストでも用意する。
 */
function renderRow(onDeleted = vi.fn()) {
  render(
    <DndContext>
      <SortableContext items={[board.id]}>
        <ul>
          <SortableBoardRow
            board={board}
            isFirst
            isLast
            isRenaming={false}
            onStartRename={vi.fn()}
            onEndRename={vi.fn()}
            onChanged={vi.fn()}
            onDeleted={onDeleted}
            onMove={vi.fn()}
            showDropLine={false}
          />
        </ul>
      </SortableContext>
    </DndContext>,
  )
  return onDeleted
}

/**
 * ボード管理モーダルの1行（要件5.1）のうち、ボード削除のテスト。
 *
 * カード完全削除（ArchivedCardItem.test.tsx）と違い、確認ダイアログを開いた「後で」
 * 巻き込まれて消えるカードの件数が確定する。その3状態（取得中／件数が出た／取得に失敗した）が
 * 正しく切り替わることが、このコンポーネント固有の確認点になる。
 */
describe('SortableBoardRow（ボードの削除）', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset()
    deleteRequestMock.mockReset()
    deleteRequestMock.mockResolvedValue(undefined)
    // 非アーカイブ2枚 + アーカイブ済み1枚 = 3枚。
    fetchJsonMock.mockImplementation(async (path: string) => {
      if (path.includes('archived=false')) return [card(10), card(11)]
      if (path.includes('archived=true')) return [card(12)]
      throw new Error(`unexpected path: ${path}`)
    })
  })

  it('「削除」を押した時点ではDELETEを送らず、確認ダイアログを開いて件数を後から表示する', async () => {
    const user = userEvent.setup()
    renderRow()

    await user.click(screen.getByRole('button', { name: '削除' }))

    expect(deleteRequestMock).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'ボードの削除' })).toBeInTheDocument()

    // 件数の取得はダイアログを開いた後に走るため、確定した文言は待って確認する。
    expect(
      await screen.findByText(/このボードに含まれる3件のカード（アーカイブ済みを含む）とラベルもすべて削除されます/),
    ).toBeInTheDocument()
    // アーカイブ済みも物理削除の対象なので、両方を数えていること。
    expect(fetchJsonMock).toHaveBeenCalledWith(expect.stringContaining('archived=false'), expect.anything())
    expect(fetchJsonMock).toHaveBeenCalledWith(expect.stringContaining('archived=true'), expect.anything())
  })

  it('件数の取得に失敗しても、汎用の文言にフォールバックして削除自体は実行できる', async () => {
    const user = userEvent.setup()
    fetchJsonMock.mockRejectedValue(new Error('件数の取得に失敗しました'))
    const onDeleted = renderRow()

    await user.click(screen.getByRole('button', { name: '削除' }))

    expect(
      await screen.findByText(/このボードに含まれるカード・ラベルもすべて削除されます/),
    ).toBeInTheDocument()
    // 件数が分からないことを理由に削除操作をブロックしない、という既存の方針を維持していること。
    await user.click(screen.getByRole('button', { name: '削除する' }))
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith(board.id)
    })
  })

  it('確認ダイアログで実行すると、正しいパスへDELETEを送りonDeletedを呼ぶ', async () => {
    const user = userEvent.setup()
    const onDeleted = renderRow()

    await user.click(screen.getByRole('button', { name: '削除' }))
    await screen.findByText(/3件のカード/)
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(deleteRequestMock).toHaveBeenCalledWith('/api/boards/1')
    })
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith(board.id)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('キャンセルすると確認ダイアログが閉じ、DELETEは送られない', async () => {
    const user = userEvent.setup()
    const onDeleted = renderRow()

    await user.click(screen.getByRole('button', { name: '削除' }))
    await screen.findByText(/3件のカード/)
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deleteRequestMock).not.toHaveBeenCalled()
    expect(onDeleted).not.toHaveBeenCalled()
  })
})
