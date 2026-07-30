/** ラベルの色1つぶん。hexは送信・表示に使う実データ、nameはアクセシビリティ・表示用の日本語名 */
export type LabelColorOption = {
  hex: string
  name: string
}

/**
 * ラベル作成時に選べる色のプリセットパレット（要件定義5.5「あらかじめ用意された色パレットから
 * 色を選び」）。値・順序はバックエンド（BoardService.ALLOWED_LABEL_COLORS）と揃えてある。
 * ずれると「フロントで選べた色がバックエンドで拒否される（400）」という食い違いが起きるため、
 * 変更する場合は両方合わせて直すこと。
 *
 * 色そのものの由来はprototype/app.jsのLABEL_COLORS（8色）で、db/seed/dummy-data.sqlの
 * 初期ラベルの色とも一致する。nameは送信データには含めない（ColorSwatchPickerのaria-label・title
 * だけに使う表示用の値）。
 */
export const LABEL_COLORS: readonly LabelColorOption[] = [
  { hex: '#e74c3c', name: '赤' },
  { hex: '#e67e22', name: 'オレンジ' },
  { hex: '#f1c40f', name: '黄' },
  { hex: '#2ecc71', name: '緑' },
  { hex: '#3498db', name: '青' },
  { hex: '#9b59b6', name: '紫' },
  { hex: '#e84393', name: 'ピンク' },
  { hex: '#7f8c8d', name: 'グレー' },
]
