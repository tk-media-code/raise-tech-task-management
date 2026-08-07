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
