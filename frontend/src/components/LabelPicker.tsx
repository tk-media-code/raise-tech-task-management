import { useState } from 'react'
import { apiPaths } from '../api/client'
import { useApi } from '../hooks/useApi'
import { useMutation } from '../hooks/useMutation'
import { LABEL_COLORS } from '../lib/labelColors'
import type { LabelCreateRequest, LabelResponse } from '../types/api'
import ColorSwatchPicker from './ColorSwatchPicker'
import LabelToggleChip from './LabelToggleChip'
import StatusMessage from './StatusMessage'

type Props = {
  /** ラベルの取得・新規作成先となるボードのID */
  boardId: number
  /** 現在選択中のラベルIDの一覧（controlled。状態そのものはこのコンポーネントの外側が持つ） */
  selectedLabelIds: number[]
  /** 選択状態が変わったとき（トグル・新規作成による自動選択）に呼ばれる */
  onChange: (labelIds: number[]) => void
}

/**
 * 既存ラベルのトグル選択＋新規ラベル作成をまとめたコンポーネント（要件定義5.5）。
 * カード作成フォーム（CardCreateForm）とカード詳細モーダル（CardDetailModal）の両方から使う、
 * 「ラベルまわりの入力欄一式」をここに集約している。もとはCardCreateForm.tsx内に直接
 * 書かれていたが、カード編集でも同じUIが必要になったため切り出した。
 *
 * 選択状態（selectedLabelIds）自体は持たない「controlled」コンポーネント
 * （ColorSwatchPickerやLabelToggleChipと同じ考え方）。ラベルの新規作成（このカードへの
 * 自動付与を含む）と既存ラベルのトグルは、どちらもonChangeを通じて親のstateを書き換える
 * 形で反映される。
 *
 * ラベル一覧の取得（useApi）を「開いている間だけ」に絞るガードをこのコンポーネント自身は
 * 持たない。呼び出し元（CardCreateForm・CardDetailModal）が、フォーム／モーダルが開いている
 * ときにしかこのコンポーネントをJSXに描画しないため、マウントされること自体が
 * 「今ラベルが必要になった」という合図になる（閉じればアンマウントされ、useApiの通信も
 * 後片付けされる）。
 */
function LabelPicker({ boardId, selectedLabelIds, onChange }: Props) {
  // ラベル新規作成の折りたたみと入力欄。この状態がこのコンポーネント自身に閉じているため、
  // 呼び出し元（CardCreateForm等）がこのコンポーネントをアンマウントするだけで
  // （＝フォームを閉じるだけで）自動的に破棄される。個別にリセットするコードは不要。
  const [labelCreatorOpen, setLabelCreatorOpen] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0].hex)

  // refetchLabelsは、この下のhandleCreateLabelでラベルを新規作成した直後、一覧を取り直すために使う。
  const { data: labels, refetch: refetchLabels } = useApi<LabelResponse[]>(apiPaths.boardLabels(boardId))

  // ラベル作成用のuseMutation。呼び出し元（カード本体）の送信状態とは独立させたい
  // （ラベル作成に失敗してもカードのタイトル等の入力は保持したいし、逆にカード送信中でも
  // ラベル作成の成否表示に影響させたくない）ため、このコンポーネント自身が持つ。
  const {
    mutate: createLabel,
    submitting: creatingLabel,
    error: labelError,
  } = useMutation<LabelCreateRequest, LabelResponse>('POST', apiPaths.boardLabels(boardId))

  function handleToggleLabel(labelId: number) {
    onChange(
      selectedLabelIds.includes(labelId)
        ? selectedLabelIds.filter((id) => id !== labelId)
        : [...selectedLabelIds, labelId],
    )
  }

  // event引数を取らないただの関数にしている理由: 呼び出し元（CardCreateForm・CardDetailModal）の
  // <form>の中にこのコンポーネントが置かれるため、「作成」ボタンをこのコンポーネント内で
  // 2つ目の<form>にはできない（HTMLの<form>は入れ子にできない）。そのため「作成」ボタンは
  // type="button"のonClickから、ラベル名欄でのEnterはinputのonKeyDownから、
  // それぞれこの関数を直接呼び出す形にする（下のJSX参照）。
  async function handleCreateLabel() {
    const created = await createLabel({ name: newLabelName.trim(), color: newLabelColor })
    // createLabelは失敗時にnullを返す（例外は投げない。useMutation参照）。失敗時はlabelErrorに
    // 詳細が入るので、ここでは早期returnして入力内容（名前・色の選択）をそのまま残す。
    if (created === null) return

    // ラベル一覧を取り直して選択肢に反映しつつ、作成した瞬間そのラベルを選択済みにする
    // （プロトタイプの`card.labelIds.push(label.id)`と同じ「作成＝このカードへの自動付与」という意図）。
    refetchLabels()
    onChange([...selectedLabelIds, created.id])

    setNewLabelName('')
    setNewLabelColor(LABEL_COLORS[0].hex)
    setLabelCreatorOpen(false)
  }

  // labelsが取得できていない間（読み込み中）は何も描画しない。
  // 呼び出し元はこのコンポーネントを「開いている間だけ」描画するので、閉じている間の
  // フェッチ抑止（CardCreateFormが以前持っていたopen ? ... : nullのガード）は不要になった。
  if (labels === null) return null

  return (
    <div className="flex flex-col gap-1">
      {/* 「既存ラベルの選択チップ」は1件も無いボードでは意味が無いため出さないが、
          「＋ 新しいラベルを作成」の導線はラベルの有無に関わらず常に描画する。
          後者まで labels.length > 0 の条件に含めてしまうと、まだラベルが1つも無いボードで
          最初のラベルを作る入り口自体が無くなってしまうため。 */}
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
                  // ここでpreventDefaultしないと、Enterが外側の<form>のonSubmitへ伝わり、
                  // カード本体が意図せず送信されてしまう。1つの<form>の中に「本体を送信する」
                  // 「ラベルを作成する」という2つの送信意図が同居しているため、Enterの向き先を
                  // 明示的に分ける。
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
        // として扱われ、クリックのたびにカード本体が送信されてしまう。
        <button
          type="button"
          onClick={() => setLabelCreatorOpen(true)}
          className="self-start text-xs text-blue-600 hover:underline"
        >
          ＋ 新しいラベルを作成
        </button>
      )}
    </div>
  )
}

export default LabelPicker
