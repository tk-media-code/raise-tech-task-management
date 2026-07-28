/**
 * Viteが提供する型定義（ImportMetaEnv）を、このプロジェクト固有の環境変数で拡張するファイル。
 *
 * Viteの既定の型定義は `[key: string]: any` の索引シグネチャを持っているため、
 * このファイルが無くても import.meta.env.VITE_API_BASE_URL はコンパイルを通る。
 * ただし型は any になり、綴りを間違えても気づけない。ここで明示することで string になり、
 * 「どんな環境変数がこのアプリに存在するか」の一覧としても機能する。
 *
 * 【重要】このファイルにはトップレベルの import / export を書かないこと。
 * 1つでも書くとこのファイルは「モジュール」と見なされ、
 * ここでの interface 宣言がグローバルのImportMetaEnvと合体（宣言のマージ）しなくなり、
 * 拡張が静かに効かなくなる。
 *
 * なお tsconfig.app.json で `"types": ["vite/client"]` を指定済みのため、
 * Viteのテンプレートにある `/// <reference types="vite/client" />` の行は不要。
 */
interface ImportMetaEnv {
  /**
   * バックエンドAPIのベースURL（例: "http://localhost:8080"）。
   *
   * 省略可能（`?`）にしているのは、読み込まれる .env ファイルがモードごとに違うため。
   * 開発モードでは .env.development から供給されるが、`npm run build`（productionモード）では
   * そのファイルが読み込まれず undefined になる。api/client.ts 側で `?? ''` を用意している。
   */
  readonly VITE_API_BASE_URL?: string
}
