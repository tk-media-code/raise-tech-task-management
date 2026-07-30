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
  return (
    <button
      type="button"
      onClick={() => onToggle(label.id)}
      // aria-pressedは「オン/オフの状態を持つボタン」であることをスクリーンリーダーに伝える
      // 属性。見た目（色）だけで選択状態を表現すると、色を判別できない利用者に伝わらない。
      aria-pressed={selected}
      style={
        selected
          ? // 選択中はLabelChipと同じ配色（背景=ラベル色、文字=コントラスト色）で塗りつぶす。
            { backgroundColor: label.color, borderColor: label.color, color: getContrastTextColor(label.color) }
          : // 未選択はラベル色の輪郭だけを見せるアウトライン表示にし、選択中との違いを一目で分かるようにする。
            { borderColor: label.color, color: label.color }
      }
      className="rounded-full border px-2 py-0.5 text-xs font-medium"
    >
      {label.name}
    </button>
  )
}

export default LabelToggleChip
