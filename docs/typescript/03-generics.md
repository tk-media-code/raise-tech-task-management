# ジェネリクスとユーティリティ型

[← TypeScript学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **7〜8章** をまとめています。

---

## 7. ジェネリクス

> **ジェネリクスとは？**
> 型そのものを引数のように受け取り、具体的な型を後から決められるようにする仕組みです。[docs/java 18章](../java/04-generics-collections.md#18-ジェネリクス)で学んだ`List<Card>`の`<Card>`と同じ考え方です。

本プロジェクトのAPI通信まわりは、ジェネリクスなしでは成立しません。中心にあるのが`api/client.ts`の`fetchJson`です。

```typescript
export async function fetchJson<T>(path: string, signal: AbortSignal): Promise<T> {
  // ...
  return (await response.json()) as T
}
```

`<T>`が型引数の宣言です。`fetchJson`は「何の型のJSONが返ってくるか」をあらかじめ知りません。呼び出す側が`fetchJson<BoardResponse[]>(...)`のように具体的な型を渡すことで、初めて戻り値の型（`Promise<BoardResponse[]>`）が決まります。

この`T`は、さらに`hooks/useApi.ts`のカスタムフック（[docs/react 10章](../react/04-custom-hooks.md#10-カスタムフック)）へと伝播していきます。

```typescript
export type UseApiResult<T> = {
  data: T | null
  loading: boolean
  error: Error | null
}

export function useApi<T>(path: string | null): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null)
  // ...
  fetchJson<T>(path, controller.signal)
    .then((json) => {
      setData(json)
    })
  // ...
  return { data, loading, error }
}
```

`useApi`自身も`<T>`を持ち、内部で使う`useState<T | null>`・`fetchJson<T>`にそのまま同じ`T`を渡しています。実際に呼び出す側（`pages/BoardDetailView.tsx`）を見ると、`T`がどう確定するかがわかります。

```typescript
const { data: cards, loading, error } = useApi<CardResponse[]>(path)
```

`useApi<CardResponse[]>(...)`と書いた瞬間、この呼び出しに限っては`T`が`CardResponse[]`に確定し、戻り値の`data`は自動的に`CardResponse[] | null`型になります。同じ`useApi`という1つの関数が、呼び出し箇所ごとに`BoardResponse[]`だったり`CardResponse`だったり、異なる型で安全に再利用されているのがジェネリクスの効果です。

### ジェネリクスが無いとどうなるか

仮に`T`を使わず`useApi(path): { data: unknown | null, ... }`のように書いてしまうと、コンパイルは通りますが、呼び出し側で`data.title`のようにプロパティへアクセスするたびに、TypeScriptは「`unknown`型には`title`というプロパティがあるかどうかわからない」とエラーを出します。かといって`any`にしてしまうと、今度は`data.nonExistentProperty`のような**存在しないプロパティへのアクセスすら検出できなくなります**。ジェネリクスは、「今は具体的な型がわからないが、呼び出されたときには必ず何らかの決まった型になる」という関係を、`any`で諦めることなく型のまま表現する仕組みです。

`hooks/useDebouncedValue.ts`も同様に、文字列に限らずどんな型の値でもデバウンスできるよう`<T>`を使っています。

```typescript
export function useDebouncedValue<T>(value: T, delayMs: number): T {
```

本プロジェクトでの実際の呼び出しは`useDebouncedValue(keywordInput, DEBOUNCE_MS)`（`keywordInput`は`string`）のみですが、`<T>`にしておくことで、将来「選択中のラベルID配列をデバウンスしたい」のような別の型の値にも、この関数をそのまま再利用できます。

---

## 8. `Record`と`readonly`と`as const`

> **`Record<K, V>`とは？**
> 「キーの型が`K`、値の型が`V`であるオブジェクト」を表す組み込みのジェネリック型です。すべてのキーが必ず埋まっていることを、コンパイラに保証させたいときに使います。

`lib/status.ts`に、`Record`の典型的な使い方があります。

```typescript
export const STATUSES: readonly CardStatus[] = ['todo', 'doing', 'done']

export const STATUS_LABELS: Record<CardStatus, string> = {
  todo: '未着手',
  doing: '作業中',
  done: '完了',
}
```

`Record<CardStatus, string>`は、「キーが`CardStatus`（`'todo' | 'doing' | 'done'`）、値が`string`であるオブジェクト」という型です。`CardStatus`が持つ3つの値**すべて**がキーとして存在することまで検査対象になるため、もし`doing`の行を書き忘れると、コンパイルエラーになります。単なる`{ [key: string]: string }`（任意の文字列キーを許す索引シグネチャ）ではこの網羅性チェックが働きません。

同じパターンは`lib/grouping.ts`でも、より複雑な値の型で使われています。

```typescript
export type GroupedCards = Record<CardStatus, BoardGroup[]>
```

```typescript
export function groupCardsByStatus(cards: CardResponse[] | null): Record<CardStatus, CardResponse[]> {
  const byStatus: Record<CardStatus, CardResponse[]> = { todo: [], doing: [], done: [] }
  // ...
}
```

コメントにあるとおり、「将来ステータスが増えたときにここを書き忘れるとコンパイルエラーになって気づける」という安全網として、`Record<CardStatus, ...>`が一貫して使われています。

> **Javaとの対比**
> [docs/java 19章](../java/04-generics-collections.md#19-コレクション)で扱った`Map<Integer, List<LabelResponse>>`と似ていますが、Javaの`Map`は「どんなキーが実際に入っているか」を型では保証しません（実行時に`get`した結果が`null`かもしれない）。TypeScriptの`Record<CardStatus, V>`は、`CardStatus`が取り得るすべての値がキーとして存在することを**コンパイル時に強制**する点で、より強い保証を持っています。

### `readonly`：再代入とミューテーションを防ぐ

`STATUSES`の型`readonly CardStatus[]`にも注目してください。

```typescript
export const STATUSES: readonly CardStatus[] = ['todo', 'doing', 'done']
```

`readonly`が付いた配列型は、`.push(...)`・`.sort(...)`のような**配列の中身を書き換えるメソッド**の呼び出しがコンパイルエラーになります（読み取り専用の`.map(...)`・`.includes(...)`などは引き続き使えます）。`STATUSES`は「画面に表示する順序どおりのステータス一覧」という不変の定数のため、うっかりどこかのコードが並び順を書き換えてしまう事故を型で防いでいます。

`api/client.ts`の`ApiError`クラス（[docs/typescript 11章](./05-class-module.md#11-クラスと継承)）のフィールドにも同じ`readonly`が使われています。

```typescript
readonly status: number | null
readonly problem: ProblemDetail | null
```

こちらは配列ではなくオブジェクトのプロパティに対する`readonly`で、意味は「コンストラクタで一度設定したら、以後そのプロパティへの再代入を禁止する」ことです。

> **Javaとの対比**
> [docs/java 10章](../java/02-class-and-object.md#10-final)の`final`フィールドと同じ発想です。Javaの`final`は「一度だけ代入できる（コンストラクタで代入すればそれ以降は変更不可）」という制約でしたが、TypeScriptの`readonly`も同様に「宣言時またはコンストラクタでの初期化以降は再代入できない」という制約です。ただし決定的な違いがあります。Javaの`final`はJVMが実行時にも強制する制約ですが、TypeScriptの`readonly`は型消去（[1章](./01-basics.md#1-typescriptとは)）の対象であり、コンパイル後のJavaScriptには影も形も残りません。実行時に`apiError.status = 500`のような代入を書けば、警告なく成功してしまいます。`readonly`はあくまで「開発者が誤って書き換えるのを、コンパイル時に防ぐための約束事」です。

### `as const`：リテラル型として固定する

`components/DueDateBadge.tsx`には、`readonly`とは別の「変更させない」仕組みが登場します。

```typescript
const DUE_STATUS_STYLE = {
  overdue: { emoji: '🔴', className: 'bg-red-50 text-red-700' },
  soon: { emoji: '🟡', className: 'bg-amber-50 text-amber-700' },
} as const
```

`as const`を付けずに`const DUE_STATUS_STYLE = { overdue: { emoji: '🔴', ... }, ... }`と書くと、TypeScriptは`emoji`の型を（値`'🔴'`そのものではなく）ただの`string`だと推論します。`as const`を付けると、すべてのプロパティが**そのリテラル値そのもの**（`'🔴'`という値だけを持つ型）として、かつ`readonly`として推論されるようになります。ここでは`DUE_STATUS_STYLE[status]`（`status`は`'overdue' | 'soon'`）のように、オブジェクトのキーを`DueStatus`型の値でそのまま検索するため、キーの集合が`{ overdue: ..., soon: ... }`ちょうど2つに固定されている必要があり、`as const`がその固定に一役買っています。
