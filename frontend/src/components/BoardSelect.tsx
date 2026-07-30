import type { ChangeEvent } from 'react'
import { useMatch, useNavigate } from 'react-router'
import type { BoardResponse } from '../types/api'

/**
 * 「すべて」（＝横断ビュー）を表す <option> の value。
 * ボードIDは数値なので、それと衝突しない文字列にしておく。
 */
const ALL_BOARDS = 'all'

type Props = {
  /** ボード一覧。読み込み中・未取得はnull（App.tsxのuseApiの結果をそのまま受け取る） */
  boards: BoardResponse[] | null
  /** ボード一覧の取得中かどうか */
  loading: boolean
  /** ボード一覧の取得に失敗した場合のエラー */
  error: Error | null
}

/**
 * 画面上部のボード切替セレクトボックス（要件定義 5.1／6.2）。
 * 「すべて」（横断ビュー）と各ボードを切り替える。初期選択は「すべて」。
 *
 * App.tsxのヘッダー（<Routes>の外側）に置いている。画面（横断ビュー⇔ボード詳細）を
 * 切り替えてもこのコンポーネント自体はアンマウントされないため、ボード一覧の
 * 再取得も選択状態のちらつきも起きない。ページ側に置くと、遷移のたびに
 * アンマウント→再マウントが起きて毎回 GET /api/boards を叩き直すことになる。
 *
 * ボード一覧はこのコンポーネント自身では取得せず、App.tsxからpropsで受け取る形に変更した
 * （元は「データ取得の責務はそれを必要とするコンポーネントに閉じ込める」という方針で
 * このコンポーネント自身がuseApiを呼んでいた）。ボード管理モーダル（BoardManageModal）の
 * 新規作成が成功した直後、このセレクトボックスの選択肢にも同じ一覧を反映する必要が生まれ、
 * 「一覧を必要とするコンポーネントが2つ（このセレクトボックスと管理モーダル）」になった時点で、
 * 各自が独立して取得する方針は成立しなくなった。片方の変更をもう片方に伝える手段が無いため、
 * 状態をより上位の共通の親（App.tsx）へ引き上げ（リフトアップ）、両者に同じ値をpropsで
 * 配ることにした。Context（docs/react/README.md 付録）は導入していない。消費者がまだ2つだけで、
 * App.tsxからpropsで配るだけで足りる規模である間は、Contextを持ち込むと「値がどこから来るか」を
 * 追うための間接層が増えるだけで見合わないと判断したため（docs/react/06-component-design.md 15章参照）。
 */
function BoardSelect({ boards, loading, error }: Props) {
  const navigate = useNavigate()

  // 現在どのボードを見ているかを、useStateではなくURLから導き出す。
  // stateに持つと「ブラウザの戻るボタンでURLだけが変わり、セレクトの表示が
  // 取り残される」というバグが必ず生まれる。真実の在り処（source of truth）は
  // 1つにする——今回のReact Routerの使い方でいちばん大事な考え方。
  //
  // useMatchは、現在のURLが渡したパターンに一致すればマッチ情報を、
  // しなければnullを返す。パターンはApp.tsxの<Route path="/boards/:boardId">と
  // 同じ文字列にすること（ずれると一致しなくなる）。
  const match = useMatch('/boards/:boardId')
  const selectedValue = match === null ? ALL_BOARDS : (match.params.boardId ?? ALL_BOARDS)

  /**
   * 選択が変わったらURLを書き換える。
   * navigate()は<Link>のクリックと同じことをプログラムから行う関数で、
   * ページ全体の再読み込みをせずURLと表示を切り替える。
   */
  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value
    navigate(value === ALL_BOARDS ? '/' : `/boards/${value}`)
  }

  return (
    <select
      // valueとonChangeをセットで渡す形を「制御コンポーネント」と呼ぶ。
      // 表示中の値をDOM自身にではなくReact側（ここではURL）に握らせる、という意味。
      // 補足: ボード一覧の取得が終わるまでは対応する<option>が存在しないため、
      // /boards/2 を直接開いた直後の一瞬だけ選択が空に見える。取得完了時に自動で直る。
      value={selectedValue}
      onChange={handleChange}
      disabled={loading}
      // 取得に失敗したときは「すべて」だけが選べる状態になる。理由をツールチップで補う。
      title={error === null ? undefined : `ボード一覧の取得に失敗しました：${error.message}`}
      aria-label="表示するボードを選ぶ"
      className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
    >
      <option value={ALL_BOARDS}>すべて</option>
      {(boards ?? []).map((board) => (
        // keyは「配列の各要素がどのDOMに対応するか」をReactに教える目印。
        // 並び替えや増減が起きたとき、これが無いとReactは要素を作り直してしまい、
        // 入力中の値やスクロール位置が飛ぶ。配列のindexではなく、
        // 中身が動いても変わらないID（board.id）を使うのが鉄則。
        <option key={board.id} value={String(board.id)}>
          {board.name}
        </option>
      ))}
    </select>
  )
}

export default BoardSelect
