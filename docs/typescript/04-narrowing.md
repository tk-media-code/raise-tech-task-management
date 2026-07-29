# 型の絞り込みとアサーション

[← TypeScript学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **9〜10章** をまとめています。

---

## 9. 型ガードと絞り込み

> **絞り込み（narrowing）とは？**
> `if`文などの条件分岐によって、変数の型をより具体的な型へ狭めていくことです。TypeScriptのコンパイラは、条件分岐の中でどんなチェックが行われたかを追跡し、分岐の内側では変数の型を自動的に狭めてくれます。

もっとも基本的な例が、[docs/typescript 5章](./02-object-types.md#5-ユニオン型とリテラル型)で見た`T | null`に対する`!== null`チェックです。`components/CardItem.tsx`から引用します。

```typescript
{card.dueDate !== null && <DueDateBadge dueDate={card.dueDate} />}
```

`card.dueDate`の型は`string | null`ですが、`DueDateBadge`の`Props`は`dueDate: string`（`null`を受け付けない）を要求します。`card.dueDate !== null &&`の**右側**でだけ、TypeScriptは「ここまで来たということは、`card.dueDate`は`null`ではあり得ない」と判断し、型を`string`に絞り込みます。この絞り込みが無ければ、`<DueDateBadge dueDate={card.dueDate} />`はコンパイルエラーになります（`string | null`を`string`が必要な場所に渡そうとしているため）。

同じ考え方が、本プロジェクトの各画面で「読み込み中／失敗／データあり」の3状態（[docs/react 11章](../react/04-custom-hooks.md#11-データ取得の3状態とレースコンディション)）を出し分けるすべての箇所で使われています。

```typescript
// pages/CrossBoardView.tsx
if (loading) return <StatusMessage kind="loading">読み込み中…</StatusMessage>
if (error !== null) {
  return <StatusMessage kind="error">読み込みに失敗しました：{error.message}</StatusMessage>
}
if (cards === null || cards.length === 0) {
  return <StatusMessage kind="empty">表示できるカードがありません。</StatusMessage>
}
```

3つ目の`if`を通過した時点で、TypeScriptは`cards`が「`null`ではなく、かつ`length`が0でもない」＝実質的に**中身のある配列**であることを把握しています。これ以降のコードで`cards`を`CardResponse[]`として扱えるのは、早期returnという制御フローそのものが型の絞り込みとして機能しているためです。

### 独自の型ガード関数：`isCardStatus`

条件分岐が複雑になると、`!== null`のような単純な比較だけでは絞り込みきれない場合があります。`lib/status.ts`の`isCardStatus`は、自分で絞り込みルールを定義する**型ガード関数**です。

```typescript
export function isCardStatus(value: string): value is CardStatus {
  return (STATUSES as readonly string[]).includes(value)
}
```

戻り値の型が、単なる`boolean`ではなく`value is CardStatus`という特殊な形になっています。これは「この関数が`true`を返したとき、呼び出し元の`value`は`CardStatus`型として扱ってよい」という約束をコンパイラに伝える構文です。`lib/grouping.ts`での使われ方を見ると、この効果がわかります。

```typescript
if (!isCardStatus(card.status)) {
  console.warn(`未知のステータスのカードを無視した: id=${card.id}, status=${card.status}`)
  continue
}

const boards = byStatus[card.status]
```

`card.status`の宣言上の型はすでに`CardStatus`（[types/api.ts](../../frontend/src/types/api.ts)）ですが、コメントにあるとおり「それは**型上**そうなっているだけで、実行時の値は保証されていない」（[10章](#10-型アサーションassatisfies)の`as T`を参照）ため、`isCardStatus`による実行時チェックを挟んでいます。`if (!isCardStatus(...)) continue`を通過した後の`byStatus[card.status]`（`byStatus`は`Record<CardStatus, ...>`）は、この型ガードのおかげで安全にインデックスアクセスできます。

> **Javaとの対比**
> [docs/java 17章](../java/03-type-system.md#17-instanceofパターンマッチング)の`instanceof`パターンマッチングと近い役割です。Javaの`if (obj instanceof CardLabelId that)`が、その`if`ブロックの内側で`obj`を`CardLabelId`型の変数`that`として扱えるようにするのと同じく、TypeScriptの型ガードも「条件を満たした後のコードでは、より狭い型として安全に扱える」という効果を持ちます。ただし`instanceof`はJavaの言語組み込み構文であるのに対し、`value is CardStatus`はプログラマが自分で定義できる点が異なります（絞り込みの正しさを保証するのは実装者の責任です）。

### `instanceof`によるエラーの絞り込み

`hooks/useApi.ts`・`hooks/useLabelsByBoard.ts`の`catch`ブロックにも、絞り込みが登場します。

```typescript
.catch((cause: unknown) => {
  if (controller.signal.aborted) return
  setError(cause instanceof Error ? cause : new Error(String(cause)))
})
```

`catch`で受け取る`cause`の型は`unknown`（[10章](#10-型アサーションassatisfies)で扱う`any`とは異なり、絞り込むまでは一切の操作ができない安全な「何でも」型）です。`cause instanceof Error`の三項演算子は、`true`の分岐では`cause`を`Error`型として扱い（`.message`などにアクセスできる）、`false`の分岐では絞り込まれず`unknown`のままなので`String(cause)`のように「何が来ても失敗しない」操作だけを使っています。`api/client.ts`のコメントが述べている「呼び出し側が`err instanceof ApiError`で判別できる」という設計（[11章](./05-class-module.md#11-クラスと継承)の`ApiError`）も、同じ`instanceof`による絞り込みの応用です。

---

## 10. 型アサーション（`as`・`!`・`satisfies`）

> **型アサーションとは？**
> 「この値は実際にはこの型のはずだ」と、開発者がコンパイラに**申告**する構文です。[9章](#9-型ガードと絞り込み)の絞り込みがコンパイラ自身の推論であるのに対し、型アサーションは開発者側の主張であり、**コンパイラはそれが正しいかどうかを実行時には一切検証しません**。本プロジェクトで最も注意すべきTypeScriptの機能です。

### `as T`：もっとも重要な注意点

`api/client.ts`の`fetchJson`の最後の行に、本プロジェクトで最も重要な`as`が登場します。

```typescript
return (await response.json()) as T
```

`response.json()`の戻り値の型は、TypeScriptの標準ライブラリ上`Promise<any>`と定義されています（HTTPレスポンスの中身が何であるかは、TypeScriptには知りようがないためです）。`as T`は、「このJSONは呼び出し元が期待する`T`型のはずだ」と申告し、`any`だった型を`T`（[7章](./03-generics.md#7-ジェネリクス)参照）に変換しています。コード中のコメントが、この構文の危険性を明確に説明しています。

```typescript
// `as T` は「このJSONはT型だと信じる」という宣言にすぎず、実行時の検証は一切されない。
// 型定義（types/api.ts）とバックエンドのDTOがずれていても、TypeScriptは気づけない。
// 外部から来るデータに対する型は「保証」ではなく「約束」だという点は覚えておくこと。
```

たとえばバックエンドが`CardResponse.status`のスペルを誤って`"todoo"`という値で返してきたとしても、`as T`はそれを黙って`CardStatus`型として通してしまいます。この「型と実態がずれる可能性」に対する防御が、[9章](#9-型ガードと絞り込み)で見た`isCardStatus`のような、**実行時に値を検査する型ガード**です。型アサーションと型ガードは対になる関係にあると捉えてください——アサーションは「信じる」、型ガードは「確かめる」。

### 安全な`as`：型を狭めるのではなく広げる

`lib/status.ts`の`isCardStatus`自身の中にも、別の意図を持つ`as`があります。

```typescript
export function isCardStatus(value: string): value is CardStatus {
  return (STATUSES as readonly string[]).includes(value)
}
```

`STATUSES`の型は`readonly CardStatus[]`（[8章](./03-generics.md#8-recordとreadonlyとas-const)）で、その`.includes(...)`メソッドは`CardStatus`型の引数しか受け付けません。しかしこの関数の目的は「任意の`string`（`value`）が`CardStatus`かどうかをこれから判定すること」なので、`value`はまだ`string`のままです。`STATUSES.includes(value)`と直接書くと、「`string`型は`CardStatus`型の引数として渡せない」という型エラーになってしまいます。`STATUSES as readonly string[]`は、`STATUSES`の型をあえて**より広い**`readonly string[]`に変換することで、任意の文字列との比較を可能にしています。

この2つの`as`を比べると、性質の違いがわかります。`fetchJson`の`as T`は「`any`から具体的な型へ、実行時の裏付けなしに絞り込む」危険なアサーションですが、`isCardStatus`内の`as readonly string[]`は「配列の要素の集合そのものは変えず、比較のために型だけを緩める」安全なアサーションです。どちらも構文は同じ`as`ですが、**それが指す実行時の値の扱われ方を変えていない**という点で後者は安全と言えます。

### `!`（非null断定演算子）

`main.tsx`に、`as`とは別の形の型アサーションがあります。

```typescript
createRoot(document.getElementById('root')!).render(
```

`document.getElementById('root')`の戻り値の型は`HTMLElement | null`です（指定したIDの要素がDOM上に存在するとは、TypeScriptには保証できないため）。末尾の`!`は「この値は`null`ではないと断定する」という、`as`の省略記法にあたる構文です（`document.getElementById('root') as HTMLElement`とほぼ同じ意味です）。`index.html`に`<div id="root"></div>`が実在することは人間には自明ですが、TypeScriptの型システムはHTMLファイルの中身までは検査できないため、ここは`!`で開発者が保証する必要があります。`as`と同様、実際に`root`要素が無ければ実行時に`null`のまま渡され、`createRoot(null)`はエラーになります——コンパイル時のチェックを迂回している以上、間違っていれば実行時に失敗する、という点は`as`と共通です。

### `satisfies`：アサーションではなく検査

`pages/SearchView.tsx`には、`as`と似ていますが性質がまったく違う`satisfies`が登場します。

```typescript
type SearchLocationState = {
  from?: string
}

setSearchParams(
  (prev) => { /* ... */ },
  { state: { from: fromPath } satisfies SearchLocationState },
)
```

`{ from: fromPath } satisfies SearchLocationState`は、「このオブジェクトが`SearchLocationState`型の条件を満たしているかを**検査**してほしい、ただし式全体の型は変えないでほしい」という指定です。`as`との決定的な違いはここにあります。

- `as SearchLocationState`と書いた場合：型を強制的に上書きするだけで、実際にプロパティが不足していても（`fetchJson`の`as T`と同じ理由で）コンパイルエラーにならない可能性があります。
- `satisfies SearchLocationState`の場合：`{ from: fromPath }`が本当に`SearchLocationState`の形（`from`が`string`型、または存在しない）を満たしているかを**その場でコンパイラが検証**し、満たしていなければエラーにします。検証に通った後も、式の型は`SearchLocationState`に置き換わらず、元のオブジェクトリテラルの型（より具体的な型）のまま保たれます。

`react-router`の`setSearchParams`の第2引数（`state`オプション）は、ライブラリ側の型定義上どんな値でも受け取れるようになっているため、「渡す値が本当に自分たちの決めた`SearchLocationState`の形と一致しているか」を、`as`で誤魔化さずに検査したいという意図で`satisfies`が選ばれています。「信じ込ませる」`as`と、「約束どおりか確かめる」`satisfies`は、名前も役割も対照的な構文だと覚えておいてください。
