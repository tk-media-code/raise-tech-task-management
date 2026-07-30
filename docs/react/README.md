# React 学習ドキュメント

> このドキュメントは、本プロジェクトのフロントエンド（React + TypeScript）を学びながら開発を進めるための学習ノートです。
> Claude Codeが生成したコードをそのまま使うのではなく、「何を」「なぜ」そう実装しているかを理解できるようにすることを目的としています。
> Java・Spring Bootを本プロジェクトで並行学習中の方を読者として想定し（[docs/java/](../java/README.md)・[docs/spring-boot/](../spring-boot/README.md)を読了済みの前提）、随所でJavaとの対比を添えています。HTML/CSS/JavaScriptの基礎知識、PHP（Laravelアプリのフロントエンド保守）の経験も前提とします。
> Reactというライブラリ・周辺ツール（React Router・Vite・Tailwind CSS）の使い方に焦点を当てており、TypeScript**言語**自体の文法（ジェネリクス・ユニオン型・非同期処理など）は扱いません。そちらは[docs/typescript/](../typescript/README.md)にまとめています。

### 本書の構成

[docs/spring-boot/](../spring-boot/README.md)と同じく、全体像をつかむための**ハブ（このファイル）**と、章ごとの詳細をまとめた**詳細ファイル**（このディレクトリ内）に分かれています。

- このファイルには、各章の**見出しと概要**のみを載せています。まずはここを上から読めば全体像がつかめます。
- 詳しい解説（コード引用・Javaとの対比）が必要なときは、各章末尾の「📄 詳細」リンクから詳細ファイルを開いてください。
- 章番号は[docs/java/](../java/README.md)・[docs/typescript/](../typescript/README.md)とは別に、このドキュメント内で1から振り直しています。

**ファイル構成**

| 章 | 内容 | 詳細ファイル |
| --- | --- | --- |
| 1〜2章 | Reactの全体像とアプリの起動 | [01-overview.md](./01-overview.md) |
| 3〜6章 | コンポーネントとJSXの書き方 | [02-component-jsx.md](./02-component-jsx.md) |
| 7〜9章 | stateと`useEffect` | [03-state-effect.md](./03-state-effect.md) |
| 10〜12章 | カスタムフックとデータ取得 | [04-custom-hooks.md](./04-custom-hooks.md) |
| 13〜14章 | React Routerによるルーティング | [05-router.md](./05-router.md) |
| 15章 | コンポーネント設計と状態の持ち方 | [06-component-design.md](./06-component-design.md) |
| 16〜17章 | npm・Viteとビルド周りの設定 | [07-build-tooling.md](./07-build-tooling.md) |
| 18〜20章 | フォームと書き込み（POST） | [08-form-and-mutation.md](./08-form-and-mutation.md) |

## 目次

1. [Reactとは](./01-overview.md#1-reactとは)
2. [アプリの起動と全体構成](./01-overview.md#2-アプリの起動と全体構成)
3. [コンポーネントとJSX](./02-component-jsx.md#3-コンポーネントとjsx)
4. [propsと型付け](./02-component-jsx.md#4-propsと型付け)
5. [条件付きレンダリングとリスト描画（`key`）](./02-component-jsx.md#5-条件付きレンダリングとリスト描画key)
6. [イベントハンドラと制御コンポーネント](./02-component-jsx.md#6-イベントハンドラと制御コンポーネント)
7. [stateと`useState`](./03-state-effect.md#7-stateとusestate)
8. [`useEffect`と副作用・クリーンアップ](./03-state-effect.md#8-useeffectと副作用クリーンアップ)
9. [フックのルール](./03-state-effect.md#9-フックのルール)
10. [カスタムフック](./04-custom-hooks.md#10-カスタムフック)
11. [データ取得の3状態とレースコンディション](./04-custom-hooks.md#11-データ取得の3状態とレースコンディション)
12. [`useMemo`と再計算の抑制](./04-custom-hooks.md#12-usememoと再計算の抑制)
13. [React Routerの基本](./05-router.md#13-react-routerの基本)
14. [URLを状態の置き場所にする](./05-router.md#14-urlを状態の置き場所にする)
15. [コンポーネント設計と状態の持ち方](./06-component-design.md#15-コンポーネント設計と状態の持ち方)
16. [npm・Vite・tsconfigと環境変数](./07-build-tooling.md#16-npmvitetsconfigと環境変数)
17. [Tailwind CSSの読み方](./07-build-tooling.md#17-tailwind-cssの読み方)
18. [フォームの実装](./08-form-and-mutation.md#18-フォームの実装)
19. [書き込み（POST）とデータの更新](./08-form-and-mutation.md#19-書き込みpostとデータの更新)
20. [`useRef`とDOMへの直接アクセス](./08-form-and-mutation.md#20-userefとdomへの直接アクセス)

---

## 1. Reactとは

宣言的UIという考え方と、DOM操作をReactが肩代わりしてくれる仕組み（仮想DOM）を、Reactを使わない`prototype/app.js`との対比で解説します。コンポーネントという単位と、本プロジェクトのファイル構成（`components/`・`pages/`・`hooks/`など）の対応も扱います。

📄 詳細：[01-overview.md](./01-overview.md#1-reactとは)

---

## 2. アプリの起動と全体構成

`index.html`→`main.tsx`（`createRoot`・`StrictMode`・`BrowserRouter`）→`App.tsx`（共通レイアウトとルーティング）という、画面が表示されるまでの流れを解説します。

📄 詳細：[01-overview.md](./01-overview.md#2-アプリの起動と全体構成)

---

## 3. コンポーネントとJSX

`LabelChip.tsx`を教材に、JSXの中の`{}`によるJavaScript式の埋め込み、`className`と`style`の使い分け、JSXが自動でエスケープを行いXSS対策を肩代わりしてくれる仕組みを解説します。

📄 詳細：[02-component-jsx.md](./02-component-jsx.md#3-コンポーネントとjsx)

---

## 4. propsと型付け

`CardItem.tsx`の`Props`型を教材に、親から子へ値を渡すprops、子から親へ通知するコールバックprops、`children`によるタグの中身の受け取りを解説します。

📄 詳細：[02-component-jsx.md](./02-component-jsx.md#4-propsと型付け)

---

## 5. 条件付きレンダリングとリスト描画（`key`）

`&&`による条件付きレンダリングと「左辺が`0`だと画面に0が出る」という定番の落とし穴、`.map()`によるリスト描画と`key`にindexを使ってはいけない理由を解説します。

📄 詳細：[02-component-jsx.md](./02-component-jsx.md#5-条件付きレンダリングとリスト描画key)

---

## 6. イベントハンドラと制御コンポーネント

`onClick`・`onChange`の書き方と、`value`props・`onChange`ハンドラをセットで使う制御コンポーネントを、`BoardSelect.tsx`が「真実の在り処」をURLに一本化している設計とあわせて解説します。

📄 詳細：[02-component-jsx.md](./02-component-jsx.md#6-イベントハンドラと制御コンポーネント)

---

## 7. stateと`useState`

`useState`の基本的な使い方、初期値が初回描画にしか使われないこと、`SearchView.tsx`の遅延初期化（`useState(() => ...)`）を解説します。

📄 詳細：[03-state-effect.md](./03-state-effect.md#7-stateとusestate)

---

## 8. `useEffect`と副作用・クリーンアップ

本プロジェクトで最も密度の高いコードである`hooks/useApi.ts`を教材に、依存配列と`Object.is`比較、クリーンアップ関数の役割、`useDebouncedValue`ではクリーンアップこそが処理の本体であること、`StrictMode`による二重実行の検査を解説します。

📄 詳細：[03-state-effect.md](./03-state-effect.md#8-useeffectと副作用クリーンアップ)

---

## 9. フックのルール

`CardDetailModal.tsx`が早期returnをすべてのフック呼び出しの後に置いている理由と、それを機械的に検査する`.oxlintrc.json`の`react/rules-of-hooks`を解説します。

📄 詳細：[03-state-effect.md](./03-state-effect.md#9-フックのルール)

---

## 10. カスタムフック

`useApi`・`useDebouncedValue`・`useLabelsByBoard`という3つのカスタムフックを教材に、定型処理を1行に畳む仕組みと、「フックはループの中で呼べない」という制約への対処を解説します。

📄 詳細：[04-custom-hooks.md](./04-custom-hooks.md#10-カスタムフック)

---

## 11. データ取得の3状態とレースコンディション

`UseApiResult<T>`が「読み込み中／失敗／データあり」を独立した3つのフィールドで表現する理由と、`AbortController`による中断がボードを素早く切り替えたときのレースコンディションをどう防ぐかを解説します。

📄 詳細：[04-custom-hooks.md](./04-custom-hooks.md#11-データ取得の3状態とレースコンディション)

---

## 12. `useMemo`と再計算の抑制

`CrossBoardView.tsx`の`useMemo(() => groupCardsByStatusAndBoard(cards), [cards])`を教材に、無関係な再描画のたびに重い計算をやり直さないための仕組みと、使いどころの見極めを解説します。

📄 詳細：[04-custom-hooks.md](./04-custom-hooks.md#12-usememoと再計算の抑制)

---

## 13. React Routerの基本

`BrowserRouter`・`Routes`・`Route`・`Link`・`useParams`・`useNavigate`という、React Routerの基本的な構成要素を解説します。

📄 詳細：[05-router.md](./05-router.md#13-react-routerの基本)

---

## 14. URLを状態の置き場所にする

`BoardSelect.tsx`の`useMatch`が体現する「真実の在り処は1つにする」という設計原則と、`SearchView.tsx`の`useSearchParams`・`Link`の`state`propsによる、検索条件と画面遷移履歴の管理を解説します。

📄 詳細：[05-router.md](./05-router.md#14-urlを状態の置き場所にする)

---

## 15. コンポーネント設計と状態の持ち方

`BoardSelect`を`<Routes>`の外側に置く理由、`renderContent()`をコンポーネント化しない理由、`CardItem`と`SearchResultItem`をあえて分けた理由など、個々の構文ではなく設計判断そのものを扱います。

📄 詳細：[06-component-design.md](./06-component-design.md#15-コンポーネント設計と状態の持ち方)

---

## 16. npm・Vite・tsconfigと環境変数

`package.json`のスクリプトと依存関係、`vite.config.ts`、3つに分かれた`tsconfig.*.json`、`import.meta.env`と`.env.development`による環境変数の扱いを解説します。

📄 詳細：[07-build-tooling.md](./07-build-tooling.md#16-npmvitetsconfigと環境変数)

---

## 17. Tailwind CSSの読み方

ユーティリティファーストという考え方と、`StatusMessage.tsx`が明示している「クラス名を文字列連結で組み立ててはいけない」という重要な制約、Tailwindで表現できない値を`style`属性で扱う使い分けを解説します。

📄 詳細：[07-build-tooling.md](./07-build-tooling.md#17-tailwind-cssの読み方)

---

## 18. フォームの実装

本プロジェクト初めての`<form>`・`onSubmit`・`preventDefault`を、カード追加フォーム・ボード管理モーダルを教材に解説します。要件5.2「タイトル未入力なら追加ボタンを無効化する」の実装、入力を個別の`useState`に分けた理由、開閉状態を持つフォームの設計も扱います。

📄 詳細：[08-form-and-mutation.md](./08-form-and-mutation.md#18-フォームの実装)

---

## 19. 書き込み（POST）とデータの更新

`useApi`をそのまま使えない書き込み処理のために新設した`useCreate`、書き込み後に一覧を最新化する`refetch`、そして「なぜ楽観的更新にしないのか」（並び順の決定権はサーバーにあるという契約）を解説します。ボード一覧のstateを`App.tsx`へリフトアップした経緯——Contextに飛びつく前にまず検討すべき選択肢としてのリフトアップ——も扱います。

📄 詳細：[08-form-and-mutation.md](./08-form-and-mutation.md#19-書き込みpostとデータの更新)

---

## 20. `useRef`とDOMへの直接アクセス

フォームを開いた瞬間にタイトル入力欄へ自動でフォーカスを当てる実装を教材に、`useRef`と`useState`の違い（値の変化が再描画を引き起こすかどうか）、`useEffect`の中でDOM操作を行う理由を解説します。

📄 詳細：[08-form-and-mutation.md](./08-form-and-mutation.md#20-userefとdomへの直接アクセス)

---

## 付録：このドキュメントで扱っていないReactの機能

Reactの入門書には載っているのに、本プロジェクトのコードには一度も登場しない機能があります。「知らないのは自分だけでは」と迷わないよう、意図的に扱っていない機能と、その理由をまとめておきます。

| 機能 | 本プロジェクトに登場しない理由 |
| --- | --- |
| Context（`useContext`） | [19章](#19-書き込みpostとデータの更新)で述べたとおり、ボード一覧の共有が必要になった際も、消費者がまだ2つ（`BoardSelect`・`BoardManageModal`）だけのためリフトアップで足りている。消費者がさらに増えたときの検討課題として残る |
| `useReducer` | state更新のロジックが単純で、`useState`（[7章](#7-stateとusestate)）で足りている |
| `React.memo`（コンポーネントの再描画抑制） | 再描画コストが問題になるほど重いコンポーネントがまだ無い |
| エラーバウンダリ | 現状のエラー処理はAPI通信の失敗（[11章](#11-データ取得の3状態とレースコンディション)のstate）に限られ、予期しない描画エラー自体を捕捉する仕組みは未導入 |
| ドラッグ＆ドロップ | ステータスの変更はドラッグ＆ドロップで行う設計（要件5.3）だが、更新系API（PUT）が未実装のため見送られている |

`useCallback`（[19章](#19-書き込みpostとデータの更新)の`useApi.refetch`・`useCreate.create`）・`useRef`（[20章](#20-userefとdomへの直接アクセス)）は、カード・ボードの新規作成の実装にあわせて登場したため、このリストから外れました。残る機能も、Write系API（PUT/DELETE）の実装が進むにつれて登場する可能性があります。実装に登場した時点で、下記の更新ルールに従ってこのドキュメント群に章を追加してください。

## このドキュメントの更新ルール

- 開発を進める中で新しい概念・技術要素（例：Context、フォーム送信、認証状態の管理、ドラッグ＆ドロップなど）が登場したら、**都度このドキュメント群を更新すること**を本プロジェクトのルールとします。
- 既存ファイルへの追記で収まる内容はそのファイルに追記し、独立したまとまりを持つ新しいトピックは`08-xxx.md`のように連番でファイルを追加してください。章番号もこのREADMEの続き（18章、19章…）として振ってください。
- 新しいファイルを追加した場合は、このREADMEの「ファイル構成」表と「目次」の両方を更新し、ハブと詳細ファイルの対応が常に成立している状態を保ってください。
- TypeScript**言語**自体の機能（ジェネリクス・ユニオン型など）は[docs/typescript/](../typescript/README.md)側の更新ルールに従い、そちらに追記してください。両方にまたがる概念（例：カスタムフックの型引数としてのジェネリクス）は、言語機能としての説明をTypeScript側、使い所の説明をこちらに置き、相互リンクしてください。

---

*本ドキュメントは開発と並行して育てていく学習ノートです。実装で分からないReactの概念が出てきたら、まずここに解説がないか確認し、無ければ追記してください。*
