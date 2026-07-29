/**
 * 背景色（16進カラーコード）の相対輝度から、読みやすい文字色（白 or 濃紺）を選ぶ。
 * ラベルの色はボードごとに自由に決められる想定のため、明るい背景に白文字・暗い背景に
 * 濃紺文字のような「読めない」組み合わせを避けたい。
 *
 * ロジックは prototype/app.js の getContrastTextColor をそのまま踏襲している
 * （動くモックとして見た目が確定済みのため、ここで独自の配色ロジックを考え直さない）。
 *
 * 元は components/LabelChip.tsx に非公開関数として実装していたが、
 * components/LabelFilterChip.tsx（検索画面のラベル絞り込みチップ）からも同じロジックが
 * 必要になり呼び出し元が2つになったため、共通の純粋関数としてこちらに切り出した。
 */
export function getContrastTextColor(hex: string): string {
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
