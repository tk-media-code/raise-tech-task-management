import { useState } from 'react'
import { apiPaths, fetchJson } from '../api/client'
import { useApi } from '../hooks/useApi'
import { useDelete } from '../hooks/useDelete'
import { useMutation } from '../hooks/useMutation'
import { LABEL_COLORS } from '../lib/labelColors'
import type { CardResponse, LabelCreateRequest, LabelResponse } from '../types/api'
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
  /**
   * ラベル削除に成功したときに呼ばれる。このLabelPicker自身が持つラベル一覧はrefetchLabelsで
   * 更新するが、同じ画面内の他のカード表示（削除したラベルを持っていた可能性がある）は
   * 別のuseApiインスタンスのため、このLabelPicker単体では最新化できない。呼び出し元
   * （CardCreateForm・CardDetailModal）が既に持つ一覧再取得コールバック（onCreated・onUpdated）
   * をそのまま渡してもらうことで、新しい配線を増やさずに反映させる。
   */
  onLabelDeleted: () => void
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
function LabelPicker({ boardId, selectedLabelIds, onChange, onLabelDeleted }: Props) {
  // ラベル新規作成の折りたたみと入力欄。この状態がこのコンポーネント自身に閉じているため、
  // 呼び出し元（CardCreateForm等）がこのコンポーネントをアンマウントするだけで
  // （＝フォームを閉じるだけで）自動的に破棄される。個別にリセットするコードは不要。
  const [labelCreatorOpen, setLabelCreatorOpen] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0].hex)

  // 削除確認パネルの対象ラベル。nullなら非表示（＝どの削除ボタンも押されていない状態）。
  const [deleteTarget, setDeleteTarget] = useState<LabelResponse | null>(null)
  // 件数を取得中かどうか。件数そのもの（pendingCardCount）と分けて持つ必要がある。
  // countCardsForLabelは取得に失敗したときもnullを返すため、1つのstateで兼ねると
  // 「まだ取得中」と「取得できなかった」が区別できず、失敗したときに
  // 「確認しています…」の表示のまま永久に確定しない（hooks/useApi.tsがloadingとdataを
  // 分けて持っているのと同じ理由）。
  const [countingLabelCards, setCountingLabelCards] = useState(false)
  // 対象ラベルが使われているカードの枚数。取得できなかった場合はnull。
  const [pendingCardCount, setPendingCardCount] = useState<number | null>(null)

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

  // ラベル削除用のuseDelete。deleteTargetが未確定の間（＝確認パネルを開く前）は、
  // components/CardDetailModal.tsxのsave等と同じく、実害の無いプレースホルダー（空文字列）を
  // pathへ渡す（hooks/useDelete.tsのpath引数はuseCallbackの依存にしているだけで、
  // 実際に呼ばれるのはconfirmボタン押下時のremove()呼び出し時点のため、宣言時点で
  // 対象が確定していなくても問題ない）。
  const {
    remove: deleteLabel,
    submitting: deletingLabel,
    error: deleteLabelError,
  } = useDelete(deleteTarget === null ? '' : apiPaths.label(boardId, deleteTarget.id))

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

  /**
   * 指定したラベルが使われているカードの枚数を数える。削除確認パネルの文言
   * （「このラベルはX枚のカードで使われています」）に使う。
   * アーカイブ済みのカードも削除の影響（ラベルが外れる）を受けるため、非アーカイブ・
   * アーカイブ済みの両方を合算する（components/SortableBoardRow.tsxの
   * countCardsForDeleteConfirmと同じ発想・同じ実装パターン）。
   */
  async function countCardsForLabel(labelId: number): Promise<number | null> {
    try {
      const controller = new AbortController()
      const [active, archived] = await Promise.all([
        fetchJson<CardResponse[]>(
          apiPaths.cards({ boardId, labelIds: [labelId], archived: false }),
          controller.signal,
        ),
        fetchJson<CardResponse[]>(
          apiPaths.cards({ boardId, labelIds: [labelId], archived: true }),
          controller.signal,
        ),
      ])
      return active.length + archived.length
    } catch {
      // 件数の取得に失敗しても削除フロー自体は続行する（下のJSXが件数無しの汎用メッセージへ
      // フォールバックする）。件数が分からないことを理由に削除操作自体をブロックすると、
      // 件数取得用のGETがたまたま失敗しただけで本来できるはずの削除ができなくなる
      // （SortableBoardRow.tsxのcountCardsForDeleteConfirmと同じ判断）。
      return null
    }
  }

  function handleRequestDelete(label: LabelResponse) {
    setDeleteTarget(label)
    setCountingLabelCards(true)
    setPendingCardCount(null)
    void countCardsForLabel(label.id).then((count) => {
      setPendingCardCount(count)
      // 成功・失敗のどちらでも取得は終わっている。countがnullでも必ずfalseに戻すことで、
      // 「確認しています…」の表示から抜けられるようにする。
      setCountingLabelCards(false)
    })
  }

  function handleCancelDelete() {
    setDeleteTarget(null)
    setCountingLabelCards(false)
    setPendingCardCount(null)
  }

  async function handleConfirmDelete() {
    if (deleteTarget === null) return

    const ok = await deleteLabel()
    // removeは失敗時にfalseを返す（例外は投げない。hooks/useDelete.ts参照）。失敗時は
    // deleteLabelErrorに詳細が入るので、ここでは早期returnして確認パネルを開いたままにする
    // （閉じてしまうとエラーメッセージを表示する場所が無くなるため）。
    if (!ok) return

    const deletedId = deleteTarget.id
    setDeleteTarget(null)
    setCountingLabelCards(false)
    setPendingCardCount(null)
    refetchLabels()
    // 削除したラベルがこのカード（下書き）で選択済みだった場合、選択からも外す。外さないまま
    // 保存すると、CardService.create/updateの「存在しないラベルIDが含まれる」という400を招く。
    if (selectedLabelIds.includes(deletedId)) {
      onChange(selectedLabelIds.filter((id) => id !== deletedId))
    }
    onLabelDeleted()
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
        // gap をやや広めに取るのは、× がチップ右上へはみ出すぶん、隣のチップと重ならないようにするため。
        <div className="flex flex-wrap gap-x-2.5 gap-y-2 pt-1">
          {labels.map((label) => (
            // LabelToggleChip自体は<button>1個で成り立っており（<button>の入れ子はHTML上
            // 不可能）、この relative な枠の上に削除ボタンを絶対配置する。横並びだと「どの
            // ラベルの×か」が隣のチップと紛らわしいため、チップ右上に重ねて所属を示す。
            // LabelToggleChipはLabelFilterBar.tsx（検索画面の絞り込みUI）でも使われており、
            // そちらには削除UIを出したくないため、変更をLabelToggleChip自体には入れず
            // LabelPicker側に閉じている。
            <div key={label.id} className="relative">
              <LabelToggleChip
                label={label}
                selected={selectedLabelIds.includes(label.id)}
                onToggle={handleToggleLabel}
              />
              <button
                type="button"
                onClick={() => handleRequestDelete(label)}
                aria-label={`ラベル「${label.name}」を削除`}
                title="ラベルを削除"
                // -right / -top ではみ出させてチップ右上に乗せる。白地＋細い枠で、塗りつぶし
                // チップの上でも×が見えるようにする（色付き背景に直接置くとコントラストが落ちる）。
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] leading-none text-slate-500 shadow-sm hover:border-red-300 hover:bg-red-50 hover:text-red-600"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 削除確認パネル。要件5.5の「削除前に影響件数を示す」に対応する。ネイティブ<dialog>による
          モーダルにはしていない。CardDetailModal（既に<dialog>で開いている画面）からこの
          LabelPickerを使う場合、モーダルの中からさらにモーダルを開く「入れ子」構成になり、
          本プロジェクトにまだ無いパターンを持ち込むことになるため、あえてこの折りたたみパネルと
          同じ「フラグに応じてdiv要素を出し入れする」だけの、よりシンプルな方式に揃えた。 */}
      {deleteTarget !== null && (
        <div className="flex flex-col gap-2 rounded border border-red-200 bg-red-50 p-2 text-xs">
          {/* aria-live="polite"は、パネルを開いた「後で」件数が確定してこの文が書き換わることを
              支援技術へ伝えるため。要素は開いた時点から存在し、後からテキストだけが差し替わる。 */}
          <p aria-live="polite">
            「{deleteTarget.name}」を削除しますか？
            {countingLabelCards
              ? ' 使用状況を確認しています…'
              : pendingCardCount === null
                ? // 件数の取得に失敗したときのフォールバック。件数は言えないが「削除すると
                  // カードからラベルが外れる」という結果自体は変わらないので、それだけを伝える
                  // （components/SortableBoardRow.tsxが件数を数えられなかったときと同じ考え方）。
                  ' 使用状況は確認できませんでしたが、削除すると、このラベルが付いているカードからは自動的に外れます。'
                : pendingCardCount > 0
                  ? ` このラベルは${pendingCardCount}枚のカードで使われています。削除すると、これらのカードから自動的に外れます。`
                  : ' このラベルはどのカードにも使われていません。'}
            この操作は取り消せません。
          </p>
          {deleteLabelError !== null && <StatusMessage kind="error">{deleteLabelError.message}</StatusMessage>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmDelete}
              // 件数取得中（countingLabelCards）でも、取得に失敗した後（pendingCardCountがnull）でも、
              // このボタン自体は非活性にしない。countCardsForLabelと同じ「件数が分からないことを
              // 理由に削除操作をブロックしない」という判断（SortableBoardRow.tsx参照）。
              disabled={deletingLabel}
              className="cursor-pointer rounded bg-red-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {deletingLabel ? '削除中…' : '削除する'}
            </button>
            <button
              type="button"
              onClick={handleCancelDelete}
              className="cursor-pointer rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              キャンセル
            </button>
          </div>
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
              className="cursor-pointer rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
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
              className="cursor-pointer rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
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
          className="cursor-pointer self-start text-xs text-blue-600 hover:underline"
        >
          ＋ 新しいラベルを作成
        </button>
      )}
    </div>
  )
}

export default LabelPicker
