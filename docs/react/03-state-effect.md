# stateとuseEffect

[← React学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **7〜9章** をまとめています。

---

## 7. stateと`useState`

> **stateとは？**
> コンポーネントが「覚えておく必要のある値」です。stateが変わると、Reactはそのコンポーネント（と、その中身）を自動的に再描画します。[1章](./01-overview.md#1-reactとは)で見た「宣言的」というReactの性質は、「stateが変われば見た目も自動的に追従する」という約束があって初めて成り立ちます。

`pages/CrossBoardView.tsx`の、カード詳細モーダルの開閉を管理するstateを見てください。

```typescript
const [selectedCardId, setSelectedCardId] = useState<number | null>(null)
```

`useState(初期値)`は、`[現在の値, 値を更新する関数]`という2要素の配列を返します（配列の分割代入で`selectedCardId`・`setSelectedCardId`という名前を付けています）。`selectedCardId`は「今どのカードの詳細を開いているか」を表し、`null`は「閉じている」状態です。カードがクリックされると、次のように`setSelectedCardId`を呼びます。

```typescript
<CardItem
  card={card}
  onSelect={(cardId) => setSelectedCardId(cardId)}
/>
```

`setSelectedCardId(cardId)`を呼ぶと、Reactは`CrossBoardView`（と配下）を**再描画**し、その中の`<CardDetailModal cardId={selectedCardId} .../>`が新しい`cardId`を受け取って開いた状態になります。ここで重要なのは、`selectedCardId`という**変数への再代入**でこれが起きているのではなく、`setSelectedCardId`という**専用の関数を呼ぶこと**が再描画のトリガーになっている点です。`selectedCardId = cardId`のように直接代入しても、Reactはそれに気づけず、画面は更新されません。

### 初期値は初回描画時にしか使われない

`hooks/useApi.ts`の`loading`stateの初期値には、コメントで注意が添えられています。

```typescript
// 初期値をpath!==nullにしているのは、初回描画で一瞬だけ
// 「loading=false かつ data=null」＝「空データ」に見える状態を挟まないため。
// useStateの引数は初回レンダリング時にしか使われない（2回目以降は無視される）。
const [loading, setLoading] = useState(path !== null)
```

`useState(path !== null)`という式は、コンポーネントが再描画されるたびに**毎回評価はされますが**、Reactが実際に使うのは**最初の1回だけ**です。2回目以降の再描画では、この`useState(...)`の呼び出し自体は素通りされ、代わりに直前の`setLoading(...)`で設定された値が使われます。「`useState`の中に書いた式は初回しか効かない」という前提を理解していないと、「再描画のたびにstateがリセットされるはず」という誤解につながりやすい点です。

### 遅延初期化：初回描画のためだけに重い処理をしない

`pages/SearchView.tsx`には、`useState`に関数を渡す書き方が登場します。

```typescript
const [fromPath] = useState(() => (location.state as SearchLocationState | null)?.from ?? '/')
```

`useState(値)`ではなく`useState(() => 値を計算する処理)`と、**関数**を渡しています。これを**遅延初期化**と呼びます。`useState(通常の値)`だと、その値を計算する式は毎回の再描画のたびに評価されてしまいます（結果が使われるのは初回だけでも、計算自体は毎回走ります）。関数として渡すと、Reactは初回描画時にだけその関数を呼び出し、2回目以降は呼び出しません。ここでの計算（`location.state`から`from`を取り出す）自体は軽い処理ですが、コメントにあるとおり「マウント時の1回だけ`location.state`から読み取り、以後はこのローカルstateを正とする」という意図を、コードの形そのもので表現しています。

> **Javaとの対比**
> `useState`が返す`[値, 更新関数]`のペアは、Javaのフィールド（[docs/java 6章](../java/02-class-and-object.md#6-クラスの構成要素)）に近い役割ですが、決定的に違うのは「更新の仕方」です。Javaのフィールドはメソッド内で単純に代入すれば即座に変わりますが、Reactのstateは`setSelectedCardId(...)`のような専用関数を呼ぶことでしか変更できず、しかもその変更は次の再描画まで反映されません（同じ処理の中で`selectedCardId`を読み直しても、更新後の値にはなりません）。この「関数コンポーネントは呼ばれるたびに最初から実行し直される」という実行モデルの違いが、[8章](#8-useeffectと副作用クリーンアップ)の`useEffect`が必要になる理由でもあります。

---

## 8. `useEffect`と副作用・クリーンアップ

> **`useEffect`とは？**
> 「描画そのもの」ではなく、「描画の**結果として**何かを行いたい」処理（API通信・タイマー・イベントリスナーの登録など）を書くためのフックです。このような、コンポーネントの外の世界とやり取りする処理を**副作用（side effect）**と呼びます。

`hooks/useApi.ts`の実装全体が、`useEffect`のもっとも重要な使い方を凝縮しています。

```typescript
useEffect(() => {
  if (path === null) {
    setData(null)
    setLoading(false)
    setError(null)
    return
  }

  const controller = new AbortController()
  setLoading(true)
  setError(null)
  setData(null)

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

  return () => {
    controller.abort()
  }
}, [path])
```

- **第1引数**（アロー関数）：描画が終わった**後**に実行される処理です。「`state`が変わる→再描画される→その結果としてこの関数が実行される」という順序を意識してください（描画中に実行されるわけではありません）。
- **第2引数**（`[path]`、依存配列）：この効果を「いつ実行し直すか」を指定します。`path`の値が前回の描画時と変わったときだけ、この関数が再実行されます。空配列`[]`なら初回のみ、配列そのものを省略すると**毎回**の描画のたびに実行されます（無限ループの原因になりやすい書き方です）。
- **戻り値**（`return () => { controller.abort() }`）：**クリーンアップ関数**です。Reactは、(1)依存配列の値が変わって効果を実行し直す直前、(2)コンポーネントが画面から消える（アンマウントされる）とき、の2つのタイミングで必ずこれを呼びます。

### 依存配列は「値」を比較する（`Object.is`）

なぜ`hooks/useApi.ts`は`path`という**URLオブジェクト**や**関数**ではなく、単なる**文字列**を受け取る設計になっているのでしょうか。コメントに理由があります。

```typescript
// なぜURLオブジェクトや関数ではなく「パス文字列」を受け取るのか:
//   useEffectの依存配列はObject.isで比較されるため、依存に置けるのは
//   「レンダリングのたびに作り直しても中身が同じなら等しいと判定される値」
//   ＝プリミティブ（文字列・数値）が最も安全。
//   ここでオブジェクト（{ boardId: 1 } など）や関数を受け取ると、
//   毎レンダリングで新しいインスタンスになり「変わった」と判定され、
//   無限に再フェッチが走ってしまう。
```

依存配列の比較は、[docs/typescript](../typescript/README.md)で扱った値の等価性とは別の、JavaScriptの`Object.is`という関数で行われます。オブジェクトや配列は、**中身が同じでも毎回新しく作られると「別物」と判定されます**（`{ a: 1 } === { a: 1 }`が`false`になるのと同じ理由です）。文字列・数値などのプリミティブ値は、中身が同じなら常に「同じ」と判定されるため、依存配列に安全に置けます。この設計判断のおかげで、`apiPaths.cards({...})`のように毎回新しい文字列を組み立てて渡しても、実際に中身の文字列が変わらない限り`useEffect`は再実行されません。

### クリーンアップこそが本体：`useDebouncedValue`

`hooks/useDebouncedValue.ts`は、クリーンアップ関数が「後片付け」ではなく**処理の主役**になっている例です。

```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    setDebounced(value)
  }, delayMs)

  return () => {
    clearTimeout(timer)
  }
}, [value, delayMs])
```

`value`が変わるたびに、新しいタイマーを仕掛けます。ポイントは、**次に`value`が変わった瞬間**、Reactは新しい効果を実行する前に、必ず直前のクリーンアップ（`clearTimeout(timer)`）を先に呼ぶという点です。コメントの説明を借りると、「見」→「見積」と2回値が変わった場合：

1. 「見」でタイマーAを仕掛ける
2. 「見積」に変わった瞬間、クリーンアップが先に走りタイマーAを消す→タイマーBを仕掛ける
3. `delayMs`後、生き残ったタイマーBだけが発火し、`debounced`が「見積」になる

「前回のタイマーを毎回消してから新しいタイマーを仕掛け直す」という一連の流れ自体が、そのままデバウンス（連続した変化の最後の1回だけを反映する処理）の実装になっています。

### イベントリスナーのクリーンアップ：`CardDetailModal`

`components/CardDetailModal.tsx`は、キーボードイベントの購読と解除の例です。

```typescript
useEffect(() => {
  if (cardId === null) return

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') onClose()
  }

  document.addEventListener('keydown', handleKeyDown)

  return () => {
    document.removeEventListener('keydown', handleKeyDown)
  }
}, [cardId, onClose])
```

クリーンアップ（`removeEventListener`）を書き忘れると、モーダルを開閉するたびにリスナーが積み上がっていき、Escapeキーを1回押しただけで登録済みの全リスナーが実行される、という不具合になります。「`addEventListener`した分は必ず`removeEventListener`する」という対応関係を、クリーンアップ関数の形で保証しているのがこのパターンです。

### `StrictMode`がクリーンアップを検査してくれる

[docs/react 2章](./01-overview.md#2-アプリの起動と全体構成)で登場した`<StrictMode>`は、開発時に限って、マウント→アンマウント→再マウントを意図的に1往復させます。これにより、`useEffect`のクリーンアップが正しく書けているかを検査してくれます。`hooks/useApi.ts`のコメントにも、この挙動についての説明があります。

```typescript
// 開発時にStrictModeが有効だと、Reactは意図的に
// マウント→アンマウント→再マウント を1往復させ、この後片付けが正しく
// 書けているかを検査する。結果としてNetworkタブにリクエストが2本並ぶが、
// 1本目は必ずabortされるので正しい挙動。本番ビルドでは1回しか走らない。
```

開発中にブラウザの開発者ツールでネットワークタブを見ると、同じAPIへのリクエストが2本並んでいることがありますが、これはバグではなく、クリーンアップ（`controller.abort()`）が正しく機能していることの証拠です。本番ビルド（`npm run build`の成果物）では`StrictMode`のこの二重実行は行われず、1回しか実行されません。

---

## 9. フックのルール

> **フックのルールとは？**
> `useState`・`useEffect`のような`use`で始まる関数（フック）は、**コンポーネントのトップレベルで、毎回まったく同じ順序・同じ回数だけ**呼ばれなければならない、というReact自身が課している制約です。`if`文の中や、早期returnの後でフックを呼んではいけません。

`components/CardDetailModal.tsx`のコメントが、このルールを守るための実装上の工夫を説明しています。

```typescript
// フックは「毎回まったく同じ順序で同じ回数」呼ばれる必要がある。
// そのため、閉じているとき（cardId===null）に早期returnするのは
// すべてのフックを呼び終えたあと。フックより前にreturnすると、
// 開閉のたびにフックの呼び出し数が変わり、Reactが状態を取り違えてしまう
const { data: card, loading, error } = useApi<CardResponse>(
  cardId === null ? null : apiPaths.card(cardId),
)

useEffect(() => { /* ... */ }, [cardId, onClose])

if (cardId === null) return null

return ( /* モーダルのJSX */ )
```

一見すると、「`cardId`が`null`（モーダルが閉じている）ときは、何もせず即座に`return null`した方が効率的」に思えるかもしれません。しかし`if (cardId === null) return null`を`useApi`・`useEffect`より**前**に置いてしまうと、モーダルが閉じているときはフックが0回、開いているときは2回呼ばれることになり、呼び出し回数が状況によって変わってしまいます。

### なぜ回数がずれると壊れるのか

Reactは`useState`・`useEffect`が管理するstateやeffectを、**名前ではなく呼ばれた順序**で内部的に紐付けています。1回目の描画で「1番目の`useState`はA、2番目はB」と記録した後、2回目の描画で1番目のフック呼び出しが無くなっていたりすると、Reactは「2番目のつもりで呼ばれたフック」を誤って「1番目のフックの続き」として扱ってしまい、まったく無関係なstateが返ってきたり、クリーンアップが正しいタイミングで呼ばれなくなったりします。これを避けるため、`CardDetailModal`は「フックは無条件に・早期returnより前に・すべて呼ぶ」を徹底し、「何も表示しない」という分岐（`return null`）は、フックをすべて呼び終えたその後に置いています。`useApi`にnullを渡すと通信自体は行われない（[docs/typescript 6章](../typescript/02-object-types.md#6-nullundefinedとstrictnullchecks)の`T | null`の応用）ため、フックの回数を保ちながら「実際には何もしない」を両立できています。

### ツールによる検査：`.oxlintrc.json`

このルールは目視でも守れますが、うっかりミスを防ぐため、本プロジェクトはリンター（コードの誤りを機械的に検出するツール）でも検査しています。

```json
{
  "plugins": ["react", "typescript", "oxc"],
  "rules": {
    "react/rules-of-hooks": "error"
  }
}
```

`.oxlintrc.json`の`react/rules-of-hooks`ルールが`"error"`になっているため、`npm run lint`（`oxlint`）を実行すると、条件分岐の中やreturnの後でフックを呼んでいるコードは自動的にエラーとして検出されます。「気を付ける」ではなく「ツールが機械的に守らせる」という、[CLAUDE.mdのコーディング規約](../../CLAUDE.md)にも通じる、本プロジェクト全体の姿勢の一例です。
