# 非同期処理：PromiseとFetch

[← TypeScript学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **13〜15章** をまとめています。

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

### `useEffect`の中で`await`する——即時実行の`async`関数で包む

`useEffect`のコールバックには制約があります。[docs/react 8章](../react/03-state-effect.md#8-useeffectと副作用クリーンアップ)のとおり、渡す関数は「何も返さない」か「クリーンアップ関数を返す」かのどちらかでなければならず、`Promise`を返すことが許されていません。`async function`は必ず`Promise`を返す（[本章冒頭](#13-promiseとasyncawait)参照）ため、**`useEffect(async () => { ... }, [path])`とは書けません**。Reactが返ってきた`Promise`をクリーンアップ関数と誤認してしまいます。

当初この制約への対処として、`hooks/useApi.ts`は`.then`/`.catch`/`.finally`をつなぐ書き方を採っていました。しかしこれは、[docs/react 33章](../react/07-build-tooling.md#33-oxlintの設定強化)で導入したoxlintの`promise/always-return`に指摘される形でもあります。`.then()`のコールバックが値を返していないと、「まだチェーンを繋ぐつもりなのか、そこで終わりなのか」がコードの見た目から判断できないためです。

制約を満たしつつ`await`を使うには、**即時実行の`async`関数**で包みます。

```typescript
void (async () => {
  try {
    setData(await fetchJson<T>(path, controller.signal))
  } catch (cause: unknown) {
    if (controller.signal.aborted) return
    setError(cause instanceof Error ? cause : new Error(String(cause)))
  } finally {
    if (!controller.signal.aborted) setLoading(false)
  }
})()
```

`(async () => { ... })()` は「`async`な関数を定義して、その場で呼び出す」という書き方です。`useEffect`のコールバック**自体**は`async`ではないので何も返さず、制約を満たします。内側の`async`関数が返す`Promise`は誰も受け取りませんが、それは意図どおりです。先頭の`void`は「この`Promise`の結果は使わない」という意思表示で、書き忘れではないことを読み手に伝えます。

#### `finally`の中では`return`しない

書き換えで1つだけ形が変わった箇所があります。

```typescript
// .finally()のコールバックだったとき
.finally(() => {
  if (controller.signal.aborted) return
  setLoading(false)
})

// try/catch/finallyのfinallyブロックになった後
} finally {
  if (!controller.signal.aborted) setLoading(false)
}
```

`.finally()`に渡していたのは**独立した関数**なので、その中の`return`はその関数を抜けるだけでした。一方`try/catch/finally`の`finally`は**同じ関数の一部**であり、ここに`return`を書くと`catch`ブロックの`return`を上書きしてしまいます（JavaScriptの定番の落とし穴です）。今回は戻り値を使っていないので実害はありませんが、紛らわしい書き方を避けて`if`で囲う形にしています。

- `try` / `catch` / `finally`：`.then` / `.catch` / `.finally` と対応します。`finally`は成功・失敗どちらでも必ず実行されるため、`loading`を`false`に戻す処理を1箇所で済ませられる点は変わりません。

### `Promise.all`：複数の非同期処理を並列に待つ

`hooks/useLabelsByBoard.ts`は、ボードの数だけ`fetchJson`を呼ぶ必要があるという特殊な事情から、`Promise.all`を使っています。

```typescript
const entries = await Promise.all(
  boards.map(async (board): Promise<[number, LabelResponse[]]> => [
    board.id,
    await fetchJson<LabelResponse[]>(apiPaths.boardLabels(board.id), controller.signal),
  ]),
)
setLabelsByBoard(Object.fromEntries(entries))
```

`boards.map((board) => ...)`は、ボード1件につき1つの`Promise`を生成し、`Promise`の配列を作ります。`Promise.all(配列)`は、その配列に含まれる**すべての`Promise`が成功して初めて**成功する、1つの`Promise`を返します（1件でも失敗すれば、`Promise.all`全体もその時点で失敗します）。Nボードぶんのリクエストを直列に（1件ずつ順番に）待つのではなく、**同時に**投げて全部の完了を待てるため、通信時間はボードの数に比例して伸びません。

ここで注意したいのは、`map`に渡すコールバックを`async`にしても**並列性は失われない**ことです。`async`関数は呼ばれた瞬間に実行を始め、`await`で中断したところで`Promise`を返します。`map`はコールバックを次々に呼ぶので、N本の`fetch`はすべて開始済みの状態で配列に並びます。「直列になるのは`for`ループの中で`await`したとき」であって、`map`＋`Promise.all`の組み合わせでは起きません。

戻り値の型注釈`Promise<[number, LabelResponse[]]>`は、「ボードIDとラベル一覧のペア（タプル）」であることを明示するためのものです。`Promise.all`の結果は`[[1, [...]], [2, [...]], ...]`という配列になり、最後の`Object.fromEntries(entries)`で`{ 1: [...], 2: [...] }`という`Record`（[8章](./03-generics.md#8-recordとreadonlyとas-const)）へ組み替えています。

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

---

## 15. `fetch`でのPOSTとリクエストボディ

これまでの`fetchJson`は`fetch(url, { signal })`という最小限の第2引数だけで、常にGETリクエストを送っていました（`fetch`はオプションを省略すると既定でGETになります）。カード・ボードの新規作成にあわせて、`api/client.ts`に`postJson`が加わりました。

```typescript
export async function postJson<TRequest, TResponse>(path: string, body: TRequest): Promise<TResponse> {
  return request<TResponse>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
```

`fetch`の第2引数（`RequestInit`という組み込み型）は、GET専用ではなく、HTTP通信の内容を細かく指定できるオプションの入れ物です。

| プロパティ | 役割 |
| --- | --- |
| `method` | HTTPメソッド。省略時の既定値は`'GET'`。POSTするにはここに`'POST'`を明示する |
| `headers` | リクエストヘッダー。`'Content-Type': 'application/json'`は「このリクエストボディはJSON形式である」とサーバーに伝えるためのもの。これが無いと、バックエンド（Spring MVC）が`@RequestBody`をどう読めばよいか判断できない（[docs/spring-boot 28章](../spring-boot/09-write-api-validation.md#28-登録系apipostの作り方)参照） |
| `body` | リクエストボディの中身。文字列（または`Blob`・`FormData`など）を渡す必要があり、TypeScriptのオブジェクトをそのまま渡すことはできない |

### `JSON.stringify`：オブジェクトをJSON文字列に変換する

```typescript
body: JSON.stringify(body)
```

`fetch`のボディに渡せるのは文字列などの限られた型だけで、TypeScript/JavaScriptのオブジェクトをそのまま渡すことはできません。`JSON.stringify(値)`は、オブジェクトを**JSON形式の文字列**へ変換するブラウザ標準の関数です。`api/client.ts`の`response.json()`（[13章](#13-promiseとasyncawait)）がレスポンスボディの文字列をオブジェクトへ変換する`JSON.parse`相当の処理だったのに対し、`JSON.stringify`はその**逆方向**の変換にあたります。

### 型引数が2つあるジェネリクス関数

`postJson<TRequest, TResponse>`は、[7章](./03-generics.md#7-ジェネリクス)で見た`fetchJson<T>`と違い、型引数を2つ取ります。

```typescript
export async function postJson<TRequest, TResponse>(path: string, body: TRequest): Promise<TResponse> {
```

| 型引数 | 何を表すか | 呼び出し例 |
| --- | --- | --- |
| `TRequest` | 送信するリクエストボディの型 | `CardCreateRequest` |
| `TResponse` | 返ってくるレスポンスボディの型 | `CardResponse` |

GETは「何を取得するか」（レスポンスの型）だけを指定すれば済みましたが、POST/PUT/PATCHは「何を送るか」と「何が返ってくるか」という**2つの独立した型**を扱う必要があります。この2つは同じ型になるとは限りません（実際、`CardCreateRequest`は`labelIds: number[]`という送信専用のフィールドを持つ一方、`CardResponse`は付与済みラベルの詳細（`labels: LabelResponse[]`）や`status`・`position`のようなサーバー側が決める値を持つ、別の形の型です）。`hooks/useMutation.ts`の`useMutation<TRequest, TResponse>`（[docs/react 19章](../react/08-form-and-mutation.md#19-書き込みpostとデータの更新)）も同じく2つの型引数を取り、`postJson`/`putJson`/`patchJson`の型引数をそのまま中継しています。

### なぜ書き込み系（POST/PUT/PATCH）は中断（`AbortSignal`）を受け取らないのか

`fetchJson`との、もう1つの意図的な非対称があります。`postJson`・`putJson`・`patchJson`（内部で共通の`sendJson`に委譲する。カード編集・ステータス変更の実装にあわせて`postJson`から切り出された関数群）は、どれも`signal`を引数に取りません。

```typescript
// fetchJson: signalを受け取る
export async function fetchJson<T>(path: string, signal: AbortSignal): Promise<T>

// postJson / putJson / patchJson: signalを受け取らない
export async function postJson<TRequest, TResponse>(path: string, body: TRequest): Promise<TResponse>
```

GETの中断（[14章](#14-fetchとabortcontroller)）は、「表示しても無駄になった結果を捨てる」だけの安全な操作でした。中断してもサーバー側では単に参照が行われただけで、取り消すべき状態の変化はありません。書き込み系はそうはいきません。クライアント側で`fetch`を`abort()`しても、その時点でリクエストが既にサーバーに届いていれば、**サーバー側の処理（DBへの書き込み・更新）は止まらない**可能性があります。「中断したつもりが、実際にはカードが作成・更新されていた」という状態は、GETの中断より遥かに厄介な不整合です。これはPOSTだけでなくPUT・PATCHにも等しく当てはまるため、3つの関数がどれも同じく`AbortSignal`を受け取れないようにしています。この非対称性を型のレベルで表現し、「書き込み系は一度始めたら最後まで見届ける」という設計意図を示すためです。

