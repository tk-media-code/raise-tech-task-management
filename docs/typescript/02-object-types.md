# オブジェクトの型とnull安全性

[← TypeScript学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **3〜6章** をまとめています。

---

## 3. オブジェクトの型（`type`エイリアス）

> **`type`エイリアスとは？**
> オブジェクトの形（どんなプロパティを持つか）に名前を付ける構文です。`type 名前 = { ... }`と書くと、以後その名前を1つの型として使い回せます。

本プロジェクトの型定義は、すべて`types/api.ts`に集約されています。

```typescript
export type BoardResponse = {
  id: number
  name: string
  position: number
  createdAt: string
}

export type CardResponse = {
  id: number
  boardId: number
  boardName: string
  title: string
  description: string | null
  dueDate: string | null
  status: CardStatus
  isArchived: boolean
  position: number
  labels: LabelResponse[]
}
```

`BoardResponse`型を持つ変数は、`id`（数値）・`name`（文字列）・`position`（数値）・`createdAt`（文字列）の4つのプロパティを**必ず**持っていなければなりません。1つでも欠けていたり、型が違っていたりすると、コンパイル時にエラーになります。

### 構造的部分型：Javaとの一番大きな違い

> **Javaとの対比**
> Javaでは、あるクラスが特定の型として扱われるには`implements`・`extends`（[docs/java 12〜13章](../java/03-type-system.md#12-継承extends)）で**明示的に宣言**する必要があります（これを名前的型付け／nominal typingと呼びます）。TypeScriptはこれと根本的に異なり、**プロパティの形が一致してさえいれば**、宣言や継承関係が無くてもその型として扱えます（これを構造的部分型／structural typingと呼びます）。

たとえば次のコードはコンパイルが通ります。

```typescript
const board: BoardResponse = {
  id: 1,
  name: '仕事',
  position: 0,
  createdAt: '2026-07-20T00:00:00Z',
}
```

この`board`はどこにも`implements BoardResponse`のような宣言をしていませんが、必要なプロパティが全部揃っているというだけで`BoardResponse`型として認められます。この性質は、[docs/typescript 10章](./04-narrowing.md#10-型アサーションassatisfies)で扱う`as T`が「実行時には何のクラスにも属さないただのJSONを、コンパイル時だけ特定の型として通す」ことを可能にしている土台でもあります。

### コメントで示された、バックエンドとの対応関係

`types/api.ts`のコメントには、この型がJava側の何と対応するかが明記されています。

```typescript
/**
 * カード（GET /api/cards, GET /api/cards/{id} のレスポンス）。
 * バックエンド: backend/.../dto/CardResponse.java
 * ...
 */
```

TypeScript側の`CardResponse`型と、Java側の`CardResponse`レコード（[docs/spring-boot 22章](../spring-boot/06-service-controller.md#22-dtoレコードでエンティティを外に出さない)）は、見た目こそ似ていますが、**コンパイラが自動的に同期してくれる関係ではありません**。あくまで「このJSONはこの形のはず」という人間側の取り決めです。バックエンドのDTOのフィールドを変更したら、このファイルも手動で追随させる必要があります。

---

## 4. `interface`と宣言のマージ

> **`interface`とは？**
> `type`と同じく、オブジェクトの形に名前を付ける構文です。多くの場面で`type`と`interface`は互換的に使えますが、`interface`には`type`に無い固有の機能があります。

本プロジェクトで`interface`が使われているのは`vite-env.d.ts`の1箇所だけです。

```typescript
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
}
```

他のすべての型定義（`types/api.ts`・各コンポーネントの`Props`など）は`type`を使っているのに、ここだけ`interface`なのには理由があります。ファイル冒頭のコメントに明記されています。

```typescript
/**
 * 【重要】このファイルにはトップレベルの import / export を書かないこと。
 * 1つでも書くとこのファイルは「モジュール」と見なされ、
 * ここでの interface 宣言がグローバルのImportMetaEnvと合体（宣言のマージ）しなくなり、
 * 拡張が静かに効かなくなる。
 */
```

`ImportMetaEnv`は、Vite自身が`vite/client`の型定義の中であらかじめ`interface`として宣言している名前です（[docs/react 16章](../react/07-build-tooling.md#16-npmvitetsconfigと環境変数)で扱う`import.meta.env`の型の出どころです）。**同じ名前の`interface`を複数箇所で宣言すると、TypeScriptはそれらを1つに統合（マージ）します**。この性質を使って、Vite標準の`ImportMetaEnv`に`VITE_API_BASE_URL`プロパティを追加しているのがこのファイルの役割です。`type`エイリアスにはこのマージの仕組みが無く、同じ名前を2回`type`宣言すると単にエラーになります。「グローバルな型を後から拡張する」という限定的な用途でだけ`interface`が必要になる、と覚えておいてください。

### 本プロジェクトの使い分け方針

`type`と`interface`のどちらを使うべきか論争になることもありますが、本プロジェクトの実態は単純です。**宣言のマージが必要な場面（＝外部ライブラリが用意した型を拡張したいとき）以外は、常に`type`を使う**という一貫した方針になっています。`Props`型（[docs/react 4章](../react/02-component-jsx.md#4-propsと型付け)）を含め、自分で新しく定義する型はすべて`type`です。

---

## 5. ユニオン型とリテラル型

> **ユニオン型・リテラル型とは？**
> リテラル型は`'todo'`のような**特定の値そのもの**を型として使う機能です。ユニオン型は`型A | 型B`のように、複数の型のどれか1つであることを表す機能です。この2つを組み合わせた「文字列リテラルの合併」が、本プロジェクトで繰り返し登場します。

```typescript
export type CardStatus = 'todo' | 'doing' | 'done'
```

`CardStatus`型の値は、`'todo'`・`'doing'`・`'done'`という**3つの文字列のうちどれか**でなければなりません。`'todi'`のようなタイプミスを代入しようとすると、単なる`string`型では検出できない誤りが、コンパイル時にエラーとして検出されます。

> **Javaとの対比**
> Javaでこれに近い役割を持つのが`enum`ですが、[docs/java README付録](../java/README.md#付録このドキュメントで扱っていないjavaの機能)で説明したとおり、本プロジェクトのJava側はカードのステータスを`enum`ではなく`String`＋DBの`@Check`制約で表現しています。TypeScript側の`CardStatus`は、Javaの`enum`が持つ「決まった値しか代入できない」という安全性を、**実行時のオブジェクトを新たに作らずに**型の情報だけで実現しています。リテラル型は実行時には単なる文字列で、`typeof`で調べても`"string"`としか出ません（[1章](./01-basics.md#1-typescriptとは)の型消去のとおりです）。

同じパターンは他にも複数あります。

```typescript
// lib/dueDate.ts
export type DueStatus = 'overdue' | 'soon' | null

// components/StatusMessage.tsx
type StatusKind = 'loading' | 'error' | 'empty'
```

`DueStatus`は`null`もユニオンに含めている点に注目してください。文字列リテラルだけでなく`null`（[6章](#6-nullundefinedとstrictnullchecks)）や他の型も、`|`で自由に組み合わせられます。

### `T | null`という頻出パターン

本プロジェクトでもっとも多く登場するユニオン型は、実は`CardStatus`のような文字列リテラルではなく`T | null`です。

```typescript
// hooks/useApi.ts
export type UseApiResult<T> = {
  data: T | null
  loading: boolean
  error: Error | null
}
```

`data`は「`T`型の値」か「`null`」のどちらかです。この型がある以上、`data`を使う側は`if (data !== null)`のようなチェック（[docs/typescript 9章](./04-narrowing.md#9-型ガードと絞り込み)）をしない限り、`data.xxx`のようなプロパティアクセスができません（コンパイルエラーになります）。「読み込み中はnullになり得る」という事実を、コメントで説明する代わりに型そのもので強制しているわけです。

---

## 6. `null`・`undefined`と`strictNullChecks`

> **`strictNullChecks`とは？**
> `null`・`undefined`を、他の型とは明確に区別して扱うTypeScriptのコンパイラオプションです。これが無いと、どんな型の変数にも黙って`null`を代入でき、実行時に`undefined is not a function`のようなエラーで初めて問題に気づく、という事態が起こりやすくなります。

`tsconfig.app.json`には、このオプションを有効化する設定と、その理由を説明したコメントがあります。

```jsonc
/* strict: true は複数のチェックをまとめて有効化するフラグで、その中でも特に
   strictNullChecks（null/undefinedを型で区別する）が今回のAPI連携の前提になる。
   これが無いと `T | null` の `null` が型上消えてしまい、
   「読み込み中」「失敗」「データあり」の3状態をコンパイラがチェックしてくれなくなる。 */
"strict": true
```

`"strict": true`は1つのオプションではなく、`strictNullChecks`を含む複数の厳格化オプションを一括で有効にするフラグです。このコメントが説明しているとおり、`strictNullChecks`が無い世界では、[5章](#5-ユニオン型とリテラル型)で見た`T | null`という型注釈を書いても実質的に無視され、`null`が混ざっていてもコンパイラは何も言わなくなってしまいます。`hooks/useApi.ts`が「読み込み中／失敗／データあり」という3状態をきちんと型で表現できているのは、この設定が前提になっています。

### 省略可能なプロパティ（`?`）

`ProblemDetail`型は、全プロパティに`?`が付いています。

```typescript
export type ProblemDetail = {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
}
```

`title?: string`は「`title`プロパティが**存在しないかもしれない**」ことを表します。実際の値の型としては`string | undefined`（プロパティが存在しない場合は読み取ると`undefined`になる）に近いですが、「キー自体を省略できる」という点が`| undefined`とは微妙に異なります。コメントにあるとおり、RFC 9457（エラー応答の仕様）ではどのメンバーも必須ではないため、「型を厳しくして実態と合わなくなる」よりも「緩めにして安全に使う」ことを優先した設計判断です。

### `??`（Nullish合体演算子）と`?.`（オプショナルチェーン）

`null`・`undefined`を安全に扱うための専用構文が、本プロジェクトのコードには繰り返し登場します。

```typescript
// api/client.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

const message =
  problem?.detail ?? problem?.title ?? `HTTP ${response.status} ${response.statusText}`
```

- `problem?.detail`：`problem`が`null`でなければ`.detail`を読み、`null`（または`undefined`）ならその場で式全体が`undefined`になり、以降のプロパティアクセスも安全にスキップされます（オプショナルチェーン）。`problem`が`ProblemDetail | null`型（[client.ts](../../frontend/src/api/client.ts)参照）なので、`?.`を使わず`problem.detail`と書くと、`problem`が`null`の可能性を消せておらずコンパイルエラーになります。
- `A ?? B`：`A`が`null`または`undefined`のときだけ`B`を使います（Nullish合体演算子）。`problem?.detail ?? problem?.title ?? ...`は、「`detail`があれば`detail`、無ければ`title`、それも無ければ生のHTTPステータス」という優先順位を1行で表現しています。

> **JavaScriptとの対比**
> `??`・`?.`はTypeScript固有の構文ではなく、標準のJavaScript（ES2020）の演算子です。[docs/java 25章](../java/06-exception-and-null.md#25-nullとnullpointerexception)で触れているとおり、Javaにはこれに相当する演算子が無く、`!= null`と`&&`/`||`の短絡評価を組み合わせて同じ効果を得ています。JavaScript／TypeScriptはこの2つの演算子のおかげで、null安全な書き方がJavaより簡潔になる場面が多くあります。

### `||`ではなく`??`を使う理由

`??`は`||`と似ていますが、判定基準が違います。`||`は左辺が**falsy**（`0`・`''`・`false`・`null`・`undefined`のいずれか）なら右辺を使うのに対し、`??`は左辺が**`null`または`undefined`のときだけ**右辺を使います。`searchParams.get('q') ?? ''`（`pages/SearchView.tsx`）を`||`で書いてしまうと、キーワードが空文字`''`のとき（falsyだが`null`ではない）でも右辺が使われてしまい、動作は同じになりますが意図が変わります。「`null`／`undefined`のときだけ既定値にする」という意図を正確に表せる`??`が、本プロジェクトでは一貫して使われています。
