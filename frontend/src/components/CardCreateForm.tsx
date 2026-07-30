import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { apiPaths } from '../api/client'
import { useApi } from '../hooks/useApi'
import { useCreate } from '../hooks/useCreate'
import { LABEL_COLORS } from '../lib/labelColors'
import type { CardCreateRequest, CardResponse, LabelCreateRequest, LabelResponse } from '../types/api'
import ColorSwatchPicker from './ColorSwatchPicker'
import LabelToggleChip from './LabelToggleChip'
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
 * ラベル欄には既存ラベルの選択（LabelToggleChip）に加え、要件定義5.5「あらかじめ用意された
 * 色パレットから色を選び、任意の名前を付けて作成する」に対応するラベルの新規作成もここで行える
 * （プロトタイプはカード詳細モーダル内でこれを行っていたが、本実装ではカード編集がまだ無いため、
 * カード追加フォームに移植した）。作成したラベルは、作成中のこのカードへその場で自動選択される
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

  // ラベル新規作成の折りたたみと入力欄。カードの入力項目（title等）とは別の「もう1つの
  // 小さなフォーム」なので、状態も分けて持つ（混ぜるとresetAndCloseの見通しが悪くなる）。
  const [labelCreatorOpen, setLabelCreatorOpen] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0].hex)

  // ラベル一覧は展開中だけ取得する（折りたたみ中はpathにnullを渡して通信しない。
  // components/CardDetailModal.tsxのcardId===nullと同じ考え方）。
  // refetchLabelsは、この下のcreateLabelでラベルを新規作成した直後、一覧を取り直すために使う
  // （BoardDetailView.tsxがCardCreateFormへrefetchを渡すのと同じ考え方を、このコンポーネント
  // 自身がラベル一覧に対して行う）。
  const {
    data: labels,
    refetch: refetchLabels,
  } = useApi<LabelResponse[]>(open ? apiPaths.boardLabels(boardId) : null)

  const { create, submitting, error } = useCreate<CardCreateRequest, CardResponse>(apiPaths.createCard())

  // ラベル作成用に、カード作成とは別のuseCreateインスタンスを持つ。リクエスト・レスポンスの型が
  // 異なる（LabelCreateRequest/LabelResponse）だけでなく、送信中・エラーの状態もカード本体の
  // 送信とは独立させたい（ラベル作成に失敗してもカードのタイトル等の入力は保持したいし、
  // 逆にカード送信中でもラベル作成の成否表示に影響させたくない）ため。
  const {
    create: createLabel,
    submitting: creatingLabel,
    error: labelError,
  } = useCreate<LabelCreateRequest, LabelResponse>(apiPaths.boardLabels(boardId))

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

  function handleToggleLabel(labelId: number) {
    setSelectedLabelIds((current) =>
      current.includes(labelId) ? current.filter((id) => id !== labelId) : [...current, labelId],
    )
  }

  // event引数を取らないただの関数にしている理由: HTMLの<form>は入れ子にできないため、
  // ラベル作成は（既にカード作成用の<form onSubmit={handleSubmit}>の中にいるので）2つ目の
  // <form>にはできない。そのため「作成」ボタンはtype="button"のonClickから、ラベル名欄での
  // EnterはinputのonKeyDownから、それぞれこの関数を直接呼び出す形にする（下のJSX参照）。
  async function handleCreateLabel() {
    const created = await createLabel({ name: newLabelName.trim(), color: newLabelColor })
    // createは失敗時にnullを返す（例外は投げない。useCreate参照）。失敗時はlabelErrorに
    // 詳細が入るので、ここでは早期returnして入力内容（名前・色の選択）をそのまま残す。
    if (created === null) return

    // ラベル一覧を取り直して選択肢に反映しつつ、作成した瞬間そのラベルを選択済みにする
    // （プロトタイプのcard.labelIds.push(label.id)と同じ「作成＝このカードへの自動付与」という意図）。
    // 2つは互いに独立したstateなので、どちらを先に呼んでも結果は変わらない。
    refetchLabels()
    setSelectedLabelIds((current) => [...current, created.id])

    setNewLabelName('')
    setNewLabelColor(LABEL_COLORS[0].hex)
    setLabelCreatorOpen(false)
  }

  function resetAndClose() {
    setTitle('')
    setDescription('')
    setDueDate('')
    setSelectedLabelIds([])
    // ラベル作成の途中状態も、カード本体の入力と同じくフォームを閉じたら持ち越さない
    // （再度開いたときに前回の入力が中途半端に残っていると混乱するため）。
    setLabelCreatorOpen(false)
    setNewLabelName('')
    setNewLabelColor(LABEL_COLORS[0].hex)
    setOpen(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // ブラウザ標準のフォーム送信（ページ全体のリロードを伴う）を止め、
    // 代わりにfetchによる非同期送信（useCreateのcreate）に置き換える。
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
    // createは失敗時にnullを返す（例外は投げない。hooks/useCreate.ts参照）。
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

      {/* ラベル選択・新規作成欄。labelsが取得できていない間（null＝折りたたみ中）は何も描画しない。
          「既存ラベルの選択チップ」は1件も無いボードでは意味が無いため出さないが、
          「＋ 新しいラベルを作成」の導線はラベルの有無に関わらず常に描画する。
          後者まで labels.length > 0 の条件に含めてしまうと、まだラベルが1つも無いボードで
          最初のラベルを作る入り口自体が無くなってしまうため。 */}
      {labels !== null && (
        <div className="flex flex-col gap-1">
          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {labels.map((label) => (
                <LabelToggleChip
                  key={label.id}
                  label={label}
                  selected={selectedLabelIds.includes(label.id)}
                  onToggle={handleToggleLabel}
                />
              ))}
            </div>
          )}

          {labelCreatorOpen ? (
            <div className="flex flex-col gap-1 rounded border border-slate-200 p-2">
              <ColorSwatchPicker selectedColor={newLabelColor} onSelect={setNewLabelColor} />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newLabelName}
                  onChange={(event) => setNewLabelName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      // ここでpreventDefaultしないと、Enterが外側のカード作成<form>の
                      // onSubmit（handleSubmit）へ伝わり、カードが意図せず送信されてしまう。
                      // 1つの<form>の中に「カードを送信する」「ラベルを作成する」という
                      // 2つの送信意図が同居しているため、Enterの向き先を明示的に分ける。
                      event.preventDefault()
                      void handleCreateLabel()
                    }
                  }}
                  placeholder="ラベル名"
                  aria-label="新しいラベルの名前"
                  maxLength={30}
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={handleCreateLabel}
                  // 要件5.2と同じ「未入力なら押せない」考え方をラベル名にも適用する。
                  disabled={newLabelName.trim() === '' || creatingLabel}
                  className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                >
                  {creatingLabel ? '作成中…' : '作成'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLabelCreatorOpen(false)
                    setNewLabelName('')
                    setNewLabelColor(LABEL_COLORS[0].hex)
                  }}
                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  キャンセル
                </button>
              </div>
              {labelError !== null && <StatusMessage kind="error">{labelError.message}</StatusMessage>}
            </div>
          ) : (
            // type="button"必須：外側の<form>の中にあるため、指定を忘れると既定のtype="submit"
            // として扱われ、クリックのたびにカードが送信されてしまう（下のボタン群も同様）。
            <button
              type="button"
              onClick={() => setLabelCreatorOpen(true)}
              className="self-start text-xs text-blue-600 hover:underline"
            >
              ＋ 新しいラベルを作成
            </button>
          )}
        </div>
      )}

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
