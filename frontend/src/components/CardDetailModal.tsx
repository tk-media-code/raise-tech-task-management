import { useEffect } from 'react'
import { apiPaths } from '../api/client'
import { useApi } from '../hooks/useApi'
import { STATUS_LABELS } from '../lib/status'
import type { CardResponse } from '../types/api'
import DueDateBadge from './DueDateBadge'
import LabelChip from './LabelChip'
import StatusMessage from './StatusMessage'

type Props = {
  /** 表示するカードのID。nullなら閉じている状態 */
  cardId: number | null
  /** モーダルを閉じるとき（× ／背景クリック／Escape）に呼ばれる */
  onClose: () => void
}

/**
 * カード詳細モーダル（要件定義 6.2 ④）。
 * タイトル・ボード名・ステータス・説明・期日・ラベルを表示する。
 *
 * 現時点は閲覧専用。編集・アーカイブ・削除は書き込みAPI（POST/PUT/DELETE）が
 * 未実装のため、ボタン自体を置いていない（押せても何も起きないボタンを置くより、
 * 「無い」ことが見て分かる方が誤解が少ない）。
 *
 * 一覧（CrossBoardView・BoardDetailView）が既に持っているカードの情報を使い回さず、
 * 開くたびに GET /api/cards/{id} を再取得している。理由は3つ:
 * (1) 一覧は archived=false で絞り込んだ結果であり、将来アーカイブ画面・検索結果画面
 *     からもこの同じモーダルを開く必要がある（CardController.get はアーカイブ済みカードも
 *     返せる設計になっている）。id指定の取得だけが、その両方の画面で通用する。
 * (2) 書き込みAPI実装後は一覧が数秒古くなり得る。
 * (3) useApiのpath===null（＝通信しない）という設計を実際に使う唯一の場所であり、
 *     ここで使わないとその設計が机上のものになってしまう。
 */
function CardDetailModal({ cardId, onClose }: Props) {
  // フックは「毎回まったく同じ順序で同じ回数」呼ばれる必要がある。
  // そのため、閉じているとき（cardId===null）に早期returnするのは
  // すべてのフックを呼び終えたあと。フックより前にreturnすると、
  // 開閉のたびにフックの呼び出し数が変わり、Reactが状態を取り違えてしまう
  // （.oxlintrc.json の react/rules-of-hooks が error でこれを検出する）。
  //
  // useApiにnullを渡すと通信しない。閉じているあいだ無駄なリクエストが飛ばず、
  // 開いた瞬間にだけ GET /api/cards/{id} が走る。
  const { data: card, loading, error } = useApi<CardResponse>(
    cardId === null ? null : apiPaths.card(cardId),
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
          {/* 読み込み中はタイトルがまだ無いので、枠だけ先に見せる */}
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

          {/* cardがnullでないときだけ中身を描く。`&&`の左辺がnullやfalseだとReactは
              何も描画しないが、左辺が数値の0だと画面に「0」がそのまま出てしまう
              （Reactでよくあるバグ）。ここはboolean判定なので問題ない。 */}
          {card !== null && (
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-semibold text-slate-500">ボード</dt>
                <dd>{card.boardName}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">ステータス</dt>
                <dd>{STATUS_LABELS[card.status]}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">説明・メモ</dt>
                {/* whitespace-pre-wrap: DBに入っている改行をそのまま表示する。
                    JSXは文字列をテキストとして描画するので、HTMLタグとして解釈されない
                    （prototype/app.jsのescapeHtml相当を自分で書く必要はない）。 */}
                <dd className="whitespace-pre-wrap text-slate-700">
                  {card.description ?? <span className="text-slate-400">（未設定）</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">期日</dt>
                <dd>
                  {card.dueDate === null ? (
                    <span className="text-slate-400">（未設定）</span>
                  ) : (
                    <DueDateBadge dueDate={card.dueDate} />
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">ラベル</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {card.labels.length === 0 ? (
                    <span className="text-slate-400">（なし）</span>
                  ) : (
                    card.labels.map((label) => <LabelChip key={label.id} label={label} />)
                  )}
                </dd>
              </div>
            </dl>
          )}
        </div>

        <footer className="border-t border-slate-200 p-4 text-xs text-slate-400">
          ※ 現時点では閲覧のみです。編集・アーカイブ・削除は書き込みAPIの実装後に対応します。
        </footer>
      </div>
    </div>
  )
}

export default CardDetailModal
