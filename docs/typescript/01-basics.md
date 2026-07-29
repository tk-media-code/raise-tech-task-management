# TypeScriptという言語の土台

[← TypeScript学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **1〜2章** をまとめています。

---

## 1. TypeScriptとは

> **TypeScriptとは？**
> JavaScriptに**静的型付け**（[docs/java 4章](../java/01-basics.md#4-静的型付け変数に型を書くということ)で学んだのと同じ考え方）を追加した言語です。書いたコードはブラウザやNode.jsで直接実行できる形式ではなく、最終的には型注釈を取り除いた**ただのJavaScript**に変換されてから実行されます。

`frontend/package.json`のビルドスクリプトに、TypeScriptが登場する箇所があります。

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  ...
}
```

`npm run build`は2段階の処理です。

1. **`tsc -b`**：TypeScriptコンパイラ（`tsc`）が、プロジェクト全体の型に誤りが無いかを検査します（`-b`は`tsconfig.json`の`references`をまとめてビルドするオプション）。本プロジェクトの`tsconfig.app.json`は`"noEmit": true`（[docs/typescript 7章](./03-generics.md#7-ジェネリクス)より前に登場する設定ですが、ここでは「ファイルを出力しない」という意味だけ押さえてください）になっているため、この段階では**JavaScriptファイルは1つも生成されません**。型チェックだけを行い、誤りがあればここでビルド自体が失敗します。
2. **`vite build`**：実際にブラウザで動くJavaScriptへの変換（型注釈を取り除く処理）とバンドル（複数ファイルを1つにまとめる処理）を行うのはこちらです。Viteは内部で高速なツール（esbuild）を使い、型チェックをせずに型注釈を機械的に取り除くだけの処理をします。

**型チェック（`tsc`）と変換（Vite）が別のツールに分かれている**のがポイントです。開発中（`npm run dev`）はViteの高速な変換だけが働くため、型の誤りがあっても画面はいったん表示されます（保存するたびにブラウザのエディタや`tsc`が別途警告してくれます）。一方`npm run build`は`tsc -b`を先に通すため、型の誤りがあれば本番ビルド自体を止められます。

> **Javaとの対比**
> [docs/java 1章](../java/01-basics.md#1-javaの実行の仕組みjavacとjvm)で学んだ「`javac`でコンパイル→JVMで実行」という2段階と似ていますが、決定的な違いがあります。Javaの`javac`は**バイトコード**という、ソースコードとは別の実行形式に変換します。TypeScriptの変換は、型注釈を消すだけで**同じJavaScriptという言語のまま**という点で、正確には「コンパイル」よりも「型の消去（type erasure）」と呼ぶ方が実態に近い処理です。生成物の性質は違いますが、「実行前に型の誤りを検出できる」という利点は共通しています。

### `erasableSyntaxOnly`：消去できる構文だけを許可する

`tsconfig.app.json`には、この「型注釈を機械的に消すだけ」という前提を保証するための設定があります。

```json
"erasableSyntaxOnly": true,
```

TypeScriptには、`enum`（値を持つ列挙型）や`namespace`のように、**型注釈の消去だけでは済まず、実行可能なJavaScriptコードを新たに生成しないといけない構文**が一部にあります。`erasableSyntaxOnly`は、そうした構文の使用をコンパイルエラーにする設定です。これにより「Viteのような型チェックをしないツールが、型注釈を消すだけの単純な処理で正しく変換できる」ことがコード上で保証されます。本プロジェクトでは今のところ`enum`や`namespace`を使っておらず（[docs/java README付録](../java/README.md#付録このドキュメントで扱っていないjavaの機能)でJavaの`enum`も未使用と説明しているのと対応します）、この設定と矛盾しません。

---

## 2. 型注釈と型推論

> **型注釈と型推論とは？**
> 「型注釈」は`hex: string`のようにコード上へ明示的に型を書くこと、「型推論」は型を書かなくてもTypeScriptが初期値などから自動的に型を決めてくれることです。TypeScriptはこの両方を組み合わせて使います。

`lib/color.ts`の`getContrastTextColor`は、両方が同時に登場する例です。

```typescript
export function getContrastTextColor(hex: string): string {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#172b4d' : '#ffffff'
}
```

- `hex: string`（引数）と`: string`（戻り値、関数名の右）は**型注釈**です。この関数を呼ぶ側は必ず文字列を渡さなければならず、戻り値も必ず文字列になることが、コード上に明示されています。
- `const c = ...`・`const r = ...`のような**関数の中の変数**には型を書いていません。`hex.replace(...)`の戻り値が`string`であることをTypeScript自身が知っているため、`c`の型も自動的に`string`だと**推論**されます。同様に`parseInt(...)`は常に`number`を返すので、`r`・`g`・`b`も`number`と推論されます。

### なぜ全部に型を書かないのか

> **Javaとの対比**
> 本プロジェクトのJavaコードは、[docs/java 4章](../java/01-basics.md#4-静的型付け変数に型を書くということ)で見たとおり`List<Card> cards = ...`のように、ローカル変数にも型を必ず明記するスタイルを徹底しています（`var`によるローカル変数型推論も[使わない方針](../java/README.md#付録このドキュメントで扱っていないjavaの機能)です）。TypeScriptのコードは対照的に、**関数の境界（引数・戻り値・exportする値）にだけ型注釈を書き、関数の内部は推論に任せる**スタイルが主流です。同じ「静的型付け」でも、型を書く密度の慣習がJavaとTypeScriptでは異なります。

型が要らないわけではなく、`c`にも`r`にも実際には`string`・`number`という型がコンパイラの中では存在し続けています。マウスオーバーすればエディタが型を教えてくれますし、`r`に文字列を代入しようとすればコンパイルエラーになります。「型が無い」のではなく「書かなくても済むように、コンパイラが賢く補ってくれている」だけです。

### 関数の引数はなぜ推論に頼れないのか

戻り値や変数の型は初期値から推論できますが、関数の**引数**は違います。`getContrastTextColor(hex)`と書いたとき、`hex`に何が渡されるかは呼び出してみるまでわからないため、`hex: string`という注釈が無いと、TypeScriptは`hex`をどんな操作にも使える`any`型（実質的に型チェックを諦めた状態）として扱ってしまいます。関数の引数には基本的に型注釈が必須だと考えてください。

ただし例外もあります。`components/BoardSelect.tsx`のコールバック引数を見てください。

```typescript
{(boards ?? []).map((board) => (
  <option key={board.id} value={String(board.id)}>
```

`(board) => (...)`の`board`には型注釈がありません。それでも`board.id`のようにプロパティへアクセスでき、存在しないプロパティを使おうとするとエラーになります。これは`boards`の型が`BoardResponse[] | null`（[3章](./02-object-types.md#3-オブジェクトの型typeエイリアス)）だとわかっているため、その配列に対する`.map(...)`が呼ぶコールバックの引数は`BoardResponse`型のはずだ、とTypeScriptが**文脈から**推論してくれるためです。これを**コンテキスト型推論**と呼びます。「関数の引数は基本的に注釈が必要」という原則の例外というより、「配列の要素の型という文脈がすでにあるので、そこから推論できる」という位置づけです。
