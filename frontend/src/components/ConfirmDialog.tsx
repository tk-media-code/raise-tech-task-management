import { useEffect, useRef } from 'react'
import type { ReactNode, SyntheticEvent } from 'react'
import StatusMessage from './StatusMessage'

type Props = {
  /** 開いているか。falseのあいだは何も描画しない（BoardManageModal.tsxのopenと同じ考え方） */
  open: boolean
  /** 見出し（<h2>）の文言。<dialog>のaria-labelも兼ねる */
  title: string
  /**
   * 確認の本文。文字列ではなくReactNodeで受けるのが、複数の呼び出し元の差を吸収する要。
   * カード削除は固定の2文だが、ボード削除は「件数を取得中／取得できた／取得に失敗した」で
   * 文言が変わる。その分岐は「何を確認させたいか」を知っている呼び出し側の関心事であり、
   * message+loading+countのようなpropsをここへ持ち込むと、この部品が汎用の確認ダイアログ
   * ではなく「削除確認専用の何か」に狭まってしまう（StatusMessage.tsxがchildrenで
   * 本文を受けているのと同じ流儀）。
   */
  children: ReactNode
  /** 実行ボタンのラベル（例：「完全に削除する」） */
  confirmLabel: string
  /** 実行中に差し替わる実行ボタンのラベル（例：「削除中…」） */
  submittingLabel: string
  /** 実行中か。trueのあいだは全ボタンを無効化し、Escape・背景クリックでも閉じない */
  submitting: boolean
  /** 実行が失敗したときのエラー。nullなら表示しない */
  error: Error | null
  /** 実行ボタンが押されたとき。async関数をそのまま渡してよい */
  onConfirm: () => void
  /** キャンセル・×・背景クリック・Escapeのいずれかで閉じるとき */
  onClose: () => void
}

/**
 * 取り消せない操作の実行前に確認を取る、共通のモーダルダイアログ。
 *
 * 以前はボード削除・カード完全削除のどちらもブラウザ標準のwindow.confirm()で確認していた。
 * これをやめたのは、window.confirm()がブラウザ側の設定（Chromeなら「このページでこれ以上
 * ダイアログを作成しない」）で黙って無効化され得るため。無効化されると呼び出しは即座に
 * falseを返し、アプリ側からはそれを検知することも回避することもできない。「コードは正しいのに
 * ユーザーには確認が出ない」という失敗の仕方をする以上、取り消せない操作の最後の砦を
 * ブラウザ任意の機能に預けるべきではない、という判断（docs/react/12-dialog-accessibility.md 38章）。
 *
 * 実際の削除処理（useDelete）はこの部品の中に持たず、submitting・errorをpropsで受け取って
 * onConfirmを呼び返すだけにしている。useDeleteは呼ばれた時点でpathを固定するフックで、
 * 「削除できる行ごとに1つ持つ」ことが設計の前提になっているため（components/ArchivedCardItem.tsxの
 * docblock参照）。この部品の内側に持たせるとpathをpropsで渡すことになり、その前提が
 * ダイアログ側へ漏れ出してしまう。
 *
 * なお、この部品はモーダルの入れ子（BoardManageModal → SortableBoardRow → この部品）で
 * 使われる。<dialog>同士の入れ子はHTML仕様上は正当で、トップレイヤーがスタックし、Escapeは
 * 最前面のdialogだけが受け取る。ただしReact側に注意点があり、handleCancelのコメントで扱う。
 *
 * components/LabelPicker.tsxのラベル削除確認はこの部品に寄せていない。あちらはwindow.confirm()を
 * 使っておらず上記の問題の対象外であるうえ、削除対象のチップのすぐ下に出ること自体が
 * 「どのラベルを消すのか」を示す手がかりになっているため。
 */
function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  submittingLabel,
  submitting,
  error,
  onConfirm,
  onClose,
}: Props) {
  // <dialog>要素への参照。showModal()という命令的なDOM APIを呼ぶために必要
  // （CardDetailModal.tsx・BoardManageModal.tsxと同じ作法）。
  const dialogRef = useRef<HTMLDialogElement>(null)
  // 初期フォーカスを当て直す先。理由は下のuseEffect参照。
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (dialog === null) return

    // 開く直前にフォーカスされていた要素（＝「削除」ボタン）を控えておく。閉じたあとに
    // ここへ戻すためで、その必要がある理由はこのeffectのクリーンアップのコメントを参照。
    const previouslyFocused = document.activeElement

    // JSXにopen属性を書くのではなくshowModal()を呼ぶ理由はCardDetailModal.tsx参照
    // （フォーカストラップ・背景の不活性化・::backdropはshowModal()でのみ有効になる）。
    dialog.showModal()

    // showModal()は「autofocus属性を持つ要素、無ければ最初のフォーカス可能な要素」へ
    // 自動でフォーカスを当てる。この構造ではヘッダーの×がそれに当たるが、取り消せない操作の
    // 確認では、Enterを押しただけで実行されない安全側（キャンセル）に初期フォーカスを置きたい。
    // BoardManageModal.tsxが開いた直後に入力欄へフォーカスを移し直しているのと同じ手当て。
    cancelButtonRef.current?.focus()

    return () => {
      dialog.close()

      // close()を呼べばブラウザがフォーカスを開く前の要素へ戻してくれる……のは、<dialog>が
      // まだDOMに繋がっている場合の話。このコンポーネントはopenがfalseになるとnullを返して
      // アンマウントされ、そのときクリーンアップが走る時点では既に要素がDOMから外れているため、
      // ブラウザの復帰処理は働かずフォーカスが<body>へ落ちる。入れ子で使うと「親モーダルは
      // 開いたままなのにフォーカスだけ迷子」という状態になるので、自前で戻す。
      // isConnectedを見るのは、削除が成功して元の行ごと消えた場合に、既に存在しない要素へ
      // フォーカスを当てにいかないため。
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus()
      }
    }
  }, [open])

  // 全hooks呼び出しの後に置く早期return（フックのルール。CardDetailModal.tsxと同じ理由）。
  if (!open) return null

  /**
   * Escapeキーによる「閉じる」要求（<dialog>のcancelイベント）を受け取る。
   *
   * preventDefault()で既定動作（DOM上でdialogを閉じるだけ）を止め、必ずReactのstate経由で
   * 閉じるのは既存2モーダルと同じ。加えてここではstopPropagation()も要る。
   *
   * ネイティブのcancelイベントはバブルしないため、入れ子の外側にある<dialog>には本来届かない。
   * ところがReactは、cancelのような非バブリングのイベントも合成イベントとしてReactツリーの
   * 祖先へ配り直す（target限定で扱われるのはscrollだけ）。これを止めないと、確認ダイアログで
   * Escapeを押しただけでBoardManageModalのhandleCancelまで動いてしまい、ボード管理モーダルごと
   * 閉じる（改名編集中ならその編集が巻き添えでキャンセルされる）。
   */
  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    event.stopPropagation()
    // 実行中は閉じない。閉じるとエラーメッセージの表示先ごと消えてしまい、失敗したのか
    // 成功したのか分からなくなるため（LabelPicker.tsxのhandleConfirmDeleteと同じ考え方）。
    if (submitting) return
    onClose()
  }

  /** 背景クリック・×・キャンセルからの「閉じる」。実行中は受け付けない（handleCancelと同じ理由） */
  function requestClose() {
    if (submitting) return
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      // role="dialog" / aria-modal="true" はshowModal()が暗黙に与えるため書かない。
      // 見出しと同じ文言をaria-labelにも渡し、支援技術がどのダイアログか読み上げられるようにする。
      aria-label={title}
      // 既定スタイルの打ち消しと::backdropへの暗幕はCardDetailModal.tsxのコメント参照。
      // 入れ子で開くと親モーダルのbackdropと二重に掛かって背景がより暗くなるが、これは
      // 許容する。「親モーダルも一段暗転して、この確認が最前面にある」ことはむしろ伝えたい
      // 情報であり、入れ子かどうかで暗さの語彙を変えるほうが不統一になるため。
      className="m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto border-0 bg-transparent p-0 backdrop:bg-slate-900/50"
    >
      {/* 背景クリックで閉じるための領域。role="presentation"を含め、考え方はすべて
          CardDetailModal.tsxと同じ（そちらのコメント参照）。入れ子でも壊れないのは、
          判定がstopPropagation()ではなくtarget === currentTargetの一致で行われているため。
          確認ダイアログ内のクリックはDOM上は外側のこのdivまで伝わるが、そのときtargetは
          内側の要素なので一致せず、親モーダルは閉じない。 */}
      <div
        role="presentation"
        className="flex min-h-full items-start justify-center p-4 sm:p-8"
        onClick={(event) => {
          if (event.target === event.currentTarget) requestClose()
        }}
      >
        {/* 幅はCardDetailModal（max-w-lg）・BoardManageModal（max-w-md）より一段狭いsm。
            本文が数行の確認しか載せないため、横に広いと視線の移動距離だけが伸びる。 */}
        <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
            <h2 className="text-base font-bold">{title}</h2>
            <button
              type="button"
              onClick={requestClose}
              disabled={submitting}
              aria-label="閉じる"
              className="cursor-pointer rounded px-2 text-lg leading-none text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              ×
            </button>
          </header>

          <div className="space-y-2 p-4 text-sm text-slate-700">
            {children}
            {error !== null && <StatusMessage kind="error">{error.message}</StatusMessage>}
          </div>

          {/* ボタンは[キャンセル][実行]の順。取り消せる操作を左、取り消せない操作を右に置く
              並びは、ArchivedCardItem.tsxの[復元][完全削除]・SortableBoardRow.tsxの
              [改名][削除]と揃えている。 */}
          <footer className="flex items-center justify-end gap-2 border-t border-slate-200 p-4">
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={requestClose}
              disabled={submitting}
              className="cursor-pointer rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              キャンセル
            </button>
            {/* 実行ボタンは赤で固定する。今のところ呼び出し元が2箇所ともに破壊的な操作
                （削除）のため。破壊的でない確認が必要になったら、StatusMessage.tsxの
                KIND_CLASSESと同じくRecord<Tone, string>のクラス表をここに足す
                （Tailwindは文字列を組み立てたクラス名を拾えないため、必ず完全な形で書くこと）。 */}
            <button
              type="button"
              onClick={onConfirm}
              disabled={submitting}
              className="cursor-pointer rounded bg-red-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting ? submittingLabel : confirmLabel}
            </button>
          </footer>
        </div>
      </div>
    </dialog>
  )
}

export default ConfirmDialog
