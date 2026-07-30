import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { apiPaths } from '../api/client'
import { useMutation } from '../hooks/useMutation'
import type { CardCreateRequest, CardResponse } from '../types/api'
import LabelPicker from './LabelPicker'
import StatusMessage from './StatusMessage'

type Props = {
  /** 作成するカードの所属先ボードID */
  boardId: number
  /** カード作成に成功したとき（一覧の再取得を親に依頼するため）に呼ばれる */
  onCreated: () => void
}

/**
 * カード新規作成フォーム（要件定義5.2、ワイヤーフレーム6.2①の「＋ カードを追加」）。
 * ボード詳細画面の「未着手」列の末尾に置かれる。普段は折りたたまれたボタンとして表示し、
 * クリックするとタイトル・説明・期日・ラベルを入力できるインラインフォームに展開する
 * （prototype/app.jsのbuildQuickAddHtml / ui.quickAddBoardIdと同じ「開閉はトグルの1状態のみ」
 * という設計を、Reactのローカルstateとして再現している）。
 *
 * ラベルの選択・新規作成（要件定義5.5）は`LabelPicker`に委ねている。もとはこのコンポーネント内に
 * 直接書かれていたが、カード編集（components/CardDetailModal.tsx）でも同じUIが必要になったため
 * 切り出した。作成したラベルは、作成中のこのカードへその場で自動選択される
 * （プロトタイプの`card.labelIds.push(label.id)`と同じ意図）。
 */
function CardCreateForm({ boardId, onCreated }: Props) {
  // フォームの開閉。「未着手列の下に置かれた、このカードだけの折りたたみ状態」なので、
  // BoardDetailView側で状態を持つ理由が無く、このコンポーネント内に閉じたローカルstateにしている。
  const [open, setOpen] = useState(false)

  // 入力項目ごとに個別のuseStateを用いている（1つのオブジェクトにまとめていない）。
  // まとめてしまうと、1項目更新するたびに `setForm(f => ({ ...f, title: value }))` のような
  // スプレッド構文を毎回書く必要があり、単純な入力欄が4つ並ぶだけのこのフォームでは
  // 個別に持つ方がシンプルで読みやすいと判断した（docs/react/08-form-and-mutation.md 18章参照）。
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>([])

  const { mutate: create, submitting, error } = useMutation<CardCreateRequest, CardResponse>(
    'POST',
    apiPaths.createCard(),
  )

  // タイトル欄への参照。フォームを開いた直後に自動でフォーカスを当てるために使う。
  // useState（再描画を伴う値の保持）と違い、useRefはDOM要素そのものへの参照を再描画なしで保持する
  // （docs/react/08-form-and-mutation.md 20章参照）。
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // openがtrueになった直後（＝フォームが展開された直後）だけフォーカスを当てる。
    // 折りたたむとき（open: true→false）はtitleInputRef.currentが指す要素自体が
    // アンマウントされて存在しなくなるため、何もする必要が無い。
    if (open) {
      titleInputRef.current?.focus()
    }
  }, [open])

  // 全hooks呼び出しの後に置く早期return（フックのルール。CardDetailModal.tsxと同じ理由）。
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-slate-300 p-3 text-center text-sm text-slate-500 transition hover:border-slate-400 hover:bg-slate-50"
      >
        ＋ カードを追加
      </button>
    )
  }

  function resetAndClose() {
    setTitle('')
    setDescription('')
    setDueDate('')
    setSelectedLabelIds([])
    // ラベル新規作成の途中状態（LabelPicker内のlabelCreatorOpen等）は、このフォームが
    // 折りたたまれてLabelPicker自体がアンマウントされる際にReactが自動的に破棄するため、
    // ここで個別にリセットするコードは不要（components/LabelPicker.tsxのdocblock参照）。
    setOpen(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // ブラウザ標準のフォーム送信（ページ全体のリロードを伴う）を止め、
    // 代わりにfetchによる非同期送信（useMutationのcreate）に置き換える。
    // これを書き忘れると、送信のたびにページがリロードされてSPAとして機能しなくなる。
    event.preventDefault()

    const created = await create({
      boardId,
      title: title.trim(),
      // 空文字列とnullをどちらも「未設定」として扱うのはバックエンド（CardService.normalizeDescription）
      // と同じ判断。空文字列のまま送っても動作はするが、意図を明確にするためここでもnullに正規化する。
      description: description.trim() === '' ? null : description.trim(),
      // <input type="date">は未入力時に空文字列を返す（nullは返さない）ため、ここで変換する。
      dueDate: dueDate === '' ? null : dueDate,
      labelIds: selectedLabelIds,
    })
    // createは失敗時にnullを返す（例外は投げない。hooks/useMutation.ts参照）。
    // 失敗時はerrorステートに詳細が入っているので、ここでは早期returnして
    // フォームの入力内容をそのまま残す（せっかく書いた説明文などを消さないため）。
    if (created === null) return

    resetAndClose()
    // 作成した1件をこの場でdataに足すのではなく、親（BoardDetailView）から
    // 渡されたrefetchを呼んで一覧全体を再取得する（並び順の決定権はサーバーにある。
    // hooks/useApi.ts の refetch のコメント参照）。
    onCreated()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-lg border border-slate-300 bg-white p-3 shadow-sm"
    >
      <input
        ref={titleInputRef}
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="カードのタイトルを入力してEnter"
        aria-label="カードのタイトル"
        maxLength={200}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
      />
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="説明・メモ（任意）"
        aria-label="説明・メモ"
        rows={3}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        type="date"
        value={dueDate}
        onChange={(event) => setDueDate(event.target.value)}
        aria-label="期日"
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
      />

      <LabelPicker boardId={boardId} selectedLabelIds={selectedLabelIds} onChange={setSelectedLabelIds} />

      {error !== null && <StatusMessage kind="error">{error.message}</StatusMessage>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          // 要件5.2「タイトルが未入力の間は、カード追加ボタンを無効化し、押せない状態にする」に対応する。
          // 前後の空白だけのタイトルも「未入力」とみなすため、trim()してから判定する。
          disabled={title.trim() === '' || submitting}
          title={title.trim() === '' ? 'タイトルを入力してください' : undefined}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {submitting ? '追加中…' : '追加'}
        </button>
        <button
          type="button"
          onClick={resetAndClose}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          キャンセル
        </button>
      </div>
    </form>
  )
}

export default CardCreateForm
