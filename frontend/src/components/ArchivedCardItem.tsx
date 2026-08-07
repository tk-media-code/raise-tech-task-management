import { useState } from 'react'
import { apiPaths } from '../api/client'
import { useDelete } from '../hooks/useDelete'
import { useMutation } from '../hooks/useMutation'
import { STATUS_LABELS } from '../lib/status'
import type { CardArchiveUpdateRequest, CardResponse } from '../types/api'
import ConfirmDialog from './ConfirmDialog'
import DueDateBadge from './DueDateBadge'
import LabelChip from './LabelChip'
import StatusMessage from './StatusMessage'

type Props = {
  card: CardResponse
  /** 行がクリックされたとき（カード詳細モーダルを開くため）に呼ばれる */
  onSelect: (cardId: number) => void
  /** 「復元」に成功したとき（一覧の再取得を親に依頼するため）に呼ばれる */
  onRestored: () => void
  /**
   * 「完全削除」に成功したとき（一覧の再取得を親に依頼するため）に呼ばれる。
   * 今のところ親（pages/ArchiveView.tsx）はonRestoredと同じrefetchを渡すが、あえて
   * コールバックを分けている。components/SortableBoardRow.tsxがボード削除のときに
   * onChangedとonDeletedを分けているのと同じ考え方で、呼び出し側から見て「この行が
   * 復元と削除の両方をできる」ことがpropsの名前だけで読み取れるようにするため。
   */
  onDeleted: () => void
}

/**
 * アーカイブ一覧の1行（要件定義 6.2 ⑥）。
 *
 * useMutation・useDeleteはどちらも呼び出された時点のpathを固定するフックのため、一覧全体で
 * 1つのmutate・removeを使い回すと「どの行の『復元』『完全削除』を押しても同じcard.idへ
 * 送られる」事故になる。components/CardItem.tsxの「移動」メニューと同じ理由で、行ごとに
 * このコンポーネントへ切り出し、各自が自分のcard.idに対するuseMutation・useDeleteを持つ
 * ようにしている。
 */
function ArchivedCardItem({ card, onSelect, onRestored, onDeleted }: Props) {
  const { mutate: restore, submitting: restoring, error: restoreError } = useMutation<
    CardArchiveUpdateRequest,
    CardResponse
  >('PATCH', apiPaths.updateCardArchive(card.id))
  // 完全削除（DELETE /api/cards/{id}）。apiPaths.card()はGET（詳細取得）・PUT（編集）と
  // 同じURL文字列を返す関数だが、専用のパス関数は新設しない。apiPaths.boardがGET/PUT/DELETEを
  // 兼ねているのと同じ流儀で、URLが同じ以上、別名の関数を分ける理由が無いため（api/client.ts参照）。
  const { remove: deleteCard, submitting: deleting, error: deleteError } = useDelete(apiPaths.card(card.id))

  // 完全削除の確認ダイアログを開いているか。以前はwindow.confirm()で確認していたが、
  // ブラウザ側の設定で標準ダイアログが黙って無効化され得ることが分かったため、
  // アプリ内のダイアログ（components/ConfirmDialog.tsx）へ移した。
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleRestore() {
    const updated = await restore({ archived: false })
    // restoreは失敗時にnullを返す（例外は投げない。hooks/useMutation.ts参照）。
    if (updated === null) return
    onRestored()
  }

  function handleDeleteClick() {
    // ボード削除（components/SortableBoardRow.tsx）と違い、巻き込まれて消える件数を先に
    // 数えるGETは不要——消えるのはこのカード1枚とラベルとの結び付き（card_label）だけで、
    // ラベル自体は残るため、件数という概念がそもそも無い。よってここは開くだけでよい。
    setConfirmOpen(true)
  }

  async function handleConfirmDelete() {
    // removeは失敗時にfalseを返す（例外は投げない。hooks/useDelete.ts参照）。失敗時は
    // 早期returnしてダイアログを開いたままにする。閉じてしまうとエラーメッセージの
    // 表示先が無くなるため（components/LabelPicker.tsxのhandleConfirmDeleteと同じ判断）。
    if (!(await deleteCard())) return

    setConfirmOpen(false)

    // 消えた行をローカルのstateから取り除く楽観的更新はしない。この一覧の中身を決めているのは
    // サーバー側の絞り込み（archived=true）であり、onDeleted（= pages/ArchiveView.tsxのrefetch）で
    // 取り直すほうが「画面からは消えたのにDBには残っている」というズレが原理的に起こらない。
    onDeleted()
  }

  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      {/* タイトル・メタ情報と操作ボタンを横並びにし、ボタン行で高さが増えないようにする */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onSelect(card.id)}
          className="min-w-0 flex-1 cursor-pointer text-left"
        >
          <p className="text-sm font-medium text-slate-800">{card.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {/* 元のボード・ステータスを明示する（SearchResultItem.tsxと同じ理由：この画面には
                「どの列を見ているか」という前後関係が無いため、行の中に文脈を書く必要がある）。
                ワイヤーフレーム6.2⑥の「元: 仕事」表記に合わせ、ステータスも併記する。 */}
            <span>
              元: {card.boardName} / {STATUS_LABELS[card.status]}
            </span>
            {card.dueDate !== null && <DueDateBadge dueDate={card.dueDate} />}
            {card.labels.map((label) => (
              <LabelChip key={label.id} label={label} />
            ))}
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {/* ワイヤーフレーム6.2⑥の並び[復元][完全削除]に合わせる。取り消せる操作（復元）を左、
              取り消せない操作（完全削除）を右に置く配置は、SortableBoardRow.tsxの改名・削除の
              並びとも揃っている。 */}
          <button
            type="button"
            onClick={handleRestore}
            // 復元中だけでなく削除中も無効化する。どちらの操作でもこの行は一覧から消えるため、
            // 両方を同時に走らせても後から届いたほうが必ず404になるだけ（二重送信防止と同じ考え方）。
            disabled={restoring || deleting}
            className="cursor-pointer rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {restoring ? '復元中…' : '復元'}
          </button>
          <button
            type="button"
            onClick={handleDeleteClick}
            disabled={deleting || restoring}
            // 取り消せない操作であることが見た目でも分かるよう、SortableBoardRow.tsxの「削除」
            // ボタンと同じ赤系の配色にする。
            className="cursor-pointer rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
          >
            {deleting ? '削除中…' : '完全削除'}
          </button>
        </div>
      </div>
      {restoreError !== null && <StatusMessage kind="error">{restoreError.message}</StatusMessage>}

      {/* 削除のエラーはここではなく確認ダイアログの中に出す（ConfirmDialogのerror）。
          失敗しても操作の文脈（何を消そうとしていたか）が画面に残っているほうが、
          再試行するのかやめるのかを判断しやすいため。復元にはその文脈が無いので上に残す。
          閉じているあいだのConfirmDialogは何も描画しないので、この行の見た目には影響しない。 */}
      <ConfirmDialog
        open={confirmOpen}
        title="カードの完全削除"
        confirmLabel="完全に削除する"
        submittingLabel="削除中…"
        submitting={deleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onClose={() => setConfirmOpen(false)}
      >
        <p>「{card.title}」をアーカイブから完全に削除します。</p>
        <p>この操作は取り消せません。よろしいですか？</p>
      </ConfirmDialog>
    </div>
  )
}

export default ArchivedCardItem
