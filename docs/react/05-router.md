# React Routerによるルーティング

[← React学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **13〜14章** をまとめています。

---

## 13. React Routerの基本

> **React Routerとは？**
> Reactアプリの中で、URLに応じて表示するコンポーネントを切り替えるためのライブラリです。[docs/react 2章](./01-overview.md#2-アプリの起動と全体構成)で見た「SPA（Single Page Application）」は、ページ遷移のたびにサーバーへ新しいHTMLを取りに行かないため、ブラウザの「URLが変わったら別のページ」という標準の仕組みだけでは画面を切り替えられません。React Routerは、URLの変化をブラウザの**History API**で検知し、ページ全体を再読み込みすることなく表示だけを切り替えます。

### `BrowserRouter`：ルーティング機能を配下全体に届ける

```typescript
// main.tsx
<BrowserRouter>
  <App />
</BrowserRouter>
```

`<BrowserRouter>`でアプリ全体を包むことで、配下のどのコンポーネントからでも、この後に出てくる`<Link>`・`useParams`・`useNavigate`などのルーティング機能が使えるようになります。この仕組みは[docs/react 15章](./06-component-design.md#15-コンポーネント設計と状態の持ち方)で扱う「Context」というReactの機能の応用ですが、使う側は`<BrowserRouter>`で包むだけでよく、内部の仕組みを意識する必要はありません。

### `Routes`・`Route`：URLとコンポーネントの対応表

```typescript
// App.tsx
<Routes>
  <Route path="/" element={<CrossBoardView />} />
  <Route path="/boards/:boardId" element={<BoardDetailView />} />
  <Route path="/search" element={<SearchView />} />
</Routes>
```

`<Routes>`は、その中の`<Route>`を順番に調べ、現在のURLに一致する**最初の1つだけ**を描画します。`path="/boards/:boardId"`の`:boardId`のように、コロンで始まる部分は**動的セグメント**と呼ばれ、`/boards/1`でも`/boards/42`でも、この`Route`にマッチします。

`element`に渡している`<CrossBoardView />`は、React Router専用の特別な構文ではなく、ただの**JSX**です。そのため他のコンポーネントを描画するときとまったく同じように、propsをそのまま渡せます。

```typescript
// App.tsx（横断ビューにボード一覧を渡す）
<Route path="/" element={<CrossBoardView boards={boards} />} />
```

`<CrossBoardView boards={boards} />`という式が評価された結果（JSX要素）を`element`に渡しているだけなので、`<Route>`自身は「渡された要素をそのまま描画する」以上のことをしていません。`path`と違い`element`は文字列ではなくJSXを受け取る、という点を押さえておくと、`<Route>`に対してどんな値を渡せて何を渡せないのかで迷わずに済みます。

### `Link`：ページ全体を再読み込みしないリンク

`App.tsx`の検索アイコンは、`<a>`タグではなく`<Link>`コンポーネントです。

```typescript
<Link
  to="/search"
  state={{ from: `${location.pathname}${location.search}` }}
  title="検索"
  aria-label="検索"
>
  🔍
</Link>
```

`<a href="/search">`と書いてしまうと、クリックのたびにブラウザがサーバーへ新しいHTMLを取りに行き、SPAとしての利点（Reactの状態を保ったまま画面を切り替える）が失われます。`<Link to="...">`はクリックを横取りし、実際のHTTPリクエストを発生させずにURLとReactの表示だけを変更します。`state`propsについては[14章](#14-urlを状態の置き場所にする)で扱います。

### `useParams`：URLの動的セグメントを読み取る

`pages/BoardDetailView.tsx`は、URLの`:boardId`部分を取得しています。

```typescript
const { boardId } = useParams<{ boardId: string }>()
```

`useParams`は、`<Route path="/boards/:boardId">`で定義した動的セグメントの値を、常に**文字列**として返します（URLはもともと文字列なので、`number`型で返ってくることはありません）。戻り値の型が`string`ではなく`string | undefined`（[docs/typescript 6章](../typescript/02-object-types.md#6-nullundefinedとstrictnullchecks)）である理由がコメントで説明されています。

```typescript
// boardIdの型はstring | undefined（React Routerは「このURLパターンに実際に
// マッチしたか」を型では表現できないため）。App.tsxのルート定義
// ("/boards/:boardId") を通ってこの画面が描画される限り実際には必ず文字列になるが、
// 型どおりundefinedの可能性にも備えておく。
const path = boardId === undefined ? null : apiPaths.cards({ boardId })
```

実際にはこの画面が描画される時点で`boardId`は必ず値を持ちますが、TypeScriptの型システムは「`BoardDetailView`が`/boards/:boardId`という特定のルートからしか描画されない」という前提までは追跡できないため、型上は`undefined`の可能性が残ります。`boardId === undefined ? null : ...`で、その型どおりの可能性に安全に対処しています（`useApi`に`null`を渡すと通信しないという、[docs/react 11章](./04-custom-hooks.md#11-データ取得の3状態とレースコンディション)の性質を利用しています）。

### `useNavigate`：プログラムからURLを変更する

`components/BoardSelect.tsx`は、`<select>`の選択が変わったときにURLを書き換えます。

```typescript
const navigate = useNavigate()

function handleChange(event: ChangeEvent<HTMLSelectElement>) {
  const value = event.target.value
  navigate(value === ALL_BOARDS ? '/' : `/boards/${value}`)
}
```

`useNavigate()`が返す`navigate`関数は、「`<Link>`をクリックしたのと同じこと」をコードから行うための関数です。クリックのようなユーザー操作ではなく、`<select>`の変更やボタン処理の結果としてURLを変えたい場合に使います。

---

## 14. URLを状態の置き場所にする

本プロジェクトのルーティングでもっとも重要な設計判断は、「何かの状態を`useState`に持たせるべきか、それともURLに持たせるべきか」という判断です。`components/BoardSelect.tsx`のコメントが、この判断基準を明確に述べています。

```typescript
// 現在どのボードを見ているかを、useStateではなくURLから導き出す。
// stateに持つと「ブラウザの戻るボタンでURLだけが変わり、セレクトの表示が
// 取り残される」というバグが必ず生まれる。真実の在り処（source of truth）は
// 1つにする——今回のReact Routerの使い方でいちばん大事な考え方。
```

> **source of truth（真実の在り処）とは？**
> ある情報を「どこか1箇所にだけ持たせ、他の場所はそこから導出する」という設計原則です。同じ情報を複数の場所（`useState`とURLの両方など）に別々に持たせてしまうと、片方だけが更新されて食い違う——という不整合が必ず起こります。

### `useMatch`：URLをそのままstateの代わりに使う

```typescript
const match = useMatch('/boards/:boardId')
const selectedValue = match === null ? ALL_BOARDS : (match.params.boardId ?? ALL_BOARDS)
```

`useMatch(パターン)`は、現在のURLが指定したパターンに一致すればマッチ情報を、しなければ`null`を返します。`BoardSelect`は「今どのボードが選ばれているか」を`useState`にもたせるのではなく、`useMatch`で**その都度URLから計算**しています。もしこれを`useState`で管理していたら、ブラウザの「戻る」ボタンでURLが`/boards/1`から`/`に変わったとき、URLは変わってもstateは変わらないため、`<select>`の表示だけが古いまま取り残されてしまいます。URLを直接の情報源にすることで、「ブラウザの戻る/進む」「`<Link>`のクリック」「`navigate(...)`の呼び出し」——URLが変わるあらゆる経路に対して、常に一貫した表示を保証できます。

### `useSearchParams`：検索条件をURLのクエリパラメータに持たせる

`pages/SearchView.tsx`は、キーワードとラベルによる絞り込み条件を`useSearchParams`で管理しています。

```typescript
const [searchParams, setSearchParams] = useSearchParams()

const keywordInUrl = searchParams.get('q') ?? ''
const labelIdsInUrl = parseLabelIds(searchParams)
```

`useSearchParams`は`useState`とよく似た`[値, 更新関数]`の形をしていますが、値の読み書きが**URLのクエリパラメータ**（`?q=...&labels=...`）に対して行われる点が異なります。コメントに、`useState`ではなくこちらを選んだ理由が書かれています。

```typescript
// 検索条件（キーワード・ラベル）は component の state ではなくURLクエリパラメータ
// （useSearchParams）に持たせている。ブックマーク・リロードで条件が消えないことに加え、
// ブラウザの戻る/進むで絞り込みの変更履歴を辿れるようにするため
```

検索条件をURLに持たせることで、「このURLをブックマークすれば同じ検索結果に戻れる」「リロードしても条件が消えない」という利点に加え、キーワードやラベルを変更するたびに1つの履歴エントリが積まれるため、ブラウザの「戻る」ボタンで絞り込みの変更を1つずつ遡れるようになります。

### `state`props：URLに乗せたくない一時的な情報を運ぶ

`App.tsx`の`<Link>`は、`to`とは別に`state`propsを渡していました。

```typescript
<Link to="/search" state={{ from: `${location.pathname}${location.search}` }}>
```

`state`は、URLの一部にはならないものの、遷移先の画面へ受け渡したい情報を運ぶための仕組みです。`pages/SearchView.tsx`の「← 戻る」ボタンは、この`state`を使って「検索を開く直前の画面」を記憶しています。

```typescript
const [fromPath] = useState(() => (location.state as SearchLocationState | null)?.from ?? '/')
```

なぜ検索条件のようにURLへ含めず`state`を使うのでしょうか。理由はコメントで説明されています。

```typescript
// 「← 戻る」の遷移先。検索中に打鍵・ラベル選択のたびに履歴エントリが積まれていくため
// （下記のURL同期を参照）、単純にnavigate(-1)で1つ前に戻ると、検索を開く前の画面ではなく
// 「1つ前の絞り込み状態」に着地してしまう。
```

検索条件を変更するたびに履歴エントリが積まれる（前段落の設計）ため、単純に「1つ前の履歴に戻る」だけでは、検索を開く直前の画面ではなく「1つ前の検索条件」に着地してしまいます。「検索画面へ最初に入った時点のパス」という、検索条件の変化とは無関係な1つの値を`state`として固定しておくことで、何度検索条件を変えていても、「← 戻る」は常に同じ場所（`navigate(fromPath)`）へ一直線に戻れます。

`setSearchParams`を呼ぶ際にも、この`fromPath`を毎回明示的に引き継いでいます。

```typescript
setSearchParams(
  (prev) => { /* ... */ },
  { state: { from: fromPath } satisfies SearchLocationState },
)
```

コメントによれば、`setSearchParams`は新しく積む履歴エントリへ`state`を自動的には引き継いでくれない（前のエントリの`state`が消える）ため、検索条件を更新するたびに`{ state: { from: fromPath } }`を明示的に渡し直しています。`satisfies`（[docs/typescript 10章](../typescript/04-narrowing.md#10-型アサーションassatisfies)）は、この`state`オブジェクトが本当に`SearchLocationState`型の形を満たしているかをコンパイル時に検査しています。
