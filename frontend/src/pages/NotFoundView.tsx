import { Link } from 'react-router'

/**
 * 404画面。App.tsxの<Routes>にあるどのpathにも一致しなかったURLで表示される。
 *
 * 要件定義（docs/requirements/03-screens.md 6章）が定める画面の一覧には含まれない補助画面。
 * これが無いと、/typo のような未定義のURLを開いたとき<Routes>が何も描画せず、ヘッダーだけが
 * 残った空白の<main>になる。ユーザーからは「アプリが壊れた」のか「そういうURLは無い」のかを
 * 区別できないため、後者であることを明示するためだけに用意している。
 *
 * この画面はデータ取得を一切行わない。存在しないURLに対して叩くべきAPIは無く、
 * 他のページのようなloading・errorの状態も持たないため、propsもフックも不要になる。
 */
function NotFoundView() {
  return (
    <section className="mx-auto max-w-md text-center">
      {/* 数字そのものは装飾。読み上げ上の意味は下のh2が担うため、ここは見出しにしない。 */}
      <p className="text-5xl font-bold text-slate-300">404</p>
      <h2 className="mt-3 text-lg font-semibold">ページが見つかりません</h2>
      <p className="mt-2 text-sm text-slate-600">
        お探しのページは存在しないか、URLが変更された可能性があります。
      </p>
      {/* 戻り先は横断ビュー（/）に固定する。他の画面の「← 戻る」はlocation.stateで
          遷移元を受け取るが（pages/ArchiveView.tsx参照）、この画面はURLを直接開いた・
          古いブックマークを踏んだといった「遷移元が存在しない」到達が主なため、
          常に確実に存在するアプリの入口へ案内する。
          <a href>ではなく<Link>を使う理由はdocs/react/05-router.md 13章参照。 */}
      <Link
        to="/"
        className="mt-4 inline-block cursor-pointer rounded border border-slate-300 bg-white px-4 py-2 text-sm text-blue-600 hover:bg-slate-50"
      >
        横断ビューへ戻る
      </Link>
    </section>
  )
}

export default NotFoundView
