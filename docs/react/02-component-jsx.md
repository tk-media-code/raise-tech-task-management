# コンポーネントとJSXの書き方

[← React学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **3〜6章** をまとめています。

---

## 3. コンポーネントとJSX

> **JSXとは？**
> JavaScript（TypeScript）のコードの中に、HTMLに似たタグを直接書ける構文拡張です。ブラウザはJSXをそのまま実行できないため、[docs/react 16章](./07-build-tooling.md#16-npmvitetsconfigと環境変数)で扱うViteが、実行前に`React.createElement(...)`という普通の関数呼び出しへ変換します。

本プロジェクトでもっとも単純なコンポーネントの1つが`components/LabelChip.tsx`です。

```typescript
function LabelChip({ label }: Props) {
  return (
    <span
      style={{ backgroundColor: label.color, color: getContrastTextColor(label.color) }}
      className="rounded-full px-2 py-0.5 text-xs font-medium"
    >
      {label.name}
    </span>
  )
}

export default LabelChip
```

**コンポーネントとは、JSXを返す関数**です。`LabelChip`は先頭が大文字の関数で、`<LabelChip label={someLabel} />`のようにタグとして呼び出せます（先頭が小文字だと、Reactは独自コンポーネントではなく`<div>`や`<span>`と同じ標準HTMLタグだと解釈してしまうため、コンポーネント名は必ず大文字始まりにする決まりです）。

### JSXの中の`{}`：JavaScript式を埋め込む

`{label.name}`・`{getContrastTextColor(...)}`のように、JSXの中で`{}`に囲まれた部分は、静的なテキストではなく**評価されたJavaScript（TypeScript）の式**です。変数の値・関数呼び出しの結果・三項演算子の結果など、値を返す式であれば何でも埋め込めます（`if`文のような「値を返さない文」は埋め込めません。条件分岐の書き方は[5章](#5-条件付きレンダリングとリスト描画key)で扱います）。

### `className`と`style`の使い分け

```typescript
<span
  style={{ backgroundColor: label.color, color: getContrastTextColor(label.color) }}
  className="rounded-full px-2 py-0.5 text-xs font-medium"
>
```

HTMLの`class`属性は、JSXでは`className`という名前になります（JavaScriptの予約語`class`と衝突するためです）。[docs/react 17章](./07-build-tooling.md#17-tailwind-cssの読み方)で扱うTailwind CSSのユーティリティクラスは、この`className`に文字列として並べます。一方`style`属性は、`{ backgroundColor: '...', color: '...' }`という**オブジェクト**を渡します（`style={{ ... }}`の外側の`{}`はJSXの式埋め込み、内側の`{}`はオブジェクトリテラルという、2つの`{}`が重なっています）。`LabelChip`のコメントが、この使い分けの理由を説明しています。

```typescript
// 色は固定クラスではなくlabel.color由来の値なので、Tailwindのユーティリティクラスでは
// 表現できない（クラス名はビルド時に静的に決まっている必要があるため）。
// このような「実行時にしか決まらない値」はstyle属性でインラインに指定する。
```

ラベルの色はデータベースに保存された値であり、ビルド時には何色になるかわかりません。Tailwindのクラス（`bg-red-500`など）は事前に決まった組み合わせしか使えないため、実行時に決まる値は`style`属性で直接指定する、という使い分けです。

### JSXは自動的にエスケープされる

`components/CardDetailModal.tsx`には、JSXの安全性に関するコメントがあります。

```typescript
{/* whitespace-pre-wrap: DBに入っている改行をそのまま表示する。
    JSXは文字列をテキストとして描画するので、HTMLタグとして解釈されない
    （prototype/app.jsのescapeHtml相当を自分で書く必要はない）。 */}
<dd className="whitespace-pre-wrap text-slate-700">
```

`{card.description}`のように文字列を埋め込むと、たとえその文字列が`<script>...</script>`のようなHTMLタグに見える内容であっても、Reactは常に**テキストとして**画面に表示します（タグとして解釈して実行することはありません）。素のDOM操作で`innerHTML`を使う場合に必要になるエスケープ処理（HTMLタグとして解釈されないよう`<`を`&lt;`に変換するような処理）を、自分で書く必要が無いのはこのためです。

---

## 4. propsと型付け

> **propsとは？**
> 親のコンポーネントから子のコンポーネントへ渡される「引数」です。コンポーネントが関数である以上、propsはその関数の**引数そのもの**です。

`components/CardItem.tsx`の型定義を見てください。

```typescript
type Props = {
  card: CardResponse
  onSelect: (cardId: number) => void
}

function CardItem({ card, onSelect }: Props) {
  return (
    <button type="button" onClick={() => onSelect(card.id)} /* ... */>
```

`type Props = { ... }`（[docs/typescript 3章](../typescript/02-object-types.md#3-オブジェクトの型typeエイリアス)の`type`エイリアス）で、このコンポーネントが受け取る値の形を定義します。`function CardItem({ card, onSelect }: Props)`の`{ card, onSelect }`は、TypeScript固有の構文ではなくJavaScriptの**分割代入**で、「`Props`型の引数を受け取り、その`card`プロパティと`onSelect`プロパティをその場で別々の変数として取り出す」という書き方です。呼び出す側は`<CardItem card={someCard} onSelect={handleSelect} />`のように、JSXのタグの属性としてpropsを渡します。

### コールバックprops：子から親への「通知」

`onSelect: (cardId: number) => void`という型は、「`number`を1つ受け取り、何も返さない関数」を表します。`CardItem`自身はこの関数を**呼び出すだけ**で、クリックされたときに何が起こるべきかは一切知りません。

```typescript
onClick={() => onSelect(card.id)}
```

実際に何が起きるかは、`CardItem`を使う側（`pages/CrossBoardView.tsx`）が決めます。

```typescript
<CardItem
  key={card.id}
  card={card}
  onSelect={(cardId) => setSelectedCardId(cardId)}
/>
```

Reactのデータの流れは、親から子へ渡す**props**と、子から親へ「何かが起きたことを知らせる」**コールバックprops**の組み合わせで作られます。子コンポーネントが親のstate（[7章](./03-state-effect.md#7-stateとusestate)）を直接書き換えることはできず、必ず「呼んでほしい関数」を親から渡してもらう形になります。これを**単方向データフロー**と呼びます。

### `children`：タグに囲まれた中身を受け取る

`components/StatusColumn.tsx`は、`children`という特別なpropsを使っています。

```typescript
import type { ReactNode } from 'react'

type Props = {
  title: string
  count: number
  children: ReactNode
}

function StatusColumn({ title, count, children }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
      <h3 className="text-sm font-semibold text-slate-700">
        {title} ({count})
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}
```

呼び出し側は次のように、開始タグと終了タグの**間**にJSXを書きます。

```typescript
<StatusColumn key={status} title={STATUS_LABELS[status]} count={...}>
  {/* この部分がchildrenとして渡される */}
  {statusCards.map((card) => <CardItem key={card.id} card={card} onSelect={...} />)}
</StatusColumn>
```

`children`は`<StatusColumn>`と`</StatusColumn>`の間に書かれた内容を、自動的に受け取る特別な名前のpropsです。`ReactNode`という型（[docs/typescript 12章](../typescript/05-class-module.md#12-モジュールとimport-type)の`import type`で取り込んでいます）は、「JSXとして描画できるものすべて」（要素・文字列・数値・配列・`null`など）を表す型です。コメントにあるとおり、`StatusColumn`は「見出し＋件数の付いた枠」という外側の見た目だけを担当し、**中身が何であるかを一切知らない**まま再利用できるのが`children`の利点です。

---

## 5. 条件付きレンダリングとリスト描画（`key`）

### `&&`による条件付きレンダリング

`components/CardItem.tsx`は、期日やラベルが無いカードでは、その行自体を描画しません。

```typescript
{(card.dueDate !== null || card.labels.length > 0) && (
  <div className="mt-2 flex flex-wrap items-center gap-1.5">
    {card.dueDate !== null && <DueDateBadge dueDate={card.dueDate} />}
    {card.labels.map((label) => (
      <LabelChip key={label.id} label={label} />
    ))}
  </div>
)}
```

`条件 && <JSX>`は、「`条件`が`true`のときだけ`<JSX>`を描画する」という、JavaScriptの短絡評価（[docs/java 25章](../java/06-exception-and-null.md#25-nullとnullpointerexception)で学んだ`&&`と同じ仕組み）をJSXに応用した書き方です。`条件`が`false`のとき、`&&`式全体は`false`という値になり、Reactは`false`・`null`・`undefined`を「何も描画しない」印として扱います。

### 落とし穴：左辺が`0`だと画面に「0」が出る

`components/CardDetailModal.tsx`のコメントが、この構文の注意点を説明しています。

```typescript
{/* cardがnullでないときだけ中身を描く。`&&`の左辺がnullやfalseだとReactは
    何も描画しないが、左辺が数値の0だと画面に「0」がそのまま出てしまう
    （Reactでよくあるバグ）。ここはboolean判定なので問題ない。 */}
{card !== null && (
```

`件数 && <何か>`のように、左辺が**数値**の条件式を書いてしまうと、件数が`0`のときに`&&`式全体が`0`という値になり、Reactはそれを「描画しない」ではなく「`0`という文字を描画する」と解釈してしまいます（`0`は`false`ではないためです）。本プロジェクトのコードが徹底しているのは、`&&`の左辺を必ず`card !== null`・`card.dueDate !== null`のような**明示的な`boolean`の式**にすることです。こうしておけば左辺は常に`true`か`false`のどちらかにしかならず、数値の`0`が紛れ込む余地がありません。

### 三項演算子とネストを避ける工夫

`if`/`else`のような分岐が必要な場面では、三項演算子（`条件 ? A : B`）を使います。ただしネストした三項演算子は読みにくくなるため、`pages/CrossBoardView.tsx`は`renderContent()`という関数の中で、早期returnを重ねる形に書き換えています。

```typescript
function renderContent() {
  if (loading) return <StatusMessage kind="loading">読み込み中…</StatusMessage>
  if (error !== null) {
    return <StatusMessage kind="error">読み込みに失敗しました：{error.message}</StatusMessage>
  }
  if (cards === null || cards.length === 0) {
    return <StatusMessage kind="empty">表示できるカードがありません。</StatusMessage>
  }
  return ( /* 3列のカンバン */ )
}
```

「読み込み中→失敗→0件→正常」という優先順位が、上から順にそのまま縦に並んで読めます。この関数がなぜコンポーネントとしてではなく、ただの関数として呼び出されているのかは[docs/react 15章](./06-component-design.md#15-コンポーネント設計と状態の持ち方)で扱います。

### リスト描画と`key`

配列から複数のJSXを生成するときは`.map(...)`を使い、各要素に`key`という特別なpropsを付けます。

```typescript
{card.labels.map((label) => (
  <LabelChip key={label.id} label={label} />
))}
```

> **`key`とは？**
> Reactが「配列の各要素がどのDOM要素に対応するか」を追跡するための目印です。並び替えや要素の増減が起きたとき、`key`が無いとReactはどの要素が変化したのか判断できず、影響が無いはずの要素まで作り直してしまいます（入力中の値やアニメーションの状態が失われる原因になります）。

本プロジェクトのコード各所に、「`key`には配列のindexではなく、中身が変わっても揺れないID（`label.id`・`board.id`など）を使う」という一貫した注意書きがあります（`components/BoardSelect.tsx`より）。

```typescript
{(boards ?? []).map((board) => (
  // keyは「配列の各要素がどのDOMに対応するか」をReactに教える目印。
  // 並び替えや増減が起きたとき、これが無いとReactは要素を作り直してしまい、
  // 入力中の値やスクロール位置が飛ぶ。配列のindexではなく、
  // 中身が動いても変わらないID（board.id）を使うのが鉄則。
  <option key={board.id} value={String(board.id)}>
    {board.name}
  </option>
))}
```

配列のindex（0, 1, 2, ...）を`key`にすると、先頭に新しい要素が1つ追加されただけで全要素のindexがずれ、Reactから見ると「全部の要素の中身が変わった」ように見えてしまいます。`id`のような、要素固有で並び替えても変わらない値を使うことで、この誤検出を防いでいます。

---

## 6. イベントハンドラと制御コンポーネント

### `onClick`・`onChange`：イベントハンドラ

Reactでは、HTMLの`onclick`属性ではなく`onClick`という**キャメルケース**のpropsにイベントハンドラ（関数）を渡します。

```typescript
// components/CardItem.tsx
<button type="button" onClick={() => onSelect(card.id)} /* ... */>
```

`onClick={() => onSelect(card.id)}`のように、アロー関数で包んでいる点に注目してください。`onClick={onSelect}`と書いてしまうと、クリック時にReactが自動的に渡す「イベントオブジェクト」が`onSelect`の引数（本来は`cardId: number`）にそのまま渡ってしまい、型が合わずコンパイルエラーになります。「引数を渡して呼びたい」ときは、アロー関数で1段階包む必要があります。

### 制御コンポーネント：フォームの値をReact側に持たせる

`components/BoardSelect.tsx`の`<select>`は、**制御コンポーネント**と呼ばれるパターンで実装されています。

```typescript
<select
  value={selectedValue}
  onChange={handleChange}
  disabled={loading}
  /* ... */
>
```

> **制御コンポーネントとは？**
> フォーム要素（`<input>`・`<select>`など）の「今表示されている値」を、DOM自身にではなく、React側の値（state・URLなど）に握らせる書き方です。`value`props（表示する値）と`onChange`ハンドラ（変更があったら何をするか）を必ずセットで渡します。

`BoardSelect`のコメントが、この設計の意図を説明しています。

```typescript
// 現在どのボードを見ているかを、useStateではなくURLから導き出す。
// stateに持つと「ブラウザの戻るボタンでURLだけが変わり、セレクトの表示が
// 取り残される」というバグが必ず生まれる。真実の在り処（source of truth）は
// 1つにする——今回のReact Routerの使い方でいちばん大事な考え方。
```

`value={selectedValue}`の`selectedValue`は、[docs/react 14章](./05-router.md#14-urlを状態の置き場所にする)で扱う`useMatch`（React Router）からURLをもとに導出された値です。ユーザーが`<select>`を操作すると`onChange`（`handleChange`）が呼ばれ、そこでは値を直接書き換えるのではなく`navigate(...)`でURLを変更しています。

```typescript
function handleChange(event: ChangeEvent<HTMLSelectElement>) {
  const value = event.target.value
  navigate(value === ALL_BOARDS ? '/' : `/boards/${value}`)
}
```

`event: ChangeEvent<HTMLSelectElement>`は、`<select>`の`onChange`が受け取るイベントオブジェクトの型です（`ChangeEvent`は[docs/typescript 7章](../typescript/03-generics.md#7-ジェネリクス)のジェネリクスで、`<HTMLSelectElement>`の部分によって`event.target`が`<select>`要素として型付けされ、`.value`に安全にアクセスできます）。URLが変わると、React Routerが再描画をトリガーし、`selectedValue`も新しいURLに基づいて再計算されるため、`<select>`の表示は常にURLと一致します。

`pages/SearchView.tsx`のキーワード入力欄も同じパターンです。

```typescript
<input
  type="text"
  value={keywordInput}
  onChange={(event) => setKeywordInput(event.target.value)}
  placeholder="キーワード（タイトル・説明）"
/>
```

こちらは`state`（[7章](./03-state-effect.md#7-stateとusestate)の`useState`）が真実の在り処になっている、より基本的な制御コンポーネントの例です。`value`にstateを渡し、`onChange`でそのstateを更新する、という組み合わせが制御コンポーネントの基本形になります。
