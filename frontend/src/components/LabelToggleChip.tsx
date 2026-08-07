import type { CSSProperties } from 'react'
import { getContrastTextColor } from '../lib/color'
import type { LabelResponse } from '../types/api'

type Props = {
  label: LabelResponse
  /** このラベルが現在選択されているか（検索画面では絞り込み条件、カード作成では付与予定） */
  selected: boolean
  /** クリックされたとき（選択⇔解除のトグル）に呼ばれる */
  onToggle: (labelId: number) => void
}

/**
 * 選択状態を持つトグル可能なラベルチップ。
 * 検索画面（要件5.8）のラベル絞り込みUIと、カード作成フォーム（要件5.2）のラベル選択UIの
 * 2箇所で使う共通コンポーネント（もとは検索画面専用のLabelFilterChipという名前だったが、
 * カード作成フォームでも同じ見た目・同じトグル動作が必要になったため、
 * 「絞り込み専用」を含意しない名前へリネームして共有した。lib/color.tsのgetContrastTextColorが
 * 「2人目の利用者が現れた時点でlib/へ昇格する」判断をしたのと同じ考え方）。
 *
 * 表示専用の`LabelChip`（`<span>`）とは異なり、これは押せる`<button>`で、
 * 選択中かどうかで見た目が変わる。ロジック（背景色に対する読みやすい文字色の計算）は
 * `LabelChip`と共通なので`lib/color.ts`から同じ関数を使う。
 */
function LabelToggleChip({ label, selected, onToggle }: Props) {
  // ラベル色は実行時値のため Tailwind クラスだけではホバー背景を作れない。
  // --chip-color を CSS 変数に載せ、color-mix で未選択時のホバー塗りを付ける。
  const chipStyle = selected
    ? {
        backgroundColor: label.color,
        borderColor: label.color,
        color: getContrastTextColor(label.color),
        '--chip-color': label.color,
      }
    : {
        borderColor: label.color,
        color: label.color,
        '--chip-color': label.color,
      }

  return (
    <button
      type="button"
      onClick={() => onToggle(label.id)}
      // aria-pressedは「オン/オフの状態を持つボタン」であることをスクリーンリーダーに伝える
      // 属性。見た目（色）だけで選択状態を表現すると、色を判別できない利用者に伝わらない。
      aria-pressed={selected}
      style={chipStyle as CSSProperties}
      // 未選択: ラベル色の薄い塗り＋影。選択中: 少し暗く。どちらも cursor-pointer で押せることを示す。
      className="cursor-pointer rounded-full border px-2 py-0.5 text-xs font-medium transition-all duration-150 hover:shadow-sm aria-pressed-[false]:hover:[background-color:color-mix(in_srgb,var(--chip-color)_14%,white)] aria-pressed-[true]:hover:brightness-95"
    >
      {label.name}
    </button>
  )
}

export default LabelToggleChip
