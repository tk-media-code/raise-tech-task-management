import { STATUSES, STATUS_LABELS } from '../lib/status'
import type { CardStatus } from '../types/api'

type Props = {
  /** 現在表示中（選択中）のタブ */
  activeStatus: CardStatus
  /** タブのラベルに付ける件数。呼び出し側が算出したものをそのまま渡す */
  countsByStatus: Record<CardStatus, number>
  /** タブがクリックされたとき、そのタブのステータスを引数に呼ばれる */
  onSelect: (status: CardStatus) => void
}

/**
 * スマートフォン幅（768px未満）専用のステータス切り替えタブ（要件定義8.1、
 * prototype/app.js の buildMobileTabsHtml/switchMobileTabに対応する挙動）。
 * md以上（768px以上）では3列が横並びで常に全部見えるため、このコンポーネント
 * 自体をまるごと非表示にする（ルート要素のmd:hidden）。
 *
 * 選択状態は排他的（3つのうち必ず1つだけがアクティブ）なので、複数選択可能な
 * トグルボタン群（components/LabelToggleChip.tsxのaria-pressed）とは意味が異なり、
 * ARIAのタブパターン（role="tablist"/"tab"、aria-selected）を使う
 * （docs/react/12-dialog-accessibility.md 36章参照）。矢印キーでのタブ間移動・
 * roving tabindexは実装していない——3つとも通常の<button>なのでTabキーで個別に
 * フォーカスでき、Enter/Spaceで選択できるため、キーボード操作の手段自体は既に
 * 確保できている（LabelToggleChip.tsxが単純なaria-pressedボタン群に留めているのと
 * 同じ判断）。
 */
function MobileStatusTabs({ activeStatus, countsByStatus, onSelect }: Props) {
  return (
    <div className="mb-4 flex gap-1.5 md:hidden" role="tablist" aria-label="ステータス切り替え">
      {STATUSES.map((status) => {
        const isActive = status === activeStatus
        return (
          <button
            key={status}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(status)}
            // 選択中はCardCreateForm等の主要アクションボタンと同じ塗り色（bg-blue-600）、
            // 非選択はヘッダーのボタン（例: App.tsxの「ボード管理」）と同じ枠線スタイルに揃える。
            className={`flex-1 cursor-pointer rounded border px-2 py-1.5 text-center text-sm font-semibold transition ${
              isActive
                ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {STATUS_LABELS[status]} ({countsByStatus[status]})
          </button>
        )
      })}
    </div>
  )
}

export default MobileStatusTabs
