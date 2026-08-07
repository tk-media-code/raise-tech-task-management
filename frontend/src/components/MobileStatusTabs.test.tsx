import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import MobileStatusTabs from './MobileStatusTabs'

/**
 * スマートフォン向けステータス切り替えタブ（要件8.1）のテスト。
 * APIやドラッグ＆ドロップに依存しない、propsだけで完結するコンポーネントのため、
 * CardCreateForm.test.tsxと違いモックは一切不要。
 */
describe('MobileStatusTabs', () => {
  const counts = { todo: 2, doing: 1, done: 0 }

  it('3つのタブが件数付きラベルで表示される', () => {
    render(<MobileStatusTabs activeStatus="todo" countsByStatus={counts} onSelect={vi.fn()} />)

    expect(screen.getByRole('tab', { name: '未着手 (2)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '作業中 (1)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '完了 (0)' })).toBeInTheDocument()
  })

  it('activeStatusに一致するタブだけがaria-selected=trueになる', () => {
    render(<MobileStatusTabs activeStatus="doing" countsByStatus={counts} onSelect={vi.fn()} />)

    expect(screen.getByRole('tab', { name: '未着手 (2)' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: '作業中 (1)' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '完了 (0)' })).toHaveAttribute('aria-selected', 'false')
  })

  it('タブをクリックすると、そのステータスを引数にonSelectが呼ばれる', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<MobileStatusTabs activeStatus="todo" countsByStatus={counts} onSelect={onSelect} />)

    await user.click(screen.getByRole('tab', { name: '完了 (0)' }))

    expect(onSelect).toHaveBeenCalledWith('done')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})
