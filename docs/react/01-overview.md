# Reactの全体像とアプリの起動

[← React学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **1〜2章** をまとめています。

---

## 1. Reactとは

> **Reactとは？**
> 画面のUIを「今の状態から、こう見えるはずだ」という**宣言的**な形で書くと、実際のDOM操作（要素の追加・削除・書き換え）をReact自身が代行してくれるJavaScriptライブラリです。

このプロジェクトには、Reactを使わずに同じ画面を作った`prototype/app.js`という素のJavaScript実装が残っており、Reactが何を肩代わりしてくれているかを対比できます。

```javascript
// prototype/app.js（Reactを使わない場合の一例のイメージ）
const card = document.createElement('div')
card.className = 'card'
card.textContent = title
column.appendChild(card)
// カードが増減するたびに、どのDOM要素を足す/消すかを自分で管理する必要がある
```

対して、本プロジェクトの`components/CardItem.tsx`は、DOM操作を一切書きません。

```typescript
function CardItem({ card, onSelect }: Props) {
  return (
    <button type="button" onClick={() => onSelect(card.id)} /* ... */>
      <p className="text-sm font-medium text-slate-800">{card.title}</p>
      {/* ... */}
    </button>
  )
}
```

`CardItem`は「`card`というデータが与えられたら、こういう見た目のボタンになる」という**関数**でしかありません。カード一覧が増えたり減ったりしたとき、どのDOM要素をどう足す・消す・並べ替えるかは、一切書いていません。Reactが裏側で「前回の描画結果」と「今回の描画結果」を比較し（この比較・差分検出の仕組みを**仮想DOM**と呼びます）、実際に変わった部分だけを本物のDOM（ブラウザが管理する画面の要素）に反映します。

> **JavaScriptとの対比**
> `prototype/app.js`のような素のDOM操作を**命令的（imperative）**なスタイルと呼びます。「何をどういう手順で操作するか」を1つずつ命令する書き方です。Reactの**宣言的（declarative）**なスタイルは、「今の状態がこうなら、画面はこう見えるべきだ」という結果だけを書き、手順はReactに任せます。jQueryや素のDOM APIの経験がある方ほど、「要素を直接操作しない」という感覚に最初は戸惑うかもしれませんが、[7章](../react/03-state-effect.md#7-stateとusestate)で扱う`state`の概念とあわせて理解すると、Reactらしい書き方が掴みやすくなります。

### コンポーネントという単位

Reactアプリは、`CardItem`のような**コンポーネント**（画面の部品を表す関数）を組み合わせて作ります。本プロジェクトのファイル構成そのものが、コンポーネントによる分割を表しています。

```
src/
├── components/   ← 再利用可能な部品（LabelChip・CardItem・StatusColumnなど）
├── pages/        ← 1つの画面に対応する部品（CrossBoardView・BoardDetailViewなど）
├── hooks/        ← 複数のコンポーネントで再利用するロジック（3章で扱う）
├── lib/          ← Reactに依存しない純粋なロジック（データ加工・判定関数）
├── api/          ← バックエンドとの通信
└── types/        ← 型定義
```

コンポーネントの詳しい書き方（JSX）は[3章](./02-component-jsx.md#3-コンポーネントとjsx)で扱います。

---

## 2. アプリの起動と全体構成

Reactアプリが画面に表示されるまでの流れを、実際のファイルを1つずつ追って解説します。

### ① `index.html`：土台になるHTML

```html
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
```

`<div id="root"></div>`だけが最初から用意されたHTMLで、それ以外の画面はすべてJavaScript（React）が組み立てます。このように最初はほぼ空のHTMLを配り、あとはJavaScriptで画面を構築する形式のアプリを**SPA（Single Page Application）**と呼びます。

### ② `main.tsx`：Reactを起動するエントリーポイント

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

- `createRoot(document.getElementById('root')!)`：①の`<div id="root">`をReactの管理下に置きます（`!`の意味は[docs/typescript 10章](../typescript/04-narrowing.md#10-型アサーションassatisfies)を参照）。
- `.render(<StrictMode>...)`：その中に、最上位のコンポーネント`App`を描画します。
- `<BrowserRouter>`：[5章](./05-router.md#13-react-routerの基本)で扱うReact Routerの機能を、配下のどのコンポーネントからでも使えるようにするための土台です。
- `<StrictMode>`：本番ビルドには影響しない、開発時専用の検査モードです。[docs/react 8章](./03-state-effect.md#8-useeffectと副作用クリーンアップ)で扱う`useEffect`のクリーンアップが正しく書けているかを、意図的な二重実行によって検査してくれます。

### ③ `App.tsx`：共通レイアウトとルーティング

```typescript
function App() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-300 bg-white px-6 py-4 shadow-sm">
        <h1 className="text-xl font-bold">タスク管理アプリ</h1>
        <div className="mt-3 flex items-center gap-2">
          <BoardSelect />
          {/* ... */}
        </div>
      </header>

      <main className="p-6">
        <Routes>
          <Route path="/" element={<CrossBoardView />} />
          <Route path="/boards/:boardId" element={<BoardDetailView />} />
          <Route path="/search" element={<SearchView />} />
        </Routes>
      </main>
    </div>
  )
}
```

`App`は「ヘッダー（常に表示）＋ URLに応じて切り替わる本文（`<Routes>`）」という、アプリ全体の外枠（シェル）を定義しています。ヘッダーの`<BoardSelect />`は`<Routes>`の**外側**にあるため、画面（横断ビュー⇔ボード詳細）が切り替わってもアンマウントされません。この設計の意図は[docs/react 15章](./06-component-design.md#15-コンポーネント設計と状態の持ち方)で詳しく扱います。ルーティングの仕組み自体（`<Routes>`・`<Route>`・`path="/boards/:boardId"`）は[docs/react 13章](./05-router.md#13-react-routerの基本)で扱います。

### 起動の全体像

```
index.html（空のdiv#root）
  → main.tsx（createRootでReactを起動、BrowserRouterとStrictModeで包む）
    → App.tsx（ヘッダー＋現在のURLに応じたページ）
      → CrossBoardView / BoardDetailView / SearchView（pages/）
        → StatusColumn・CardItem・LabelChip...（components/）
```

> **Javaとの対比**
> [docs/spring-boot 4章](../spring-boot/01-architecture.md#4-アプリケーションの起動の仕組み)で見た「`@SpringBootApplication`が付いたクラスの`main()`を実行すると、コンポーネントスキャン・自動構成が走る」という起動の仕組みと対応させると理解しやすくなります。Spring Bootが「アノテーションを目印にBeanを自動的に集めてIoCコンテナに登録する」のに対し、Reactは「`main.tsx`から`App`、`App`から個々のコンポーネントへと、**コードの中で明示的に呼び出しをつないでいく**」という違いがあります。ReactにはSpring BootのDIコンテナのような「勝手に見つけて配線してくれる」仕組みは無く、どのコンポーネントがどのコンポーネントを使うかは、常にimport文とJSXの中に明示的に書かれています。
