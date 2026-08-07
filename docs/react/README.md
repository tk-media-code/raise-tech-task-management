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
| 18〜21章 | フォームと書き込み（POST） | [08-form-and-mutation.md](./08-form-and-mutation.md) |
| 22〜28章 | カードの編集とドラッグ＆ドロップ | [09-editing-and-drag-and-drop.md](./09-editing-and-drag-and-drop.md) |
| 29〜30章 | ボード管理（改名・削除） | [10-board-management.md](./10-board-management.md) |
| 31〜32章 | カードの完全削除 | [11-card-deletion.md](./11-card-deletion.md) |
| 33章 | oxlintの設定強化 | [07-build-tooling.md](./07-build-tooling.md) |
| 34章 | ネイティブ`<dialog>`とモーダルのアクセシビリティ | [12-dialog-accessibility.md](./12-dialog-accessibility.md) |

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
21. [フォームの中でネストした作成を行う](./08-form-and-mutation.md#21-フォームの中でネストした作成を行う)
22. [カード詳細モーダルを編集可能にする](./09-editing-and-drag-and-drop.md#22-カード詳細モーダルを編集可能にする)
23. [dnd-kitの構成要素](./09-editing-and-drag-and-drop.md#23-dnd-kitの構成要素)
24. [センサーと`activationConstraint`](./09-editing-and-drag-and-drop.md#24-センサーとactivationconstraint)
25. [ドラッグ＆ドロップだけの楽観的更新](./09-editing-and-drag-and-drop.md#25-ドラッグドロップだけの楽観的更新)
26. [`DragOverlay`と見た目のコピー](./09-editing-and-drag-and-drop.md#26-dragoverlayと見た目のコピー)
27. [挿入位置の可視化](./09-editing-and-drag-and-drop.md#27-挿入位置の可視化)
28. [単一リストのドラッグ＆ドロップとドラッグハンドル](./09-editing-and-drag-and-drop.md#28-単一リストのドラッグドロップとドラッグハンドル)
29. [インライン改名編集とEscapeの競合](./10-board-management.md#29-インライン改名編集とescapeの競合)
30. [削除と`key`による再マウント](./10-board-management.md#30-削除とkeyによる再マウント)
31. [2つ目の削除機能——`useDelete`と`window.confirm`の再利用](./11-card-deletion.md#31-2つ目の削除機能usedeleteとwindowconfirmの再利用)
32. [影響範囲の見極め——なぜ`dataVersion`が要らないのか](./11-card-deletion.md#32-影響範囲の見極めなぜdataversionが要らないのか)
33. [oxlintの設定強化](./07-build-tooling.md#33-oxlintの設定強化)
34. [ネイティブ`<dialog>`とモーダルのアクセシビリティ](./12-dialog-accessibility.md#34-ネイティブdialogとモーダルのアクセシビリティ)

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

`BrowserRouter`・`Routes`・`Route`・`Link`・`useParams`・`useNavigate`という、React Routerの基本的な構成要素を解説します。`element`にはただのJSXを渡しているだけなので、他のコンポーネント同様にpropsを渡せる点や、どのURLにも一致しなかったときの受け皿になる`path="*"`（書く位置が意味を持つ唯一の`Route`）も扱います。

📄 詳細：[05-router.md](./05-router.md#13-react-routerの基本)

---

## 14. URLを状態の置き場所にする

`BoardSelect.tsx`の`useMatch`が体現する「真実の在り処は1つにする」という設計原則と、`SearchView.tsx`の`useSearchParams`・`Link`の`state`propsによる、検索条件と画面遷移履歴の管理を解説します。

📄 詳細：[05-router.md](./05-router.md#14-urlを状態の置き場所にする)

---

## 15. コンポーネント設計と状態の持ち方

`BoardSelect`を`<Routes>`の外側に置く理由、`renderContent()`をコンポーネント化しない理由、`CardItem`と`SearchResultItem`をあえて分けた理由など、個々の構文ではなく設計判断そのものを扱います。横断ビューで`CardCreateForm`をボードの数だけ並べたとき、stateがインスタンスごとに独立して管理される（＝1つしか開けないという制約を自前で書く必要が無い）ことも扱います。データ取得を「各コンポーネントが独立して行う」方針が2段階を経て取り下げられた経緯（Write→Readの競合、および親がすでに持っている値の二重取得）と、それでもContextには飛びつかない判断も扱います。

📄 詳細：[06-component-design.md](./06-component-design.md#15-コンポーネント設計と状態の持ち方)

---

## 16. npm・Vite・tsconfigと環境変数

`package.json`のスクリプトと依存関係、`vite.config.ts`、3つに分かれた`tsconfig.*.json`、`import.meta.env`と`.env.development`による環境変数の扱いを解説します。

📄 詳細：[07-build-tooling.md](./07-build-tooling.md#16-npmvitetsconfigと環境変数)

---

## 17. Tailwind CSSの読み方

ユーティリティファーストという考え方と、`StatusMessage.tsx`が明示している「クラス名を文字列連結で組み立ててはいけない」という重要な制約、Tailwindで表現できない値を`style`属性で扱う使い分け、`md:`のようなブレークポイント修飾子によるレスポンシブ対応を解説します。

📄 詳細：[07-build-tooling.md](./07-build-tooling.md#17-tailwind-cssの読み方)

---

## 18. フォームの実装

本プロジェクト初めての`<form>`・`onSubmit`・`preventDefault`を、カード追加フォーム・ボード管理モーダルを教材に解説します。要件5.2「タイトル未入力なら追加ボタンを無効化する」の実装、入力を個別の`useState`に分けた理由、開閉状態を持つフォームの設計も扱います。

📄 詳細：[08-form-and-mutation.md](./08-form-and-mutation.md#18-フォームの実装)

---

## 19. 書き込み（POST）とデータの更新

`useApi`をそのまま使えない書き込み処理のために新設した`useCreate`（後にPUT/PATCHにも対応する`useMutation`へ一般化。[22章](#22-カード詳細モーダルを編集可能にする)以降参照）、書き込み後に一覧を最新化する`refetch`、そして「なぜ楽観的更新にしないのか」（並び順の決定権はサーバーにあるという契約。ドラッグ＆ドロップにおける例外は[25章](#25-ドラッグドロップだけの楽観的更新)）を解説します。ボード一覧のstateを`App.tsx`へリフトアップした経緯——Contextに飛びつく前にまず検討すべき選択肢としてのリフトアップ——と、そのリフトアップが横断ビューへの`boards`受け渡しにもそのまま活きた経緯も扱います。

📄 詳細：[08-form-and-mutation.md](./08-form-and-mutation.md#19-書き込みpostとデータの更新)

---

## 20. `useRef`とDOMへの直接アクセス

フォームを開いた瞬間にタイトル入力欄へ自動でフォーカスを当てる実装を教材に、`useRef`と`useState`の違い（値の変化が再描画を引き起こすかどうか）、`useEffect`の中でDOM操作を行う理由を解説します。

📄 詳細：[08-form-and-mutation.md](./08-form-and-mutation.md#20-userefとdomへの直接アクセス)

---

## 21. フォームの中でネストした作成を行う

ラベルの新規作成（要件定義5.5）を教材に、カード作成フォームの中にもう1つの作成フォーム（ラベル作成）を組み込む実装を解説します。HTMLの`<form>`は入れ子にできないため`onClick`/`onKeyDown`から直接呼び出す設計にしたこと、同じ`useCreate`（現`useMutation`）を型引数だけ変えて2回呼び出し送信中・エラーを独立させたこと、作成した子リソース（ラベル）を親フォームの保留中state（`selectedLabelIds`）へ反映する設計、`ColorSwatchPicker`という新しいcontrolledコンポーネントを扱います。このラベル選択・作成のUIは、後にカード編集でも必要になり`components/LabelPicker.tsx`へ切り出されました（[22章](#22-カード詳細モーダルを編集可能にする)参照）。

📄 詳細：[08-form-and-mutation.md](./08-form-and-mutation.md#21-フォームの中でネストした作成を行う)

---

## 22. カード詳細モーダルを編集可能にする

閲覧専用だった`CardDetailModal`を、タイトル・ステータス・説明・期日・ラベルの5項目すべてを編集できるフォームへ書き換えました。5項目とも「保存」を押すまで送信しない下書きstateとして統一し、「保存」がバックエンドの2本のAPI（PUT本体・PATCHステータス）へどう振り分けるか、ステータスが変更されたときだけPATCHを送るガードがなぜ正しさの条件なのかを解説します。

📄 詳細：[09-editing-and-drag-and-drop.md](./09-editing-and-drag-and-drop.md#22-カード詳細モーダルを編集可能にする)

---

## 23. dnd-kitの構成要素

要件5.3のドラッグ＆ドロップを実現する`@dnd-kit/core`・`@dnd-kit/sortable`の主要な構成要素（`DndContext`・`useDroppable`・`useSortable`・`SortableContext`）を、カード一覧・カード1枚それぞれの実装を教材に解説します。

📄 詳細：[09-editing-and-drag-and-drop.md](./09-editing-and-drag-and-drop.md#23-dnd-kitの構成要素)

---

## 24. センサーと`activationConstraint`

`PointerSensor`・`TouchSensor`・`KeyboardSensor`という3種類のセンサーと、クリック・スクロールとドラッグ開始を区別するための`activationConstraint`（距離・遅延のしきい値）を解説します。

📄 詳細：[09-editing-and-drag-and-drop.md](./09-editing-and-drag-and-drop.md#24-センサーとactivationconstraint)

---

## 25. ドラッグ＆ドロップだけの楽観的更新

[19章](#19-書き込みpostとデータの更新)で見た「楽観的更新にしない」という方針の、唯一の例外を解説します。ドロップ操作が「動いた実感」と表示のズレに直結するという理由、`optimisticCards`をいつ手放すかという設計を扱います。

📄 詳細：[09-editing-and-drag-and-drop.md](./09-editing-and-drag-and-drop.md#25-ドラッグドロップだけの楽観的更新)

---

## 26. `DragOverlay`と見た目のコピー

ドラッグ中にポインタへ追従する見た目を、リスト内の実物ではなく専用の表示コンポーネントとして分離した理由を解説します。

📄 詳細：[09-editing-and-drag-and-drop.md](./09-editing-and-drag-and-drop.md#26-dragoverlayと見た目のコピー)

---

## 27. 挿入位置の可視化

ドラッグ中に挿入位置をラインで示すための`collisionDetection`のカスタマイズ（`pointerWithin`優先＋`closestCenter`フォールバック）、`onDragMove`と`onDragOver`の使い分け、`onDragCancel`、挿入位置の判定を1つの純粋関数にまとめてプレビューと確定処理を一致させる設計を解説します。

📄 詳細：[09-editing-and-drag-and-drop.md](./09-editing-and-drag-and-drop.md#27-挿入位置の可視化)

---

## 28. 単一リストのドラッグ＆ドロップとドラッグハンドル

ボードの並べ替え用フック（`useBoardDragAndDrop`）を、カード版（`useCardDragAndDrop`）と比較しながら解説します。列が1本しか無いことで自前の衝突判定・列識別子の組み立てが不要になる一方、`▲▼`・`改名`・`削除`ボタンと同居するため`setActivatorNodeRef`で`⠿`だけをドラッグ起点にする必要がある、という差分を扱います。

📄 詳細：[09-editing-and-drag-and-drop.md](./09-editing-and-drag-and-drop.md#28-単一リストのドラッグドロップとドラッグハンドル)

---

## 29. インライン改名編集とEscapeの競合

ボード管理モーダルの各行をその場で入力欄に切り替えるインライン編集を解説します。「編集中かどうか」を行自身ではなく親コンポーネントに持たせる理由、Reactの合成イベントとネイティブのイベント伝播の違いから生じるEscapeキーの競合とその解決方法を扱います。

📄 詳細：[10-board-management.md](./10-board-management.md#29-インライン改名編集とescapeの競合)

---

## 30. 削除と`key`による再マウント

ボード削除を教材に、`window.confirm()`による確認、`useMutation`とは別の`useDelete`フックを設けた理由、204 No Contentの受け取り方を解説します。削除の影響が「そのボードの詳細画面を見ていたかもしれない」「他のページが持つカード一覧を最新化する必要がある」という2点に及ぶことと、後者を`<Routes key={dataVersion}>`という`key`によるページ全体の再マウントで解決する設計を扱います。

📄 詳細：[10-board-management.md](./10-board-management.md#30-削除とkeyによる再マウント)

---

## 31. 2つ目の削除機能——`useDelete`と`window.confirm`の再利用

アーカイブ済みカードの「完全削除」（要件定義5.7）を教材に、ボード削除（30章）のために作った部品——`useDelete`フック・`window.confirm`による確認・`apiPaths`の使い回し——が、2つ目の削除機能にそのままどう乗るかを解説します。行ごとに`useDelete`を持たせる理由が`useMutation`と同じ罠から来ていること、確認メッセージの中身は削除が何を巻き込むかで決まること、エラー表示に`SortableBoardRow`の`<p role="alert">`ではなく`StatusMessage`を選んだ理由も扱います。

📄 詳細：[11-card-deletion.md](./11-card-deletion.md#31-2つ目の削除機能usedeleteとwindowconfirmの再利用)

---

## 32. 影響範囲の見極め——なぜ`dataVersion`が要らないのか

カードの完全削除では、ボード削除で必要だった`<Routes key={dataVersion}>`（30章）による全体再マウントが不要になります。「アーカイブ済みのカードのみ削除できる」という業務ルールが、削除の影響範囲をアーカイブ画面1枚に閉じ込めているためです。サーバー側の制約がフロントエンドの状態管理をどれだけ単純にするかという視点、楽観的更新をしない原則（19章）をここでも踏襲する理由を扱います。

📄 詳細：[11-card-deletion.md](./11-card-deletion.md#32-影響範囲の見極めなぜdataversionが要らないのか)

---

## 33. oxlintの設定強化

品質チェックを機に、2ルールしか有効にしていなかった`.oxlintrc.json`を見直しました。`categories`によるカテゴリ単位の有効化、`jsx-a11y`・`promise`・`import`プラグインの追加、そして機械的に追加しただけでは生じる誤検知（`react/react-in-jsx-scope`・`import/no-unassigned-import`）をどう見極めて除外したかを解説します。実際に検出された8件の指摘に加え、当初「有効化できない」と結論づけた`exhaustive-deps`が、実はプラグイン名の誤り（`react/`ではなく`react-hooks/`）だったという後日談も扱います。存在しないルール名なら設定の読み込み自体が失敗するという、気づけたはずの手がかりを見落としていた経緯も残しています。

📄 詳細：[07-build-tooling.md](./07-build-tooling.md#33-oxlintの設定強化)

---

## 34. ネイティブ`<dialog>`とモーダルのアクセシビリティ

`<div>`で組み立てていた2つのモーダルを、HTMLの`<dialog>`要素へ置き換えました。`open`属性ではなく`showModal()`を呼ばなければフォーカストラップも`::backdrop`も効かないという最大の落とし穴、命令的なDOM APIを`useRef`＋`useEffect`から呼ぶ形、Escapeの`cancel`イベントを`preventDefault()`で止めてReactのstate経由で閉じる理由、Tailwindの`backdrop:`バリアント、そして背景クリック判定に`role="presentation"`が残る理由を扱います。

📄 詳細：[12-dialog-accessibility.md](./12-dialog-accessibility.md#34-ネイティブdialogとモーダルのアクセシビリティ)

---

## 付録：このドキュメントで扱っていないReactの機能

Reactの入門書には載っているのに、本プロジェクトのコードには一度も登場しない機能があります。「知らないのは自分だけでは」と迷わないよう、意図的に扱っていない機能と、その理由をまとめておきます。

| 機能 | 本プロジェクトに登場しない理由 |
| --- | --- |
| Context（`useContext`） | [19章](#19-書き込みpostとデータの更新)・[15章](./06-component-design.md#15-コンポーネント設計と状態の持ち方)で述べたとおり、ボード一覧の消費者は4つ（`BoardSelect`・`BoardManageModal`・`CrossBoardView`・`SearchView`経由の`LabelFilterBar`）に増えたが、いずれも`App.tsx`から1〜2階層の距離にあり、リフトアップとpropsのリレーで足りている。階層がさらに深くなったときの検討課題として残る |
| `useReducer` | state更新のロジックが単純で、`useState`（[7章](#7-stateとusestate)）で足りている |
| `React.memo`（コンポーネントの再描画抑制） | 再描画コストが問題になるほど重いコンポーネントがまだ無い |
| エラーバウンダリ | 現状のエラー処理はAPI通信の失敗（[11章](#11-データ取得の3状態とレースコンディション)のstate）に限られ、予期しない描画エラー自体を捕捉する仕組みは未導入 |

`useCallback`（[19章](#19-書き込みpostとデータの更新)の`useApi.refetch`・`useMutation.mutate`）・`useRef`（[20章](#20-userefとdomへの直接アクセス)）は、カード・ボードの新規作成の実装にあわせて登場したため、このリストから外れました。ドラッグ＆ドロップも、カードの更新機能（要件5.3）の実装により[23〜27章](./09-editing-and-drag-and-drop.md)で扱うようになったため、このリストから外れています。残る機能も、Write系API（DELETE等）の実装が進むにつれて登場する可能性があります。実装に登場した時点で、下記の更新ルールに従ってこのドキュメント群に章を追加してください。

## このドキュメントの更新ルール

- 開発を進める中で新しい概念・技術要素（例：Context、フォーム送信、認証状態の管理、ドラッグ＆ドロップなど）が登場したら、**都度このドキュメント群を更新すること**を本プロジェクトのルールとします。
- 既存ファイルへの追記で収まる内容はそのファイルに追記し、独立したまとまりを持つ新しいトピックは`08-xxx.md`のように連番でファイルを追加してください。章番号もこのREADMEの続き（18章、19章…）として振ってください。
- 新しいファイルを追加した場合は、このREADMEの「ファイル構成」表と「目次」の両方を更新し、ハブと詳細ファイルの対応が常に成立している状態を保ってください。
- TypeScript**言語**自体の機能（ジェネリクス・ユニオン型など）は[docs/typescript/](../typescript/README.md)側の更新ルールに従い、そちらに追記してください。両方にまたがる概念（例：カスタムフックの型引数としてのジェネリクス）は、言語機能としての説明をTypeScript側、使い所の説明をこちらに置き、相互リンクしてください。

---

*本ドキュメントは開発と並行して育てていく学習ノートです。実装で分からないReactの概念が出てきたら、まずここに解説がないか確認し、無ければ追記してください。*
