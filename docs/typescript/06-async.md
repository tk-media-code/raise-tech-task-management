# 非同期処理：PromiseとFetch

[← TypeScript学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **13〜14章** をまとめています。

---

## 13. `Promise`と`async`・`await`

> **`Promise`とは？**
> 「まだ終わっていない非同期処理の、将来の結果」を表すオブジェクトです。API通信のように、結果が返ってくるまで時間がかかる処理はすべて`Promise`として扱われます。`async`・`await`は、この`Promise`を同期処理のような見た目で書けるようにする構文です。

`api/client.ts`の`readProblemDetail`は、`async`・`await`と`try`/`catch`を組み合わせた典型例です。

```typescript
async function readProblemDetail(response: Response): Promise<ProblemDetail | null> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.startsWith('application/problem+json')) return null
  try {
    return (await response.json()) as ProblemDetail
  } catch {
    return null
  }
}
```

- 関数の先頭の`async`は、「この関数は`Promise`を返す」という宣言です。戻り値の型注釈`Promise<ProblemDetail | null>`とセットで、`return null`と書いても実際には`Promise.resolve(null)`が返ります。
- `await response.json()`は、「`response.json()`が返す`Promise`が解決するまで待ち、中身の値を取り出す」という意味です。`await`を付けない場合、`response.json()`の型はあくまで`Promise<any>`のままで、中身の値を直接扱うことはできません。
- `response.json()`は本文がJSONとしてパースできない場合に`reject`（失敗）した`Promise`を返します。`await`した式を`try`で囲むことで、その失敗を`catch`で捉えられます。

> **Javaとの対比**
> [docs/java 24章](../java/06-exception-and-null.md#24-例外の仕組み)の`try`/`catch`と構文はそっくりですが、対象が違います。Javaの`try`/`catch`は同期的に実行される処理の例外を捕まえるのに対し、TypeScriptの`try`/`catch`が`await`と組み合わさったときに捕まえるのは、**非同期処理（`Promise`）が失敗（reject）した場合**です。`await`の付いていないただの`Promise`は、`try`/`catch`では捕まえられません（後述の`.catch(...)`が必要です）。

### なぜ`useEffect`の中は`async`/`await`ではなく`.then`チェーンなのか

`hooks/useApi.ts`は`readProblemDetail`とは対照的に、`async`/`await`を使わず`.then`/`.catch`/`.finally`をつないでいます。

```typescript
fetchJson<T>(path, controller.signal)
  .then((json) => {
    setData(json)
  })
  .catch((cause: unknown) => {
    if (controller.signal.aborted) return
    setError(cause instanceof Error ? cause : new Error(String(cause)))
  })
  .finally(() => {
    if (controller.signal.aborted) return
    setLoading(false)
  })
```

これは書き方の好みではなく、[docs/react 8章](../react/03-state-effect.md#8-useeffectと副作用クリーンアップ)で扱う`useEffect`の制約によるものです。`useEffect`に渡すコールバック関数は、「何も返さない」か「クリーンアップ関数を返す」かのどちらかでなければならず、`Promise`を返すことが許されていません。`async function`は必ず`Promise`を返す関数になる（[本章冒頭](#13-promiseとasyncawait)参照）ため、`useEffect(async () => { ... }, [path])`のようには書けません。そのためこのファイルでは、`useEffect`のコールバック自体は`async`にせず、その内部で`fetchJson(...).then(...)`という**`Promise`のメソッドを直接つなぐ書き方**を選んでいます。

- `.then(onFulfilled)`：`Promise`が成功したときの処理を登録します。
- `.catch(onRejected)`：`Promise`が失敗したときの処理を登録します。
- `.finally(onFinally)`：成功・失敗どちらでも最後に必ず実行される処理を登録します（`loading`を`false`に戻す処理が、成功時・失敗時の両方に書かれずここ1箇所で済んでいます）。

### `Promise.all`：複数の非同期処理を並列に待つ

`hooks/useLabelsByBoard.ts`は、ボードの数だけ`fetchJson`を呼ぶ必要があるという特殊な事情から、`Promise.all`を使っています。

```typescript
Promise.all(
  boards.map((board) =>
    fetchJson<LabelResponse[]>(apiPaths.boardLabels(board.id), controller.signal).then(
      (labels): [number, LabelResponse[]] => [board.id, labels],
    ),
  ),
)
  .then((entries) => {
    setLabelsByBoard(Object.fromEntries(entries))
  })
```

`boards.map((board) => fetchJson(...))`は、ボード1件につき1つの`Promise`を生成し、`Promise`の配列を作ります。`Promise.all(配列)`は、その配列に含まれる**すべての`Promise`が成功して初めて**成功する、1つの`Promise`を返します（1件でも失敗すれば、`Promise.all`全体もその時点で失敗します）。コメントにあるとおり、Nボードぶんのリクエストを直列に（1件ずつ順番に）待つのではなく、**同時に**投げて全部の完了を待てるため、通信時間はボードの数に比例して伸びません。

`.then((labels): [number, LabelResponse[]] => [board.id, labels])`の部分は、「ボードIDとラベル一覧のペア（タプル）」に変換しています。`Promise.all`の結果は`[[1, [...]], [2, [...]], ...]`という配列になり、最後の`Object.fromEntries(entries)`で`{ 1: [...], 2: [...] }`という`Record`（[8章](./03-generics.md#8-recordとreadonlyとas-const)）へ組み替えています。

---

## 14. `fetch`と`AbortController`

> **`fetch`とは？**
> ブラウザに標準搭載された、HTTP通信を行うための関数です。呼び出すと`Response`オブジェクトを持つ`Promise`を返します。

### 最大の落とし穴：`fetch`は404でも500でも失敗しない

`api/client.ts`のコメントが、`fetch`を使ううえで最も誤解しやすい挙動を説明しています。

```typescript
// ここが最大の落とし穴: fetchは404でも500でもrejectしない。
// 「サーバーと通信できた」時点で成功扱いになるため、HTTPステータスは自分で見る必要がある
// （axiosやjQueryの $.ajax が自動でエラーにしてくれるのとは挙動が違う）。
if (!response.ok) {
  const problem = await readProblemDetail(response)
  const message =
    problem?.detail ?? problem?.title ?? `HTTP ${response.status} ${response.statusText}`
  throw new ApiError(message, response.status, problem)
}
```

`fetch`が返す`Promise`が失敗（reject）するのは、**サーバーに到達すらできなかった場合**（ネットワーク断・CORS拒否など）だけです。サーバーが「404 Not Found」や「500 Internal Server Error」を返してきても、ブラウザから見れば「サーバーとの通信自体は成功した」ことになるため、`fetch`の`Promise`は成功（resolve）します。`response.ok`（ステータスコードが200番台かどうかを表す`boolean`）を自分でチェックし、そうでなければ`throw`で明示的に失敗へ変換しているのが、この`if`ブロックです。この変換によって、呼び出し側（[docs/react 11章](../react/04-custom-hooks.md#11-データ取得の3状態とレースコンディション)の`useApi`）は`.catch`だけを見ればHTTPレベルの失敗もネットワークレベルの失敗も両方拾える、という単純な形になっています。

### `fetch`自体が失敗する場合

`fetch`呼び出し自体を`try`/`catch`で囲んでいる箇所もあります。

```typescript
let response: Response
try {
  response = await fetch(`${API_BASE_URL}${path}`, { signal })
} catch (cause) {
  if (cause instanceof Error && cause.name === 'AbortError') throw cause
  throw new ApiError(
    'APIサーバーに接続できませんでした。バックエンドが起動しているか、CORSの設定が正しいかを確認してください。',
    null,
    null,
  )
}
```

こちらの`catch`が捕まえるのは、[docs/spring-boot 27章](../spring-boot/08-configuration-cors.md#27-corsとフロントエンドとの接続)で扱った「サーバーに到達できなかった、またはCORSでブラウザに握りつぶされた」ケースです。`cause instanceof Error && cause.name === 'AbortError'`の分岐だけ特別扱いしているのは、次に説明する中断（abort）を「通信エラー」として画面に見せないようにするためです。

### `AbortController`：進行中の通信を中断する

`fetchJson`の第2引数`signal: AbortSignal`は、`hooks/useApi.ts`から渡されています。

```typescript
const controller = new AbortController()
// ...
fetchJson<T>(path, controller.signal)
  // ...
return () => {
  controller.abort()
}
```

`AbortController`は「進行中の`fetch`を外から中断するためのリモコン」です。`controller.signal`を`fetch`に渡しておき、`controller.abort()`を呼ぶと、対応する`fetch`の`Promise`が（`AbortError`という名前の`Error`で）失敗します。[docs/react 8章](../react/03-state-effect.md#8-useeffectと副作用クリーンアップ)で扱う`useEffect`のクリーンアップ関数からこの`abort()`を呼ぶことで、「表示中の画面が切り替わったのに、古いリクエストの結果が後から届いて古いデータで上書きしてしまう」という競合状態（レースコンディション）を防いでいます。

`fetch`の`signal`オプションはTypeScript固有の機能ではなく、`AbortController`・`AbortSignal`ともにブラウザ標準のWeb APIです。`hooks/useApi.ts`の`UseApiResult<T>`（[7章](./03-generics.md#7-ジェネリクス)）が「読み込み中／失敗／データあり」という3状態をきちんと管理できているのは、この中断の仕組みと、`controller.signal.aborted`（中断済みかどうかを表す`boolean`）を`.catch`・`.finally`の中で確認するガード処理の組み合わせによるものです。実装の詳しい流れは[docs/react 8章](../react/03-state-effect.md#8-useeffectと副作用クリーンアップ)・[11章](../react/04-custom-hooks.md#11-データ取得の3状態とレースコンディション)で扱います。
