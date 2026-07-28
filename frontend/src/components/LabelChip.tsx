import type { LabelResponse } from '../types/api'

type Props = {
  label: LabelResponse
}

/**
 * 背景色（16進カラーコード）の相対輝度から、読みやすい文字色（白 or 濃紺）を選ぶ。
 * ラベルの色はボードごとにユーザー相当が自由に決められる想定のため、
 * 明るい背景に白文字・暗い背景に濃紺文字のような「読めない」組み合わせを避けたい。
 *
 * ロジックは prototype/app.js の getContrastTextColor をそのまま踏襲している
 * （動くモックとして見た目が確定済みのため、ここで独自の配色ロジックを考え直さない）。
 * 呼び出し元がこのコンポーネント1つだけなので、lib/ には出さずここに閉じ込める
 * （export しない＝このファイルの外からは呼べない）。
 */
function getContrastTextColor(hex: string): string {
  // "#e74c3c" → "e74c3c" のように先頭の#を落としてから2桁ずつ切り出す。
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  // 人の目はRGBの中でも緑を最も明るく、青を最も暗く感じる。この重み付け（0.299/0.587/0.114）は
  // NTSC/ITU-R BT.601という映像信号の輝度計算に由来する経験則で、単純な平均より自然に見える。
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#172b4d' : '#ffffff'
}

/**
 * ラベル1件を表す色付きチップ（要件定義 5.5）。
 * カード一覧（CardItem）とカード詳細モーダルの両方から使う。
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
