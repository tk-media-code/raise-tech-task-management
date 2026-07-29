# カスタムフックとデータ取得

[← React学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **10〜12章** をまとめています。

---

## 10. カスタムフック

> **カスタムフックとは？**
> `useState`・`useEffect`のような組み込みフックを内部で呼び出す、`use`で始まる名前の**ただの関数**です。特別な構文ではなく、フックを使う処理を関数として切り出しただけのものですが、[docs/react 9章](./03-state-effect.md#9-フックのルール)のフックのルールは、カスタムフックの内部にもそのまま適用されます。

本プロジェクトには3つのカスタムフックがあります。

| フック | 役割 | 内部で使う組み込みフック |
| --- | --- | --- |
| `useApi<T>` | 1つのAPIパスをGETし、状態を返す | `useState`・`useEffect` |
| `useDebouncedValue<T>` | 値の変化を遅らせて反映する | `useState`・`useEffect` |
| `useLabelsByBoard` | ボードごとのラベル一覧をまとめて取得する | `useState`・`useEffect` |

`hooks/useApi.ts`のコメントが、カスタムフックの意義を端的に説明しています。

```typescript
// 「カスタムフック」とは、useStateやuseEffectといった組み込みフックを内部で呼ぶ、
// `use` で始まる名前のただの関数。これを画面から呼ぶだけで、
// 「stateを3つ用意して、useEffectで通信して、後片付けもする」という定型を1行に畳める。
```

`pages/CrossBoardView.tsx`での実際の呼び出しは、次の1行だけです。

```typescript
const { data: cards, loading, error } = useApi<CardResponse[]>(apiPaths.cards())
```

この1行の裏側には、[docs/react 8章](./03-state-effect.md#8-useeffectと副作用クリーンアップ)で見た「3つの`useState`・`AbortController`によるクリーンアップ・`.then`/`.catch`/`.finally`」という一連の定型処理がすべて隠れています。もし`useApi`が無ければ、この定型処理を`CrossBoardView`・`BoardDetailView`・`SearchView`・`CardDetailModal`など、APIを呼ぶすべての画面に**コピーして書く**ことになります。カスタムフックは、コンポーネント同士でロジックを共有するための、Reactにおける標準的な再利用の手段です。

### なぜ「フックはループの中で呼べない」のか：`useLabelsByBoard`

`hooks/useLabelsByBoard.ts`は、`useApi`をそのまま使えない事情から生まれたフックです。

```typescript
// hooks/useApi.tsは「1つのパスをGETする」ことに特化しているため、ボードの数だけ
// `GET /api/boards/{id}/labels`を呼びたいこの用途には使えない（フックはループの中で
// 呼び出せないというReactの制約もある）。そのため、api/client.tsの低レベルな関数
// `fetchJson`を直接使い、`Promise.all`でボードの数だけ並列に呼び出す形で実装している。
```

もし「ボードの数だけ`useApi`を呼ぶ」ことができれば話は単純ですが、`boards.map((board) => useApi(...))`のような書き方は許されません。これは[docs/react 9章](./03-state-effect.md#9-フックのルール)の「フックは毎回同じ順序・同じ回数呼ばれる必要がある」というルールに反するためです——ボードの数は`boards`の取得結果によって変わり得るため、フックの呼び出し回数を実行時まで確定できません。この制約を回避するため、`useLabelsByBoard`はフックの呼び出しを1回（`useState`・`useEffect`をそれぞれ1回ずつ）に保ったまま、その内部で通常の関数である`fetchJson`（[docs/typescript 7章](../typescript/03-generics.md#7-ジェネリクス)）を`boards.map(...)`でボードの数だけ呼び出し、`Promise.all`（[docs/typescript 13章](../typescript/06-async.md#13-promiseとasyncawait)）でまとめて待っています。「フックの呼び出し自体はループの外で1回、実際の非同期処理はループの中で複数回」という組み合わせが、このルールとの折り合いのつけ方です。

---

## 11. データ取得の3状態とレースコンディション

> **レースコンディション（競合状態）とは？**
> 複数の非同期処理が並行して走り、その**完了する順序**によって結果が変わってしまう不具合です。データ取得において特に起こりやすいのが、「後から開始したはずのリクエストの結果が先に届き、その後に古いリクエストの結果が遅れて届いて上書きしてしまう」というパターンです。

`hooks/useApi.ts`が返す型は、単なる「データがあるかないか」ではなく、明確に3つの状態を区別しています。

```typescript
export type UseApiResult<T> = {
  data: T | null
  loading: boolean
  error: Error | null
}
```

`data`が`null`なだけでは「まだ読み込んでいない」のか「失敗した」のかが区別できません。`loading`・`error`をそれぞれ独立したフィールドとして持つことで、画面側は「読み込み中→失敗→データあり」の3状態（[docs/react 5章](./02-component-jsx.md#5-条件付きレンダリングとリスト描画key)の早期returnパターン）を正しく出し分けられます。

### 具体的に何が起こり得るか：ボードを素早く切り替える

`useApi.ts`のコメントは、レースコンディションが起きる具体的なシナリオを説明しています。

```typescript
// pathが変わったとき、前のpathで取得したdataが画面に残り続けないよう、
// 通信の開始時点で必ずリセットする（例: ボードAの詳細→ボードBの詳細に切り替えた瞬間、
// Bの読み込み中にAのカードが表示されたままになるのを防ぐ）。
setLoading(true)
setError(null)
setData(null)
```

ユーザーが「ボードAの詳細」から「ボードBの詳細」へ素早く画面を切り替えたとします。もし`path`が変わった瞬間に`data`をリセットしなければ、Bのカード一覧がまだ届いていない間、画面には**Aのカード一覧が表示されたまま**になり、あたかもそれがBのカードであるかのように見えてしまいます。`path`が変わるたびに（＝`useEffect`が再実行されるたびに）`data`・`loading`・`error`を必ずリセットしてから通信を始めることで、この「古い画面の残留」を防いでいます。

### `AbortController`でリクエストそのものを中断する

リセットだけでは防ぎきれないもう1つの問題があります。「ボードA」のリクエストが先に発生し、「ボードB」のリクエストが後から発生したとして、ネットワークの状況次第では**Bの結果よりAの結果が後に届く**ことがあり得ます。何もしなければ、Bの結果でいったん更新された画面が、遅れて届いたAの結果で再び上書きされてしまいます。

```typescript
return () => {
  controller.abort()
}
```

`useEffect`のクリーンアップ（[docs/react 8章](./03-state-effect.md#8-useeffectと副作用クリーンアップ)）で、`path`が変わる（＝新しい効果が実行される）直前に、前回の`AbortController`を`abort()`しています。これにより、Aへのリクエストは「Bへの切り替え」が起きた時点で中断され、たとえ通信自体がその後も裏側で続いていたとしても、`.then`（成功時の処理）は実行されません。`.catch`・`.finally`の中で`controller.signal.aborted`を確認しているのも、この中断を「エラー」としてではなく「無かったこと」として扱うためです。

```typescript
.catch((cause: unknown) => {
  // 中断（abort）は「呼び出し側が意図してやめた」だけで、ユーザーに見せる失敗ではない。
  if (controller.signal.aborted) return
  setError(cause instanceof Error ? cause : new Error(String(cause)))
})
```

「stateのリセット」と「進行中のリクエストの中断」という2つの対策を組み合わせることで、`useApi`は「画面に表示されるのは常に最新のリクエストの結果だけ」という状態を保っています。実装の詳細（`AbortController`・`AbortSignal`というブラウザ標準のAPI自体の説明）は[docs/typescript 14章](../typescript/06-async.md#14-fetchとabortcontroller)を参照してください。

---

## 12. `useMemo`と再計算の抑制

> **`useMemo`とは？**
> 計算結果を、依存する値が変わらない限り**再計算せずに使い回す**ためのフックです。`useEffect`と同じ形の依存配列を取りますが、目的が異なります（`useEffect`は副作用の実行タイミングを制御し、`useMemo`は値の再計算を抑制します）。

`pages/CrossBoardView.tsx`は、APIから取得したフラットなカード配列を、表示用の階層構造に組み替える処理を`useMemo`で包んでいます。

```typescript
const { data: cards, loading, error } = useApi<CardResponse[]>(apiPaths.cards())

const grouped = useMemo(() => groupCardsByStatusAndBoard(cards), [cards])
```

コメントが、その理由を説明しています。

```typescript
// 依存配列を[cards]にしているのは、cardsの中身ではなく「配列そのものの
// インスタンス」をObject.isで比較するため。useApiのdataはフェッチ完了時にしか
// 新しいインスタンスにならないので、モーダルの開閉などで無関係な再レンダリングが
// 起きても、そのたびにグルーピングをやり直さずに済む。
```

`selectedCardId`（カード詳細モーダルの開閉、[docs/react 7章](./03-state-effect.md#7-stateとusestate)）が変わるだけでも、`CrossBoardView`コンポーネント自体は再描画（関数として再実行）されます。`useMemo`が無ければ、その再描画のたびに`groupCardsByStatusAndBoard(cards)`（[docs/typescript 8章](../typescript/03-generics.md#8-recordとreadonlyとas-const)で扱った`Record`を組み立てる、決して軽くはない処理）が毎回実行されてしまいます。`useMemo(計算, [cards])`は、「`cards`という**配列のインスタンス自体**が前回の描画と変わっていなければ、計算をやり直さず前回の結果をそのまま返す」という動作をします。`useApi`の`data`は、[11章](#11-データ取得の3状態とレースコンディション)で見たとおり通信が完了したタイミングでしか新しいインスタンスにならないため、モーダルの開閉のような無関係な状態変化では、グルーピングの再計算がスキップされます。

### 使いどころの見極め

`useMemo`はあらゆる計算に使うべきものではありません。単純な計算（`件数 = 配列.length`のようなもの）であれば、`useMemo`で包むコスト（依存配列の比較コスト）の方が、再計算そのもののコストより高くつくことすらあります。本プロジェクトで`useMemo`が使われているのは、`groupCardsByStatusAndBoard`・`groupCardsByStatus`（`pages/BoardDetailView.tsx`）という、配列を走査してオブジェクトを組み立てる処理に限られています。「無関係なstateの変化のたびに、重めの計算をやり直したくない」という具体的な動機がある箇所にだけ使う、という判断基準で捉えてください。
