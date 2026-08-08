import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog'

/** 各テストで使い回す既定のprops。検証したい1つだけをoverridesで差し替える */
function renderDialog(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const props = {
    open: true,
    title: 'カードの完全削除',
    confirmLabel: '完全に削除する',
    submittingLabel: '削除中…',
    submitting: false,
    error: null,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    children: <p>「買い物リスト」を完全に削除します。</p>,
    ...overrides,
  }
  render(<ConfirmDialog {...props} />)
  return props
}

/**
 * ConfirmDialog（取り消せない操作の確認）のテスト。
 *
 * このプロジェクトで初めて<dialog>をテストするコンポーネントのため、
 * showModal()はsrc/test/setup.tsの代替実装に依存している（jsdomが未実装のため）。
 * トップレイヤー・フォーカストラップ・Escapeの実際の挙動はそちらでは再現できないので、
 * ここで確認するのは「Reactのstateとイベントの配線が正しいか」に絞る。
 */
describe('ConfirmDialog', () => {
  it('open=falseのあいだは何も描画しない', () => {
    renderDialog({ open: false })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText(/完全に削除します/)).not.toBeInTheDocument()
  })

  it('開くと見出し・本文・両ボタンが表示され、初期フォーカスはキャンセルに当たる', () => {
    renderDialog()

    // aria-labelはtitleと同じ文言。showModal()がrole="dialog"を暗黙に与えるため、
    // ロールとアクセシブル名の組み合わせで引ける。
    expect(screen.getByRole('dialog', { name: 'カードの完全削除' })).toBeInTheDocument()
    expect(screen.getByText(/「買い物リスト」を完全に削除します/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '完全に削除する' })).toBeInTheDocument()

    // Enterを押しただけで破壊的操作が走らないよう、安全側に初期フォーカスを置いている。
    expect(screen.getByRole('button', { name: 'キャンセル' })).toHaveFocus()
  })

  it('実行ボタンを押すとonConfirmが1回だけ呼ばれる', async () => {
    const user = userEvent.setup()
    const props = renderDialog()

    await user.click(screen.getByRole('button', { name: '完全に削除する' }))

    expect(props.onConfirm).toHaveBeenCalledTimes(1)
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('キャンセル・×・背景クリックのいずれでもonCloseだけが呼ばれ、onConfirmは呼ばれない', async () => {
    const user = userEvent.setup()

    for (const name of ['キャンセル', '閉じる']) {
      const props = renderDialog()
      await user.click(screen.getByRole('button', { name }))
      expect(props.onClose).toHaveBeenCalledTimes(1)
      expect(props.onConfirm).not.toHaveBeenCalled()
      cleanupBetweenCases()
    }

    // 背景クリックは「クリックされた要素がその領域自身であるとき」だけ閉じる判定のため、
    // role="presentation"のdivを直接クリックする必要がある。
    const props = renderDialog()
    const backdropArea = screen.getByRole('dialog').firstElementChild
    expect(backdropArea).not.toBeNull()
    await user.click(backdropArea as HTMLElement)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('実行中は両ボタンが無効になり、実行ボタンのラベルが差し替わる', () => {
    renderDialog({ submitting: true })

    expect(screen.getByRole('button', { name: '削除中…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '閉じる' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: '完全に削除する' })).not.toBeInTheDocument()
  })

  it('errorを渡すとダイアログの中にalertとして表示される', () => {
    renderDialog({ error: new Error('削除に失敗しました') })

    expect(screen.getByRole('alert')).toHaveTextContent('削除に失敗しました')
    // エラーが出てもダイアログは開いたまま（再試行できる）。
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('実行中はEscape（cancelイベント）で閉じない', () => {
    const props = renderDialog({ submitting: true })

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))

    expect(props.onClose).not.toHaveBeenCalled()
  })

  /**
   * 入れ子（BoardManageModal → SortableBoardRow → ConfirmDialog）の回帰テスト。
   *
   * ネイティブのcancelイベントはバブルしないが、Reactは非バブリングのイベントも合成イベントとして
   * Reactツリーの祖先へ配り直す。そのためConfirmDialog側でstopPropagation()しないと、確認ダイアログで
   * Escapeを押しただけで外側のモーダル（BoardManageModal）のonCancelまで動いてしまい、
   * ボード管理モーダルごと閉じる。この1行は消しても型チェックもlintも通ってしまうため、
   * テストで固定しておく。
   */
  it('入れ子で使っても、Escapeが外側の<dialog>のonCancelへ伝わらない', () => {
    const onParentCancel = vi.fn()
    const onClose = vi.fn()
    render(
      // 外側にopenを付けるのは、閉じた<dialog>の中身がdisplay:noneになり、
      // Testing Libraryから内側のダイアログを引けなくなるため。実アプリでは
      // BoardManageModalがshowModal()で開いており、同じくopen属性が付いた状態にあたる。
      <dialog open onCancel={onParentCancel}>
        <ConfirmDialog
          open
          title="ボードの削除"
          confirmLabel="削除する"
          submittingLabel="削除中…"
          submitting={false}
          error={null}
          onConfirm={vi.fn()}
          onClose={onClose}
        >
          <p>「仕事」を削除します。</p>
        </ConfirmDialog>
      </dialog>,
    )

    fireEvent(
      screen.getByRole('dialog', { name: 'ボードの削除' }),
      new Event('cancel', { cancelable: true }),
    )

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onParentCancel).not.toHaveBeenCalled()
  })
})

/**
 * 1つのitの中で複数回renderするケースのための後片付け。
 * src/test/setup.tsのcleanupはafterEach（＝itの終了時）にしか走らないため、
 * it内で描画をやり直すときは同じ要素が二重に見つからないようここで明示的に消す。
 */
function cleanupBetweenCases() {
  document.body.innerHTML = ''
}
