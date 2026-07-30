# フォームと書き込み（POST）

[← React学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **18〜20章** をまとめています。

---

## 18. フォームの実装

これまでの入力欄（[02-component-jsx.md 6章](./02-component-jsx.md#6-イベントハンドラと制御コンポーネント)の`<input>`・`<select>`）は、`onChange`のたびにURLやstateを直接書き換える、**送信という手続きを持たない**制御コンポーネントでした。カード・ボードの新規作成フォームで、本プロジェクト初めての`<form>`と`onSubmit`が登場します。

### `<form onSubmit>`と`preventDefault`

```tsx
<form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-slate-300 bg-white p-3 shadow-sm">
  <input ref={titleInputRef} type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
  {/* ... */}
  <button type="submit" disabled={title.trim() === '' || submitting}>追加</button>
</form>
```

```tsx
async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()
  const created = await create({ boardId, title: title.trim(), /* ... */ })
  if (created === null) return
  resetAndClose()
  onCreated()
}
```

ブラウザの`<form>`は、何も手を加えなければ`type="submit"`のボタンが押された（あるいはテキスト入力欄で`Enter`が押された）瞬間に、**ページ全体をリロードしてサーバーへ送信する**という、HTML標準の古典的な挙動を持っています。SPA（Single Page Application）であるこのアプリでそのままリロードが起きてしまうと、Reactが管理しているすべてのstateが消え、URLの遷移（React Router）も無視されてしまいます。`event.preventDefault()`は、この既定の送信動作を止め、代わりに`handleSubmit`の中で`fetch`ベースの非同期送信（[19章](#19-書き込みpostとデータの更新)）に置き換えるためのおまじないです。

`<button type="submit">`は「このボタンが押されたら、祖先の`<form>`の`onSubmit`を発火させる」という意味を持ちます。カード作成フォームの「キャンセル」ボタンには`type="button"`を指定していますが、これは[06-component-design.md](./06-component-design.md)以前からの慣習（クリック可能な要素は`type`を明示する）に加えて、**うっかりフォームを送信してしまわないため**という、`<form>`が登場したことで生まれた新しい理由でもあります。`type`を省略した`<button>`は、`<form>`の中では既定で`type="submit"`として扱われる点に注意してください。

### 要件5.2「タイトルが空欄なら追加ボタンを無効化する」

```tsx
<button
  type="submit"
  disabled={title.trim() === '' || submitting}
  title={title.trim() === '' ? 'タイトルを入力してください' : undefined}
>
  {submitting ? '追加中…' : '追加'}
</button>
```

`disabled`は真偽値をそのまま渡せるprops（[02-component-jsx.md 6章](./02-component-jsx.md#6-イベントハンドラと制御コンポーネント)）です。`title.trim() === ''`は、前後の空白だけを入力した状態（見た目は「入力されているように見える」が実質は空）も「未入力」とみなすための判定で、`title === ''`という単純な比較よりわずかに厳密です。`|| submitting`は[19章](#19-書き込みpostとデータの更新)で扱う二重送信防止のための条件で、「タイトルが空」と「送信中」という**2つの独立した理由**のどちらかに該当すればボタンを無効化する、という意味です。`title`属性（HTML標準のツールチップ）で理由を添えるのは、`components/BoardSelect.tsx`が取得エラー時に採っているのと同じ作法です。

### 入力を1つのオブジェクトにまとめなかった理由

`CardCreateForm`はタイトル・説明・期日・ラベルという4つの入力を、それぞれ独立した`useState`で持っています。

```tsx
const [title, setTitle] = useState('')
const [description, setDescription] = useState('')
const [dueDate, setDueDate] = useState('')
const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>([])
```

1つの`useState<{ title: string; description: string; ... }>`にまとめる書き方も可能ですが、その場合は1項目更新するたびに次のようなスプレッド構文が必要になります。

```tsx
// 採用しなかった書き方
setForm((current) => ({ ...current, title: event.target.value }))
```

このフォームの入力項目は4つで、互いに独立して更新される（「タイトルを変えたら説明欄も連動して変わる」ような依存関係が無い）ため、個別の`useState`の方が1行で完結し読みやすいと判断しました。まとめる書き方が有利になるのは、項目数が多い・項目間に依存関係がある・フォーム全体をまとめてリセットする処理が頻出する、といった場合です。

### 開閉状態を持つフォーム

`CardCreateForm`は常時表示されているわけではなく、「＋ カードを追加」ボタンと入力フォームを、1つの`boolean`のstateで切り替えます。

```tsx
const [open, setOpen] = useState(false)

if (!open) {
  return <button type="button" onClick={() => setOpen(true)}>＋ カードを追加</button>
}

return <form onSubmit={handleSubmit}>{/* ... */}</form>
```

`BoardManageModal`（モーダル内フォーム）は開閉を`open: boolean`という**props**として親（`App.tsx`）から受け取りますが、`CardCreateForm`（インラインフォーム）は開閉を**自分自身のローカルstate**として持っています。この違いは、[06-component-design.md 15章](./06-component-design.md#15-コンポーネント設計と状態の持ち方)の「状態はそれを必要とする最小のコンポーネントに置く」という判断基準そのものです。ボード管理モーダルの開閉はヘッダーの`⚙`ボタン（`CardCreateForm`とは別のコンポーネント）から操作される必要があるため親が持ちますが、カード追加フォームの開閉を必要としているのは`CardCreateForm`自身だけなので、ローカルに閉じています。

---

## 19. 書き込み（POST）とデータの更新

### `useCreate`：書き込み専用のカスタムフック

[04-custom-hooks.md 10章](./04-custom-hooks.md#10-カスタムフック)で見た`useApi`は、「pathの変化を検知して`useEffect`でGETする」という、コンポーネントの**描画に追従する**取得系の設計でした。POSTは性質が逆で、「ボタンを押すという明示的な操作」で一度だけ実行したい書き込みです。依存配列に乗せて自動発火させる`useEffect`とは相性が悪いため、`useApi`をそのまま使わず、新たに`useCreate`を用意しました。

```tsx
export function useCreate<TRequest, TResponse>(path: string): UseCreateResult<TRequest, TResponse> {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const create = useCallback(
    async (request: TRequest): Promise<TResponse | null> => {
      setSubmitting(true)
      setError(null)
      try {
        return await postJson<TRequest, TResponse>(path, request)
      } catch (cause) {
        setError(cause instanceof ApiError ? cause : new Error(String(cause)))
        return null
      } finally {
        setSubmitting(false)
      }
    },
    [path],
  )

  return { create, submitting, error }
}
```

`data`/`loading`/`error`という`useApi`の骨格を、`submitting`/`error`という形で踏襲しつつ、中身は書き込み用に書き直しています。この「既存のフックがそのまま使えない用途では、低レベルな関数（`postJson`）を直接使い、data/loading/errorという骨格だけは同じ考え方を保つ」という判断は、`hooks/useLabelsByBoard.ts`が`useApi`ではなく`fetchJson`を直接使ったとき（[04-custom-hooks.md 10章](./04-custom-hooks.md#10-カスタムフック)）と同じです。カード作成・ボード作成の両方が同じ`useCreate<TRequest, TResponse>`を型引数だけ変えて使い回せるのは、[docs/typescript 7章](../typescript/03-generics.md#7-ジェネリクス)のジェネリクスのおかげです。

`create`が失敗時に**例外を投げず`null`を返す**設計にしているのは、呼び出し側（フォームの`onSubmit`）が`try`/`catch`を書かずに済むようにするためです。

```tsx
const created = await create({ boardId, title: title.trim(), /* ... */ })
if (created === null) return
```

失敗の詳細は`error`（フックが返すstate）に既に入っているので、`handleSubmit`はこの1行の早期returnだけで「失敗時は入力内容を残したまま処理を打ち切る」ことができます。

### なぜ楽観的更新にしないのか

カードを作成した直後、画面には**まだ一覧に反映されていない**新しいカードを、どう表示に反映させるかという問題があります。選択肢は大きく2つです。

| 方式 | やること | 本プロジェクトの選択 |
| --- | --- | --- |
| 楽観的更新（Optimistic Update） | サーバーの応答を待たず、ローカルの配列にその場で1件足す | 不採用 |
| 再取得（Refetch） | サーバーに問い合わせ直し、最新の一覧をまるごと取得し直す | **採用** |

楽観的更新を採らなかった理由は、カードの並び順（`position`）が**サーバー側だけが把握している情報**だからです。`frontend/src/lib/grouping.ts`の`groupCardsByStatus`・`groupCardsByStatusAndBoard`は、受け取った配列を一切ソートせず、サーバーが返した順序をそのまま信頼する設計になっています（`CardRepository.search`の`order by`が並び順の唯一の決定者です）。もしローカルの配列に新しいカードを`push`するだけで済ませてしまうと、「サーバーが決めた並び順を、フロントエンドは一切決めない」というこの契約が崩れます。新規作成したカードの`position`は「同一ボード・同一ステータス内の最大値+1」（[docs/spring-boot 31章](../spring-boot/09-write-api-validation.md#31-登録処理の中身)）というルールでサーバーが決めており、それをフロントエンド側で再現しようとすると、ロジックの二重管理という別の問題を生みます。再取得であれば、この判断をすべてサーバーに委ねたまま、常に正しい並び順を得られます。

### `useApi`への`refetch`の追加

再取得を実現するため、`useApi`に`refetch`という関数を追加しました。

```tsx
const [reloadCount, setReloadCount] = useState(0)

useEffect(() => {
  // ... fetchJsonを呼ぶ処理
}, [path, reloadCount]) // pathだけでなくreloadCountも依存配列に加える

const refetch = useCallback(() => {
  setReloadCount((count) => count + 1)
}, [])

return { data, loading, error, refetch }
```

`reloadCount`という数値自体に意味はなく、「変化した」という事実だけを使っています。`useEffect`の依存配列（[03-state-effect.md 8章](./03-state-effect.md#8-useeffectと副作用クリーンアップ)）は「配列内のいずれかの値が前回の描画と変わったら再実行する」という仕組みなので、`path`が変わらなくても`reloadCount`を増やせば、同じ`path`に対してもう一度GETを実行させられます。

`refetch`を`useCallback`で包んでいるのは、この関数を呼び出し側（`BoardDetailView`・`App.tsx`）が別のコンポーネント（`CardCreateForm`・`BoardManageModal`）へpropsとしてそのまま渡すためです。

```tsx
// BoardDetailView.tsx
const { data: cards, loading, error, refetch } = useApi<CardResponse[]>(path)
// ...
<CardCreateForm boardId={boardIdNumber} onCreated={refetch} />
```

`useCallback`で包まない素の関数式のままだと、`BoardDetailView`が再描画されるたびに新しい`refetch`関数のインスタンスが作られます。`refetch`自体を別のコンポーネントの`useEffect`の依存配列に置くような使い方をした場合、意図しない再実行を招きかねません（[04-custom-hooks.md 12章](./04-custom-hooks.md#12-usememoと再計算の抑制)の`useMemo`と同じ「値が変わっていないのに再計算/再実行させたくない」という動機です）。`setReloadCount(count => count + 1)`という**更新関数の形**（[03-state-effect.md 7章](./03-state-effect.md#7-stateとusestate)）で呼んでいるのも、`useCallback`の依存配列を空にしたまま、常に最新の`reloadCount`を基準に加算するためです。

### `submitting`による二重送信防止

`useCreate`が返す`submitting`は、送信ボタンの`disabled`条件（[18章](#18-フォームの実装)）に組み込まれています。

```tsx
disabled={title.trim() === '' || submitting}
```

ネットワークが遅い環境でボタンを連打すると、`fetch`が2回発行され、カードが重複して作成されてしまう可能性があります。送信開始（`create`が呼ばれた瞬間）に`submitting`を`true`にし、成功・失敗どちらでも`finally`で`false`に戻すことで、通信中はボタン自体を押せなくし、この事故を防いでいます。

### ボード一覧のstateをリフトアップした話

カード作成フォームとは別に、ボード管理モーダル（`BoardManageModal`）でのボード新規作成には、もう1つ考えることがありました。ヘッダーのセレクトボックス（`BoardSelect`）が表示するボード一覧は、モーダルでの新規作成の結果を**知る必要がある**という点です。

作業前、`BoardSelect`は自分自身で`useApi(apiPaths.boards())`を呼んでいました（[06-component-design.md 15章](./06-component-design.md#15-コンポーネント設計と状態の持ち方)の「必要なコンポーネントがそれぞれ独立してデータを取得する」という方針そのものです）。しかしボード管理モーダルを追加すると、「ボード一覧を必要とするコンポーネントが2つ（`BoardSelect`と`BoardManageModal`）」になり、しかも**片方（モーダル）での変更を、もう片方（セレクトボックス）に伝える必要がある**という新しい要求が生まれました。独立して`useApi`を呼ぶ方針のままでは、モーダルで作成したボードがセレクトボックスの選択肢に反映されません。

解決策は、ボード一覧の取得を共通の親である`App.tsx`へ**引き上げる**（リフトアップする）ことでした。

```tsx
// App.tsx
const { data: boards, loading: boardsLoading, error: boardsError, refetch: refetchBoards } =
  useApi<BoardResponse[]>(apiPaths.boards())

return (
  <>
    <BoardSelect boards={boards} loading={boardsLoading} error={boardsError} />
    {/* ... */}
    <BoardManageModal boards={boards ?? []} onCreated={refetchBoards} /* ... */ />
  </>
)
```

`BoardSelect`は`useApi`を呼ぶ側から、`boards`/`loading`/`error`をpropsとして**受け取る**側に変わりました。モーダルでの作成が成功すると`refetchBoards()`が呼ばれ、`App.tsx`が持つ`boards`が更新され、それをpropsとして受け取っている`BoardSelect`の選択肢にも自動的に反映されます。

**Contextは導入していません**。React にはこうした「離れたコンポーネント間でデータを共有する」ための`Context`という仕組みがありますが、消費者がまだ`BoardSelect`と`BoardManageModal`の2つだけで、共通の親（`App.tsx`）からpropsで配るだけで十分に見通しが良い規模です。Contextを持ち込むと、「この値はどこから来るのか」を`useContext`の呼び出し元だけを見ても追えなくなる（Providerの位置まで遡る必要がある）という間接層が増えるコストの方が、今回は上回ると判断しました。[06-component-design.md 15章](./06-component-design.md#15-コンポーネント設計と状態の持ち方)で述べた「Contextは共有すべき状態がもっと複雑になったときの検討課題」という位置づけは変わっていません——ただし「複数のコンポーネントが同じデータに依存し、かつ一方の変更が他方に影響する」という状況が実際に発生したときにまず検討する選択肢は、（Contextへ飛びつく前に）**リフトアップ**であることが、今回の変更で実例として示されました。

**横断ビューでもこのリフトアップがそのまま活きました**。横断ビュー（`pages/CrossBoardView.tsx`）でボードごとにカード追加フォームを置けるようにしたとき（[06-component-design.md 15章](./06-component-design.md#15-コンポーネント設計と状態の持ち方)参照）、「カードが1枚も無いボード」のセクションも表示するために、ボード一覧（`boards`）がもう1箇所で必要になりました。

```tsx
// App.tsx
<Route path="/" element={<CrossBoardView boards={boards} />} />
```

もし`BoardSelect`のときにリフトアップしていなければ、ここでも`CrossBoardView`が独自に`useApi(apiPaths.boards())`を呼ぶ羽目になり、`App.tsx`と合わせて同じボード一覧を2回取得することになっていたはずです。既に`App.tsx`が`boards`を持っていたおかげで、`<CrossBoardView boards={boards} />`とpropsで渡すだけで済みました。「一度リフトアップした状態は、後から増える消費者にもそのまま配れる」という、リフトアップの効果が波及した例です。

一方で`boardsLoading`・`boardsError`は`CrossBoardView`へ渡していません。ボード一覧の取得に失敗しても、ヘッダーの`BoardSelect`が既にエラー表示を担当しており、横断ビュー側は`lib/grouping.ts`の`groupCardsByStatusAndBoard`が備えているフォールバック（`boards`が`null`なら、取得できているカードの情報だけからボードのセクションを導出する）で動き続けるため、同じエラーをもう一度表示する必要が無いと判断したためです。

---

## 20. `useRef`とDOMへの直接アクセス

> **`useRef`とは？**
> 再描画をまたいで値を保持できるが、値が変わっても**再描画を引き起こさない**フックです。DOM要素（`<input>`など）そのものへの参照を保持する用途で特によく使われます。

カード追加フォーム・ボード管理モーダルのどちらも、フォームを開いた直後にテキスト入力欄へ自動でフォーカスを当てます。これが本プロジェクト初めての`useRef`の使用です。

```tsx
const titleInputRef = useRef<HTMLInputElement>(null)

useEffect(() => {
  if (open) {
    titleInputRef.current?.focus()
  }
}, [open])

return <input ref={titleInputRef} type="text" /* ... */ />
```

| 要素 | 意味 |
| --- | --- |
| `useRef<HTMLInputElement>(null)` | 「`HTMLInputElement`（またはまだ何も指していない`null`）を指す入れ物」を作る。引数の`null`は初期値 |
| `ref={titleInputRef}` | JSXの要素に`ref`属性を渡すと、Reactがその要素をDOMに実際に描画した後、`titleInputRef.current`にその要素（`<input>`のDOMオブジェクト）を代入する |
| `titleInputRef.current?.focus()` | `HTMLInputElement`が標準で持つ`focus()`メソッドを呼び、その入力欄にキーボードフォーカスを移す。`?.`（オプショナルチェイニング）は、`current`がまだ`null`（要素が描画される前）の場合に備えたガード |

### `useState`との違い

`useState`は「値が変わったら再描画してUIに反映したい」もの（例：`title`の入力内容）に使います。一方`useRef`は「値は保持したいが、その値が変わったこと自体で再描画を起こしたくない」ものに使います。フォーカスを当てる対象のDOM要素は、それ自体が「表示すべき値」ではなく、「操作するための取っ手」に過ぎません。もし`useState`でDOM要素を保持しようとすると、`setState`のたびに不要な再描画が発生してしまいます。`useRef`は値の変更（`.current`への代入）を再描画のトリガーにしないことで、この無駄を避けています。

### なぜ`useEffect`の中で呼ぶのか

`titleInputRef.current?.focus()`を、フォームを開くボタンの`onClick`ハンドラの中で直接呼ぶことはできません。ボタンが押された時点（`setOpen(true)`を呼んだ直後）では、まだ折りたたみ状態のUIが描画されており、展開後の`<input>`はDOMにまだ存在しないためです。`useEffect`は「描画（DOMの更新）が終わった**後**に実行される」という性質（[03-state-effect.md 8章](./03-state-effect.md#8-useeffectと副作用クリーンアップ)）を持つため、依存配列に`open`を指定した`useEffect`の中でなら、`open`が`true`になり実際に`<input>`がDOMに現れた直後というタイミングで、確実に`focus()`を呼べます。

---

## 21. フォームの中でネストした作成を行う

要件定義5.5「ラベル管理」に対応するため、`components/CardCreateForm.tsx`（カード新規作成フォーム）の中に、もう1つの小さな作成フォーム（ラベルの新規作成）を組み込みました。「フォームの中にフォームがある」入れ子の構造は本プロジェクト初めてで、これまでの章の考え方をいくつか組み合わせて実現しています。

### `<form>`は入れ子にできない

HTMLの`<form>`要素は仕様上、他の`<form>`の内側に置けません（ブラウザは無視するか、開発者が意図しない形にパースします）。カード作成フォームは既に`<form onSubmit={handleSubmit}>`なので、ラベル作成を2つ目の`<form>`として素直に書くことはできません。

```tsx
// 採れない書き方（<form>の中に<form>を書くことになってしまう）
<form onSubmit={handleSubmit}>
  {/* ... */}
  <form onSubmit={handleCreateLabel}>{/* ... */}</form>
</form>
```

代わりに、ラベル作成は`onSubmit`を持たないただの関数として実装し、「作成」ボタンの`onClick`と、ラベル名欄での`Enter`キー（`onKeyDown`）の2箇所から直接呼び出す形にしました。

```tsx
async function handleCreateLabel() {
  const created = await createLabel({ name: newLabelName.trim(), color: newLabelColor })
  if (created === null) return
  refetchLabels()
  setSelectedLabelIds((current) => [...current, created.id])
  setNewLabelName('')
  setLabelCreatorOpen(false)
}
```

```tsx
<button type="button" onClick={handleCreateLabel} disabled={newLabelName.trim() === '' || creatingLabel}>
  {creatingLabel ? '作成中…' : '作成'}
</button>
```

ここで`type="button"`が欠かせません。[18章](#18-フォームの実装)で見たとおり、`<form>`の中にある`<button>`は`type`を省略すると既定で`type="submit"`として扱われ、クリックのたびに**外側のカード作成フォーム**が送信されてしまいます。ラベル作成ボタン・色スウォッチ（`ColorSwatchPicker`の各ボタン）・ラベル作成のキャンセルボタンは、すべて明示的に`type="button"`を指定しています。

### Enterキーの向き先を明示する

同じ理由で、ラベル名の入力欄で`Enter`を押したときの挙動にも注意が必要です。`<input>`は同じ`<form>`の中にある限り、何もしなければ`Enter`キーでその`<form>`の`onSubmit`（＝カード作成）を発火させてしまいます。

```tsx
<input
  type="text"
  value={newLabelName}
  onChange={(event) => setNewLabelName(event.target.value)}
  onKeyDown={(event) => {
    if (event.key === 'Enter') {
      event.preventDefault() // ← これが無いと外側の<form>のonSubmitが発火してしまう
      void handleCreateLabel()
    }
  }}
/>
```

`event.preventDefault()`を呼んでから`handleCreateLabel()`を呼ぶことで、「このEnterはラベル作成に向けたものだ」とReactに伝えています。1つの`<form>`の中に「カードを送信する」「ラベルを作成する」という2つの送信意図が同居しているからこそ、Enterキーの向き先をどちらにするかをコードで明示しなければならない、という`<form>`1つだけの単純な構成では出てこなかった問題です。

### 2つ目の`useCreate`——送信中・エラーを独立させる

`CardCreateForm`は[19章](#19-書き込みpostとデータの更新)の`useCreate`を、型引数を変えて2回呼び出しています。

```tsx
const { create, submitting, error } =
  useCreate<CardCreateRequest, CardResponse>(apiPaths.createCard())

const { create: createLabel, submitting: creatingLabel, error: labelError } =
  useCreate<LabelCreateRequest, LabelResponse>(apiPaths.boardLabels(boardId))
```

同じフックを同じコンポーネントの中で2回呼ぶこと自体は、[9章](./03-state-effect.md#9-フックのルール)の「フックのルール」に反しません（ループや条件分岐の中で呼ばない限り、フックは何度でも呼べます）。分割代入の変数名を`create`→`createLabel`、`submitting`→`creatingLabel`のように**別名で受け取る**ことで、1つのコンポーネントの中に「カード送信用の状態」と「ラベル作成用の状態」という2組の`submitting`/`error`が、互いに独立して存在できます。もし1つの`useCreate`を使い回そうとすると、ラベル作成中はカードの送信ボタンまで`submitting`扱いになってしまう（またはその逆）という、意図しない結合が生まれていたはずです。

### 子リソースの作成結果を、親の保留中stateへ反映する

ラベルは作成した瞬間、そのラベルが「今まさに作成しようとしているカード」に自動で付与されます（プロトタイプの`card.labelIds.push(label.id)`と同じ意図）。ただし本実装では、まだカード自体が存在しない（サーバーに送信する前）段階でこれを行う必要があります。

```tsx
const created = await createLabel({ name: newLabelName.trim(), color: newLabelColor })
if (created === null) return

refetchLabels()
setSelectedLabelIds((current) => [...current, created.id])
```

`selectedLabelIds`は「送信予定のラベルID一覧」を持つ、カード作成フォーム側のstate（[18章](#18-フォームの実装)）です。ラベルの作成に成功した直後、その`created.id`をこのstateへ追記することで、既存ラベルをチップでトグル選択したとき（`handleToggleLabel`）とまったく同じ経路で「選択済み」の扱いになります。子リソース（ラベル）を作ってすぐ親の入力state（`selectedLabelIds`）に書き戻す、という一手間を挟むことで、「ラベルを作る」と「そのラベルをカードに付ける」という2つの操作が、利用者からは1回のクリックで完了したように見えます。

`refetchLabels()`（[19章](#19-書き込みpostとデータの更新)の`refetch`と同じ仕組み）も同時に呼んでいるのは、選択チップの一覧（`labels`）自体を最新化するためです。`selectedLabelIds`と`labels`は別々のstateなので、どちらを先に呼んでも結果は変わりません。

### ラベルが1件も無いボードでも、作成の入り口を隠さない

ラベル欄のJSXには、`labels.length > 0`という条件が2箇所に分かれて登場します。

```tsx
{labels !== null && (
  <div>
    {labels.length > 0 && (
      <div>{/* 既存ラベルの選択チップ */}</div>
    )}
    {/* ＋ 新しいラベルを作成 は常にここに描画する（labels.length > 0の外側） */}
  </div>
)}
```

「選択できる既存ラベルが無いなら、選択チップの行自体を出さない」という判断はそのままですが、「＋ 新しいラベルを作成」の導線まで同じ条件に含めてしまうと、**ラベルが1枚も無いボードで最初のラベルを作る手段が無くなってしまいます**。[06-component-design.md](./06-component-design.md#15-コンポーネント設計と状態の持ち方)や本ファイル冒頭（[18章](#18-フォームの実装)）で繰り返し出てくる「0件だからといって機能への入り口まで消してはいけない」という判断基準が、ここでも同じ形で当てはまります。

### `ColorSwatchPicker`——もう1つのcontrolledコンポーネント

色の選択肢は`components/ColorSwatchPicker.tsx`という新しいコンポーネントに切り出しました。選択状態（`selectedColor`）も選択時の処理（`onSelect`）も自分では持たず、すべて親からpropsで受け取る「controlled」なコンポーネントです。

```tsx
type Props = {
  selectedColor: string
  onSelect: (color: string) => void
}
```

これは[4章](./02-component-jsx.md#4-propsと型付け)で見た`LabelToggleChip`（選択状態を`selected`propsで受け取り、`onToggle`で親に通知する）と同じ設計です。「選択されている色は何か」という情報を`ColorSwatchPicker`自身の内部stateに持たせなかったのは、そうすると親（`CardCreateForm`）が「今choose中の色」を知るために`ColorSwatchPicker`の内部を覗く手段が必要になってしまうからです。選択状態を常に親のstate（`newLabelColor`）という1箇所だけに置き、`ColorSwatchPicker`は「今の値を表示し、クリックされたら親に伝える」だけの薄い層に徹しています。
