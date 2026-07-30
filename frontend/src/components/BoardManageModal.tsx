import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { apiPaths } from '../api/client'
import { useCreate } from '../hooks/useCreate'
import type { BoardCreateRequest, BoardResponse } from '../types/api'
import StatusMessage from './StatusMessage'

type Props = {
  /** モーダルが開いているか。falseのときは何も描画しない（CardDetailModal.tsxのcardId===nullと同じ考え方） */
  open: boolean
  /** 表示するボード一覧（App.tsxがGET /api/boardsで取得したものをそのまま渡す） */
  boards: BoardResponse[]
  /** ボード作成に成功したとき（ヘッダーのセレクトボックス・このモーダル自身の一覧を更新するため）に呼ばれる */
  onCreated: () => void
  /** モーダルを閉じるとき（× ／背景クリック／Escape）に呼ばれる */
  onClose: () => void
}

/**
 * ボード管理モーダル（要件定義 6.2 ②）。ヘッダーの `⚙` から開く。
 * ボードの新規作成・名称変更・削除・並べ替えを行う画面だが、今回のセッションで実装するのは
 * **新規作成のみ**。改名・削除・並べ替えはPUT/DELETE系APIが未実装のため、
 * ボタン自体は置きつつdisabledにしてある（App.tsxの`⚙`ボタンが採ってきたのと同じ方針：
 * 押せるが何も起きないボタンより、無効だと分かる方が誤解が少ない）。
 *
 * 構造・開閉の作法はCardDetailModal.tsxを踏襲している
 * （フックは早期returnより前にすべて呼ぶ・背景クリック判定・Escapeキー処理など）。
 */
function BoardManageModal({ open, boards, onCreated, onClose }: Props) {
  const [name, setName] = useState('')
  const { create, submitting, error } = useCreate<BoardCreateRequest, BoardResponse>(apiPaths.createBoard())

  // モーダルを開いた直後にボード名入力欄へフォーカスを当てる（CardCreateForm.tsxと同じ理由）。
  const nameInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) {
      nameInputRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  // 全hooks呼び出しの後に置く早期return（フックのルール。CardDetailModal.tsxと同じ理由）。
  if (!open) return null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const created = await create({ name: name.trim() })
    if (created === null) return

    // モーダルは開いたままにする（ボード管理はカード作成と違い、続けて何件も
    // 作成する使い方が自然なため。CardCreateFormは1件ごとに折りたたむ設計だが、
    // こちらは常に開いているリスト画面なので、閉じずに入力欄だけ空にする）。
    setName('')
    // 親（App.tsx）が持つボード一覧（ヘッダーのセレクトボックスとこのモーダル自身が共有している）
    // を再取得させ、作成した1件を含む最新の一覧に更新する。
    onCreated()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="ボード管理"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 className="text-base font-bold">ボード管理</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded px-2 text-lg leading-none text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </header>

        <div className="space-y-3 p-4 text-sm">
          <ul className="space-y-2">
            {boards.map((board) => (
              <li
                key={board.id}
                className="flex items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2"
              >
                <span className="flex items-center gap-2">
                  {/* ⠿ は並べ替えハンドル（ワイヤーフレーム6.2②）。ドラッグ操作はPUT系APIが
                      未実装のため今は反応しない飾りとして置くだけにし、非活性であることが
                      伝わるようcursor-not-allowedと薄い色にしている。 */}
                  <span
                    aria-hidden="true"
                    title="並べ替えは書き込みAPIの実装後に対応します"
                    className="cursor-not-allowed text-slate-300"
                  >
                    ⠿
                  </span>
                  {board.name}
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    disabled
                    title="改名は書き込みAPIの実装後に対応します"
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-400"
                  >
                    改名
                  </button>
                  <button
                    type="button"
                    disabled
                    title="削除は書き込みAPIの実装後に対応します"
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-400"
                  >
                    削除
                  </button>
                </span>
              </li>
            ))}
          </ul>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="新しいボード名"
              aria-label="新しいボード名"
              maxLength={50}
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={name.trim() === '' || submitting}
              title={name.trim() === '' ? 'ボード名を入力してください' : undefined}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              ＋ 追加
            </button>
          </form>

          {error !== null && <StatusMessage kind="error">{error.message}</StatusMessage>}
        </div>
      </div>
    </div>
  )
}

export default BoardManageModal
