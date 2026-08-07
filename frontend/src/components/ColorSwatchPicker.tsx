import { LABEL_COLORS } from '../lib/labelColors'

type Props = {
  /** 現在選択中の色（16進カラーコード） */
  selectedColor: string
  /** スウォッチがクリックされたときに呼ばれる */
  onSelect: (color: string) => void
}

/**
 * ラベル作成フォームで使う、既定パレット8色から1色を選ぶスウォッチ（丸いボタン）の並び
 * （要件定義5.5、プロトタイプ`prototype/app.js`の`.color-swatch`に相当）。
 *
 * `LabelToggleChip`と同じ「controlled」パターンを採る。選択状態（`selectedColor`）も
 * 選択時の処理（`onSelect`）もこのコンポーネント自身は持たず、すべて親（`CardCreateForm`）から
 * propsで受け取る。そうすることで、「今どの色が選ばれているか」という状態はこのコンポーネントの
 * 中と外の2箇所に分裂せず、常に親のstate（`newLabelColor`）という1箇所だけに存在する。
 */
function ColorSwatchPicker({ selectedColor, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-1">
      {LABEL_COLORS.map((color) => (
        <button
          key={color.hex}
          type="button"
          onClick={() => onSelect(color.hex)}
          // aria-pressedでオン/オフの状態をスクリーンリーダーに伝える（LabelToggleChipと同じ理由）。
          // 色そのものは見た目だけでは伝わらないため、aria-label/titleに日本語の色名を添える。
          aria-pressed={color.hex === selectedColor}
          aria-label={`ラベルの色: ${color.name}`}
          title={color.name}
          style={{ backgroundColor: color.hex }}
          className={`cursor-pointer ${
            // 選択中は太めの縁取りで視覚的に区別する。未選択は薄い縁（背景色が白に近い黄色などでも
            // 円の輪郭が見えるようにするため）。
            color.hex === selectedColor
              ? 'h-6 w-6 rounded-full ring-2 ring-offset-1 ring-slate-700'
              : 'h-6 w-6 rounded-full border border-slate-300'
          }`}
        />
      ))}
    </div>
  )
}

export default ColorSwatchPicker
