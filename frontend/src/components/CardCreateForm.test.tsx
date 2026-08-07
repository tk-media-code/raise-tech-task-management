import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchJson, postJson } from '../api/client'
import CardCreateForm from './CardCreateForm'

// 通信の境界（api/client）だけを差し替える。apiPathsやApiErrorは実物をそのまま使いたいので
// importOriginalで本物を取り込んでから、送信・取得の関数だけを上書きする。
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    fetchJson: vi.fn(),
    postJson: vi.fn(),
  }
})

const fetchJsonMock = vi.mocked(fetchJson)
const postJsonMock = vi.mocked(postJson)

/**
 * カード新規作成フォーム（要件5.2）のテスト。
 *
 * 特に「タイトルが未入力の間は、カード追加ボタンを無効化し、押せない状態にする」は
 * 要件定義5.2の受け入れ条件そのものなので、前後の空白だけの入力も含めて検証する。
 */
describe('CardCreateForm', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset()
    postJsonMock.mockReset()
    // 配下のLabelPickerがボードのラベル一覧を取得するため、空配列を返しておく。
    fetchJsonMock.mockResolvedValue([])
  })

  it('最初は折りたたまれており、「＋ カードを追加」だけが見えている', () => {
    render(<CardCreateForm boardId={1} onCreated={vi.fn()} />)

    expect(screen.getByRole('button', { name: '＋ カードを追加' })).toBeInTheDocument()
    expect(screen.queryByLabelText('カードのタイトル')).not.toBeInTheDocument()
  })

  it('クリックで展開すると、タイトル欄にフォーカスが当たる', async () => {
    const user = userEvent.setup()
    render(<CardCreateForm boardId={1} onCreated={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '＋ カードを追加' }))

    const titleInput = screen.getByLabelText('カードのタイトル')
    expect(titleInput).toBeInTheDocument()
    // 開いた直後にすぐ入力を始められること（useEffect + useRefによるフォーカス）。
    expect(titleInput).toHaveFocus()
  })

  it('タイトルが未入力のあいだ「追加」ボタンは無効', async () => {
    const user = userEvent.setup()
    render(<CardCreateForm boardId={1} onCreated={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '＋ カードを追加' }))

    // 要件5.2の受け入れ条件。
    expect(screen.getByRole('button', { name: '追加' })).toBeDisabled()
  })

  it('前後の空白だけのタイトルも「未入力」として扱われる', async () => {
    const user = userEvent.setup()
    render(<CardCreateForm boardId={1} onCreated={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '＋ カードを追加' }))

    await user.type(screen.getByLabelText('カードのタイトル'), '   ')

    // trim()してから判定しているため、空白のみでは有効にならない。
    expect(screen.getByRole('button', { name: '追加' })).toBeDisabled()
  })

  it('タイトルを入力すると「追加」ボタンが押せるようになる', async () => {
    const user = userEvent.setup()
    render(<CardCreateForm boardId={1} onCreated={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '＋ カードを追加' }))

    await user.type(screen.getByLabelText('カードのタイトル'), '打合せ資料')

    expect(screen.getByRole('button', { name: '追加' })).toBeEnabled()
  })

  it('送信時、タイトルはtrimされ、未入力の説明・期日はnullに正規化される', async () => {
    const user = userEvent.setup()
    postJsonMock.mockResolvedValue({ id: 1 })
    render(<CardCreateForm boardId={1} onCreated={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '＋ カードを追加' }))

    await user.type(screen.getByLabelText('カードのタイトル'), '  打合せ資料  ')
    await user.click(screen.getByRole('button', { name: '追加' }))

    await waitFor(() => {
      expect(postJsonMock).toHaveBeenCalled()
    })
    // 空文字列ではなくnullを送るのは、バックエンド（CardService.normalizeDescription）と
    // 同じ「未設定」の表現に揃えるため。
    expect(postJsonMock).toHaveBeenCalledWith('/api/cards', {
      boardId: 1,
      title: '打合せ資料',
      description: null,
      dueDate: null,
      labelIds: [],
    })
  })

  it('作成に成功すると、親へ通知してフォームが閉じる', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    postJsonMock.mockResolvedValue({ id: 1 })
    render(<CardCreateForm boardId={1} onCreated={onCreated} />)
    await user.click(screen.getByRole('button', { name: '＋ カードを追加' }))

    await user.type(screen.getByLabelText('カードのタイトル'), '打合せ資料')
    await user.click(screen.getByRole('button', { name: '追加' }))

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1)
    })
    // 折りたたまれた状態に戻っていること。
    expect(screen.getByRole('button', { name: '＋ カードを追加' })).toBeInTheDocument()
    expect(screen.queryByLabelText('カードのタイトル')).not.toBeInTheDocument()
  })

  it('作成に失敗したら、入力内容を消さずにエラーを表示する', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    postJsonMock.mockRejectedValue(new Error('サーバーエラー'))
    render(<CardCreateForm boardId={1} onCreated={onCreated} />)
    await user.click(screen.getByRole('button', { name: '＋ カードを追加' }))

    await user.type(screen.getByLabelText('カードのタイトル'), '打合せ資料')
    await user.click(screen.getByRole('button', { name: '追加' }))

    await waitFor(() => {
      expect(screen.getByText(/サーバーエラー/)).toBeInTheDocument()
    })
    // せっかく書いた内容が消えないこと（失敗時は早期returnしてresetAndCloseを呼ばない）。
    expect(screen.getByLabelText('カードのタイトル')).toHaveValue('打合せ資料')
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('キャンセルすると入力内容が破棄されて折りたたまれる', async () => {
    const user = userEvent.setup()
    render(<CardCreateForm boardId={1} onCreated={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '＋ カードを追加' }))
    await user.type(screen.getByLabelText('カードのタイトル'), '書きかけ')

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(screen.queryByLabelText('カードのタイトル')).not.toBeInTheDocument()

    // 開き直したとき、前回の入力が残っていないこと。
    await user.click(screen.getByRole('button', { name: '＋ カードを追加' }))
    expect(screen.getByLabelText('カードのタイトル')).toHaveValue('')
  })
})
