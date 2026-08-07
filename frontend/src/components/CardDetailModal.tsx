import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { apiPaths } from '../api/client'
import { useApi } from '../hooks/useApi'
import { useMutation } from '../hooks/useMutation'
import { isCardStatus, STATUSES, STATUS_LABELS } from '../lib/status'
import type { CardArchiveUpdateRequest, CardResponse, CardStatus, CardStatusUpdateRequest, CardUpdateRequest } from '../types/api'
import DueDateBadge from './DueDateBadge'
import LabelPicker from './LabelPicker'
import StatusMessage from './StatusMessage'

type Props = {
  /** 表示するカードのID。nullなら閉じている状態 */
  cardId: number | null
  /** 保存・ステータス変更に成功したとき（一覧の再取得を親に依頼するため）に呼ばれる */
  onUpdated: () => void
  /** モーダルを閉じるとき（× ／背景クリック／Escape／保存やアーカイブの完了）に呼ばれる */
  onClose: () => void
}

/**
 * カード詳細モーダル（要件定義 6.2 ④）。
 * タイトル・ステータス・説明・期日・ラベルを編集し、要件5.2「カード詳細を開き、説明・期日・
 * ラベルを追加/変更できる」に対応する。フッターの「アーカイブ」／「復元」ボタンは要件5.7に対応する。
 *
 * 「削除」ボタンはこのモーダルには置いていない。DELETE /api/cards/{id} 自体は実装済みだが、
 * サーバー側（CardService.delete）が「アーカイブ済みのカードのみ削除できる」という制約を
 * 持つため、ボード詳細・横断ビュー・検索結果（このモーダルを開ける残りすべての画面。
 * いずれもarchived=falseで取得している）から開いたときは、常に押せないボタンになってしまう。
 * 押せるのはアーカイブ画面から開いたときだけであり、その画面には行に「完全削除」ボタンが
 * 既にある（components/ArchivedCardItem.tsx）ため、ここに重複して置く価値が無いという判断。
 * 要件定義03-screens.mdのワイヤーフレーム6.2④にある[アーカイブ][削除]は、削除をアーカイブ
 * 済み限定にする前の図であり、この判断で読み替える。
 *
 * タイトル・ステータス・説明・期日・ラベルの5項目とも「保存」ボタンを押すまでサーバーへ
 * 送らない（CardCreateFormと同じ、ドラフトを溜めてから確定するフォーム）。以前はステータスだけ
 * <select>を変更した瞬間にPATCHを送る特別扱いだったが、1つのフォームの中に「即座に確定する
 * 項目」と「保存待ちの項目」が混在すると「保存」の対象範囲が曖昧になるため、他の4項目と
 * 同じ下書きに統一した。
 *
 * サーバー側のAPIは従来どおり2本のまま（PUT /api/cards/{id} と PATCH /api/cards/{id}/status。
 * CardUpdateRequestにstatusフィールドを持たせていないのは「ボード間移動はスコープ外、
 * ステータス変更は別APIの責務」という設計のため）。「保存」を押すとPUTを送り、成功かつ
 * ステータスが変更されている場合に限ってPATCHも続けて送る（handleSubmit参照。「変更されて
 * いる場合に限って」は正しさの条件であり最適化ではない。理由はhandleSubmit内のコメント参照）。
 *
 * 要件5.3が求める「選んだ瞬間に即座に切り替わる」操作は、このモーダルではなく
 * ドラッグ＆ドロップ（hooks/useCardDragAndDrop.ts）とスマートフォン限定の「移動▾」メニュー
 * （CardItem.tsx）が引き続き担う。どちらもこのモーダルとは別のuseMutationインスタンス・
 * 別のハンドラを持つ独立した呼び出し元であり、この変更の影響を受けない。
 *
 * 一覧（CrossBoardView・BoardDetailView・SearchView）が既に持っているカードの情報を使い回さず、
 * 開くたびに GET /api/cards/{id} を再取得している。理由は3つ:
 * (1) 一覧は archived=false で絞り込んだ結果であり、将来アーカイブ画面・検索結果画面
 *     からもこの同じモーダルを開く必要がある（CardController.get はアーカイブ済みカードも
 *     返せる設計になっている）。id指定の取得だけが、その両方の画面で通用する。
 * (2) 他の操作で一覧が数秒古くなり得る。
 * (3) useApiのpath===null（＝通信しない）という設計を実際に使う唯一の場所であり、
 *     ここで使わないとその設計が机上のものになってしまう。
 */
function CardDetailModal({ cardId, onUpdated, onClose }: Props) {
  // フックは「毎回まったく同じ順序で同じ回数」呼ばれる必要がある。
  // そのため、閉じているとき（cardId===null）に早期returnするのは
  // すべてのフックを呼び終えたあと。フックより前にreturnすると、
  // 開閉のたびにフックの呼び出し数が変わり、Reactが状態を取り違えてしまう
  // （.oxlintrc.json の react/rules-of-hooks が error でこれを検出する）。
  //
  // useApiにnullを渡すと通信しない。閉じているあいだ無駄なリクエストが飛ばず、
  // 開いた瞬間にだけ GET /api/cards/{id} が走る。
  const cardPath = cardId === null ? null : apiPaths.card(cardId)
  const { data: card, loading, error, refetch } = useApi<CardResponse>(cardPath)

  // タイトル・説明・期日・ラベルの下書き（「保存」を押すまでサーバーには送らない編集中の値）。
  // useStateの初期値ではなく下のuseEffectで詰めるのは、cardが「開いた直後はnull、
  // GET完了後に値が入る」という2段階を経るため（useStateの初期値は初回レンダリング時にしか
  // 使われず、あとから届くcardの値を反映できない）。
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [labelIds, setLabelIds] = useState<number[]>([])
  // ステータスも他の4項目と同じ下書き。型引数<CardStatus>を明示しないと初期値'todo'から
  // string型と推論され、後段のchangeStatus({ status })に渡せなくなる。初期値の'todo'は
  // title=''・labelIds=[]と同じ意味のないプレースホルダーで、cardが届いた時点で
  // 下のuseEffectが正しい値へ差し替える（フォーム自体もcard !== nullの間しか描画されない）。
  const [status, setStatus] = useState<CardStatus>('todo')

  useEffect(() => {
    if (card === null) return
    setTitle(card.title)
    setDescription(card.description ?? '')
    setDueDate(card.dueDate ?? '')
    setLabelIds(card.labels.map((label) => label.id))
    setStatus(card.status)
    // 依存配列はcard（オブジェクト）自体。cardIdだけを見ていると、同じカードを開いたまま
    // 「保存」してcardが再取得された（＝新しいオブジェクトになった）ときにフォームへ
    // 反映し直されない。サーバー側の正規化後の値（titleのtrimなど）を表示に反映するためにも、
    // card自体の変化を捉える必要がある。
  }, [card])

  // カード編集（PUT）。cardIdがnullの間（モーダルが閉じている間）はmutateを呼ぶボタン自体が
  // 描画されないため、pathには実害の無いプレースホルダー（空文字列）を渡す
  // （hooks/useMutation.tsのpath引数のコメント参照）。
  const { mutate: save, submitting: saving, error: saveError } = useMutation<CardUpdateRequest, CardResponse>(
    'PUT',
    cardId === null ? '' : apiPaths.card(cardId),
  )

  // ステータス変更（PATCH）。<select>の変更時点では呼ばず、handleSubmitが「保存」時に
  // 下書きstatusとcard.statusを比べて必要な場合だけ呼ぶ（このコンポーネントのdocblock参照）。
  // 位置（position）はここでは送らない＝常に移動先列の末尾へ置く。列内の並び替えという
  // 細かい制御はドラッグ＆ドロップ側の役割で、このセレクトボックスは
  // 「とりあえずステータスだけ動かす」簡易な手段として割り切っている。
  const {
    mutate: changeStatus,
    submitting: changingStatus,
    error: statusError,
  } = useMutation<CardStatusUpdateRequest, CardResponse>(
    'PATCH',
    cardId === null ? '' : apiPaths.updateCardStatus(cardId),
  )

  // アーカイブ状態の変更（PATCH）。「アーカイブする」「復元する」のどちらもこの1つのmutateで
  // 扱う（types/api.ts CardArchiveUpdateRequestの分岐と同じ）。ボタン側は現在のcard.isArchivedを
  // 見て、送る値（true/false）とラベルの両方をその場で決める。
  const {
    mutate: changeArchived,
    submitting: archiving,
    error: archiveError,
  } = useMutation<CardArchiveUpdateRequest, CardResponse>(
    'PATCH',
    cardId === null ? '' : apiPaths.updateCardArchive(cardId),
  )

  useEffect(() => {
    if (cardId === null) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    // モーダル自身ではなくdocumentに登録するのは、フォーカスがモーダル内の
    // どの要素にあってもEscapeを拾えるようにするため。
    document.addEventListener('keydown', handleKeyDown)

    // 後片付け。これを書き忘れると、モーダルを開閉するたびにリスナーが積み上がり、
    // Escape1回で閉じる処理が何度も走る（＝典型的なメモリリーク／二重実行バグ）になる。
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [cardId, onClose])
  // onCloseを依存配列に入れているのは、useEffectのルールとして「エフェクト内で
  // 使っている値は依存配列に書く」ことが求められるため。呼び出し元（各ページ）で
  // onCloseの実体（setSelectedCardId(null)を呼ぶ関数）を毎レンダリング作り直しても、
  // 中身は同じなのでここでは実害が無い（新しい関数として登録し直されるだけ）。

  if (cardId === null) return null

  const titleTrimmed = title.trim()
  // 「保存」は最大2本のリクエスト（PUT→PATCH）を順に送るため、送信中かどうかは
  // 両方のフラグを合わせて判断する。
  const submitting = saving || changingStatus

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // ブラウザ標準のフォーム送信（ページ全体のリロードを伴う）を止め、
    // 代わりにfetchによる非同期送信（useMutationのsave）に置き換える。
    event.preventDefault()

    // cardがnullの間はこのフォーム自体が描画されない（下のJSXの{card !== null && ...}）ため
    // 実際には必ず値が入っているが、TypeScriptはその絞り込みをこの関数の中まで
    // 持ち込んでくれない（handleArchiveToggleと同じ理由の型ガード）。
    if (card === null) return

    const updated = await save({
      title: titleTrimmed,
      // 空文字列とnullをどちらも「未設定」として扱うのはバックエンド（CardService.normalizeDescription）
      // と同じ判断。CardCreateForm.handleSubmitと同じ正規化。
      description: description.trim() === '' ? null : description.trim(),
      dueDate: dueDate === '' ? null : dueDate,
      labelIds,
    })
    // saveは失敗時にnullを返す（例外は投げない。hooks/useMutation.ts参照）。
    // 失敗時はsaveErrorに詳細が入っているので、ここでは早期returnして
    // フォームの入力内容をそのまま残す。
    if (updated === null) return

    // ステータスだけはPUTでは更新できない（types/api.ts CardUpdateRequestにstatusフィールドが
    // 無い設計）ため、変更されている場合に限って専用のPATCHを続けて送る。
    //
    // 「変更されている場合に限って」は通信量の最適化ではなく正しさの条件である。このPATCHは
    // positionを送らないため、バックエンド（CardService.updateStatus）は移動先列の末尾へ
    // カードを置く。移動先が現在と同じ列でも同じ処理が走るので、無条件に送ると
    // 「タイトルを直しただけの保存」でカードが自分の列の一番下へ動いてしまう。
    if (status !== card.status) {
      const statusUpdated = await changeStatus({ status })
      if (statusUpdated === null) {
        // ステータス変更だけ失敗。この時点でPUTは既に成功しているため、その分（タイトル・
        // 説明・期日・ラベル）は呼び出し元の一覧・このモーダル自身の両方へ反映しつつ、
        // モーダルは閉じずに開いたままにする。refetch()がサーバーの実際の状態（保存された
        // title等・変更されなかったstatus）へ<select>を含む表示全体を揃え直し、statusErrorが
        // その直下に表示されるので、ユーザーはそれを見て「保存」を押し直せる。
        // 「全項目の保存に成功したときだけ閉じる」という下のonClose()の方針はここでも変わらない。
        refetch()
        onUpdated()
        return
      }
    }

    // ここへ到達するのは、タイトル等（PUT）と、変更されていればステータス（PATCH）の
    // 両方の保存に成功した場合のみ。要件5.4「横断ビュー上でカードを編集…すると、元のボード
    // 詳細画面にも反映される」を満たすため、呼び出し元（一覧を持つページ）には再取得を
    // 依頼するが、このモーダル自身のcard（useApi）は再取得しない。直後のonClose()で
    // このモーダル自体がアンマウントされ、取得結果を表示する機会が無いため
    // （handleArchiveToggleがrefetch()を呼ばないのと同じ理由）。
    onUpdated()
    onClose()
  }

  function handleStatusChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextStatus = event.target.value
    // <select>のvalueは実行時にはただの文字列で、CardStatusであることをTypeScriptは
    // 保証してくれない（lib/status.tsのisCardStatusと同じ注意点）。ここでは
    // STATUSES.map(...)から生成した<option>しか存在しないため実際には常にtrueになるが、
    // 型を通すための型ガードとして扱う。
    if (!isCardStatus(nextStatus)) return

    // 他の項目と同じく、ここでは下書きを更新するだけ。サーバーへ送るのはhandleSubmit。
    setStatus(nextStatus)
  }

  async function handleArchiveToggle() {
    if (card === null) return

    const updated = await changeArchived({ archived: !card.isArchived })
    if (updated === null) return

    // アーカイブ・復元のどちらでも、このカードは今開いている一覧（ボード表示・横断ビュー・
    // アーカイブ一覧のいずれか）から消える。そのためrefetch()でこのモーダル自身を
    // 最新化する意味が無く（消えた側の一覧にはもう出てこない）、他の操作と違ってonClose()まで行う。
    onUpdated()
    onClose()
  }

  return (
    <div
      // fixed inset-0: 画面全体を覆うオーバーレイ。z-50で他の要素より前面に出す。
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8"
      // 背景クリックで閉じる。event.target（実際にクリックされた要素）と
      // event.currentTarget（このハンドラが付いている要素＝このdiv自身）が
      // 一致するときだけ閉じる、という判定にしている。モーダル本体側で
      // stopPropagation()する方法もあるが、あちらはイベントの伝播そのものを
      // 止めてしまい、将来の別機能（ドキュメント全体を監視したいクリックなど）を
      // 壊しかねない。こちらは「自分が直接クリックされたか」を見るだけなので副作用がない。
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="カード詳細"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
          {/* 読み込み中はタイトルがまだ無いので、枠だけ先に見せる。
              入力中の下書き（title state）ではなく取得済みのcard.titleを表示するのは、
              「保存」前の見出しは常に確定済みの値を示すべきという判断による。 */}
          <h2 className="text-base font-bold">{card?.title ?? 'カード詳細'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded px-2 text-lg leading-none text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </header>

        <div className="space-y-4 p-4 text-sm">
          {loading && <StatusMessage kind="loading">読み込み中…</StatusMessage>}
          {error !== null && (
            <StatusMessage kind="error">読み込みに失敗しました：{error.message}</StatusMessage>
          )}

          {/* cardがnullでないときだけ編集フォームを描く。読み込み中・保存後の再取得中は
              一瞬cardがnullに戻る（hooks/useApi.tsの仕様）ため、その間はフォームごと消える
              （BoardDetailView等が新規作成後の再取得中に3列を一時的に隠すのと同じ挙動）。 */}
          {card !== null && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="text-xs text-slate-500">ボード：{card.boardName}</p>

              <div>
                <label htmlFor="card-detail-title" className="text-xs font-semibold text-slate-500">
                  タイトル
                </label>
                <input
                  id="card-detail-title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={200}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="card-detail-status" className="text-xs font-semibold text-slate-500">
                  ステータス
                </label>
                <select
                  id="card-detail-status"
                  // 他の項目と同じく下書きstateに紐づける（このコンポーネントのdocblock参照）。
                  value={status}
                  onChange={handleStatusChange}
                  // アーカイブ済みのカードはバックエンド（CardService.updateStatus）が400で弾く。
                  // 選べてしまってから保存時にエラーを見せるのではなく、操作自体を塞いで
                  // 下のヒント文で理由を伝える（アーカイブ画面からもこのモーダルは開ける）。
                  disabled={submitting || card.isArchived}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                >
                  {/* mapの引数名をstatusにすると、上で定義した下書きstate変数のstatusを
                      覆い隠して紛らわしいため、optionという別名にする（中身は同じくCardStatus）。 */}
                  {STATUSES.map((option) => (
                    <option key={option} value={option}>
                      {STATUS_LABELS[option]}
                    </option>
                  ))}
                </select>
                {/* PATCH失敗直後のrefetch()で下書きstatusはサーバーの値へ戻る。そのため
                    「失敗したままステータスに触れず他の項目だけ直して再保存した」場合、
                    上のガード（handleSubmit内のstatus !== card.status）によりPATCHが再送されず、
                    このエラーは次にchangeStatusが呼ばれるまで残り続ける（useMutationのerrorは
                    次のmutate開始時にしかクリアされない。hooks/useMutation.ts参照）。表示中の
                    <select>の値自体は常に正しいため実害は「古いエラー文が残る」ことだけであり、
                    この程度でuseMutationへリセット手段を足すことはしない。 */}
                {statusError !== null && (
                  <StatusMessage kind="error">{statusError.message}</StatusMessage>
                )}
                {/* <select>をdisabledにしただけでは「なぜ選べないのか」が分からないため、
                    復元すれば変更できることまで書き添える（要件定義5.7の復元導線への案内）。 */}
                {card.isArchived && (
                  <p className="mt-1 text-xs text-slate-500">
                    アーカイブ済みのカードはステータスを変更できません。復元すると変更できます。
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="card-detail-description" className="text-xs font-semibold text-slate-500">
                  説明・メモ
                </label>
                <textarea
                  id="card-detail-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  // バックエンドのDTO（CardUpdateRequestの@Size(max = 2000)）と同じ値。
                  // タイトルのmaxLength={200}と同じ考え方で、送信してから400で弾かれるより
                  // 入力の時点で打ち止めにする。
                  maxLength={2000}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="card-detail-due-date" className="text-xs font-semibold text-slate-500">
                  期日
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id="card-detail-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                  {/* 編集中の下書き（dueDate）に対して、期限切れ/期限間近をその場で示す
                      （要件5.6）。ワイヤーフレーム6.2④の「期日: 🔴 2026/07/15」に対応する。 */}
                  {dueDate !== '' && <DueDateBadge dueDate={dueDate} />}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500">ラベル</p>
                <div className="mt-1">
                  <LabelPicker boardId={card.boardId} selectedLabelIds={labelIds} onChange={setLabelIds} />
                </div>
              </div>

              {saveError !== null && <StatusMessage kind="error">{saveError.message}</StatusMessage>}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  // 要件5.2と同じ「タイトルが未入力の間は押せない」という考え方をここにも適用する。
                  disabled={titleTrimmed === '' || submitting}
                  title={titleTrimmed === '' ? 'タイトルを入力してください' : undefined}
                  className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                >
                  {submitting ? '保存中…' : '保存'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* cardがnullの間（読み込み中）はisArchivedを参照できずボタンのラベルを決められないため、
            フォーム本体と同じくcard !== nullの間だけ描画する。 */}
        {card !== null && (
          <footer className="flex items-center justify-between gap-3 border-t border-slate-200 p-4">
            <button
              type="button"
              onClick={handleArchiveToggle}
              // 「完了」ステータスのカードのみアーカイブできる（プロトタイプprototype/app.jsの
              // populateCardModalと同じ業務ルール。バックエンドCardService.updateArchivedも
              // 同じ制約を検証しており、ここでの無効化はサーバーへの無駄なリクエストを防ぐための
              // 先回りに過ぎない）。復元（isArchived=trueから戻す）にはこの制約が無い。
              // disabledの判定はcard.status（サーバーに永続化されている値）で行う。アーカイブは
              // 「保存」を経由しない独立した即時操作であり、バックエンドも永続化された値しか
              // 見ないため、活性・非活性はドラフトではなくサーバー側の実際の値に合わせる。
              disabled={archiving || (!card.isArchived && card.status !== 'done')}
              title={
                !card.isArchived && card.status !== 'done'
                  ? // ただしツールチップの文言だけはドラフトのstatusも見る。そうしないと、
                    // <select>で「完了」を選んだ直後（まだ保存前）もボタンは無効のままなのに
                    // 「完了ステータスのカードのみアーカイブできます」という、選んだ内容と
                    // 矛盾する文言が出続けてしまう。
                    status === 'done'
                    ? 'ステータスの変更を「保存」してからアーカイブできます'
                    : '完了ステータスのカードのみアーカイブできます'
                  : undefined
              }
              className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {archiving ? '処理中…' : card.isArchived ? '復元' : 'アーカイブ'}
            </button>
            {archiveError !== null && (
              <StatusMessage kind="error">{archiveError.message}</StatusMessage>
            )}
          </footer>
        )}
      </div>
    </div>
  )
}

export default CardDetailModal
