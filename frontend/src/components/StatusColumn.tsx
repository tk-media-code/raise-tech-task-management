import type { ReactNode } from 'react'

type Props = {
  /** 列見出し（例: "未着手"） */
  title: string
  /** 見出し末尾に表示する件数（例: 2 → "未着手 (2)"） */
  count: number
  /**
   * スマートフォン幅（768px未満）で、この列を表示するかどうか。
   * 768px以上（md）では常に表示されるため、この値に関わらず見える。
   * 呼び出し側（BoardDetailView・CrossBoardView）が、components/MobileStatusTabs.tsxの
   * 選択状態と突き合わせて渡す（例: status === mobileActiveStatus）。
   */
  isActiveOnMobile: boolean
  children: ReactNode
}

/**
 * ステータス列1本ぶんの外枠（要件定義 6.2 ①）。
 *
 * 横断ビューとボード詳細で列の中身（childrenの構造）は異なる
 * （横断ビューはボード別セクション、ボード詳細はカードの平坦なリスト）が、
 * 「見出し＋件数の付いた枠」という外側の見た目は共通なので、その部分だけを
 * このコンポーネントに切り出している。中身をchildrenとして受け取る形にすることで、
 * StatusColumn自身は「中身が何か」を一切知らずに済む（関心の分離）。
 *
 * isActiveOnMobileだけは「中身」ではなく「自分自身を表示するか」という枠自身の
 * 見た目に関わる情報。768px未満では未着手／作業中／完了のうち選択中の1列だけを
 * 表示するタブ切り替えUI（components/MobileStatusTabs.tsx、要件8.1）を実現するため、
 * 非アクティブな列はdisplay:noneで畳む。CardItem.tsxの「移動」<select>が自分の中に
 * md:hiddenを持っているのと同じ分担（「自分がどの画面幅でどう見えるか」は
 * コンポーネント自身が判断する）に揃えている。
 */
function StatusColumn({ title, count, isActiveOnMobile, children }: Props) {
  return (
    <div
      className={`${isActiveOnMobile ? 'flex' : 'hidden'} md:flex flex-col gap-3 rounded-lg border border-slate-300 bg-slate-50 p-3`}
    >
      {/* タブ側（MobileStatusTabs）のラベルに件数入りの見出しが既にあるため、
          768px未満ではこの見出しを重複させない（プロトタイプの.kanban-col-headerと同じ意図）。 */}
      <h3 className="hidden text-sm font-semibold text-slate-700 md:block">
        {title} ({count})
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

export default StatusColumn
