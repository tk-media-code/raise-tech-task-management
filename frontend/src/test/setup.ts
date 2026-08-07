// 各テストファイルの実行前に読み込まれるセットアップ（vite.config.ts の test.setupFiles で指定）。
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// '@testing-library/jest-dom/vitest' は toBeInTheDocument()・toBeDisabled() といった
// DOM向けのマッチャーをexpectに追加する。素のVitestが持つのは toBe()・toEqual() など
// 汎用のマッチャーだけなので、これが無いと「この要素は画面にあるか」を素直に書けない。

// テストごとに描画したコンポーネントを破棄する。
// globals: false（vite.config.ts参照）にしているとTesting Libraryの自動cleanupが働かないため、
// ここで明示的に呼ぶ。これを忘れると、前のテストで描画したDOMが次のテストにも残り、
// getByRole等が「同じ要素が複数見つかる」というエラーになる。
afterEach(() => {
  cleanup()
})

// jsdom（30.0.1時点）はHTMLDialogElementのopenプロパティしか実装しておらず、showModal()と
// close()が存在しない（prototypeのown propsが['constructor','open']しかない）。そのため
// components/ConfirmDialog.tsxのようにshowModal()を呼ぶコンポーネントは、そのままでは
// テスト中にTypeErrorで落ちる。ここで最小限の代替を用意する。
//
// open属性を出し入れするだけで足りるのは、jsdomの既定スタイルシートに
// `dialog:not([open]) { display: none }` が入っているため。これにより
// Testing Libraryの「画面に見えている要素だけを探す」判定（getByRole等）も期待どおり働き、
// 閉じているダイアログの中身は見つからない、という本物に近い挙動になる。
//
// 逆に、この代替で再現できないものは次のとおり。いずれもブラウザでの手動確認に委ねる：
// トップレイヤー・背景要素の不活性化・フォーカストラップ・Escapeによるcancelイベント・::backdrop。
//
// typeofで既存実装の有無を見てから足しているのは、将来jsdomがshowModal()を実装したときに
// 本物を上書きしてしまわないようにするため。
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
}
