import { getContrastTextColor } from '../lib/color'
import type { LabelResponse } from '../types/api'

type Props = {
  label: LabelResponse
}

/**
 * ラベル1件を表す色付きチップ（要件定義 5.5）。
 * カード一覧（CardItem）・カード詳細モーダル・検索結果（SearchResultItem）から使う。
 */
function LabelChip({ label }: Props) {
  return (
    <span
      // 色は固定クラスではなくlabel.color由来の値なので、Tailwindのユーティリティクラスでは
      // 表現できない（クラス名はビルド時に静的に決まっている必要があるため）。
      // このような「実行時にしか決まらない値」はstyle属性でインラインに指定する。
      style={{ backgroundColor: label.color, color: getContrastTextColor(label.color) }}
      className="rounded-full px-2 py-0.5 text-xs font-medium"
    >
      {label.name}
    </span>
  )
}

export default LabelChip
