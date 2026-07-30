# コンポーネント設計と状態の持ち方

[← React学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **15章** をまとめています。

---

## 15. コンポーネント設計と状態の持ち方

これまでの章では個々のフックや構文を教材ごとに見てきましたが、本章では視点を変え、「コンポーネントをどう分割し、状態をどこに持たせるか」という設計判断そのものを扱います。[docs/spring-boot 1〜2章](../spring-boot/01-architecture.md#2-レイヤードアーキテクチャ)がController・Service・Repositoryという層に分ける理由を扱ったのと対応する、フロントエンド側の設計章です。

### 状態は「それを必要とする最小のコンポーネント」に置く

`App.tsx`のヘッダーにある`<BoardSelect />`は、`<Routes>`の**外側**に置かれています。

```typescript
<header>
  <BoardSelect />
  {/* ... */}
</header>

<main className="p-6">
  <Routes>
    <Route path="/" element={<CrossBoardView />} />
    <Route path="/boards/:boardId" element={<BoardDetailView />} />
    <Route path="/search" element={<SearchView />} />
  </Routes>
</main>
```

`BoardSelect`のコメントが、この配置の意図を説明しています。

```typescript
// App.tsxのヘッダー（<Routes>の外側）に置いている。画面（横断ビュー⇔ボード詳細）を
// 切り替えてもこのコンポーネント自体はアンマウントされないため、ボード一覧の
// 再取得も選択状態のちらつきも起きない。ページ側に置くと、遷移のたびに
// アンマウント→再マウントが起きて毎回 GET /api/boards を叩き直すことになる。
```

`<Routes>`の**内側**にあるコンポーネント（`CrossBoardView`など）は、URLが変わって別の`<Route>`に一致するたびに**アンマウント**（画面から取り除かれ、内部のstateもろとも破棄）されます。もし`BoardSelect`を各ページコンポーネントの内部に置いていたら、画面を切り替えるたびに`BoardSelect`も作り直され、[docs/react 8章](./03-state-effect.md#8-useeffectと副作用クリーンアップ)の`useEffect`（＝内部で使っている`useApi`）が再実行され、`GET /api/boards`が毎回発生してしまいます。「複数の画面をまたいで表示され続けるものは、`<Routes>`の外側に置く」という配置そのものが、無駄な再取得を防ぐ設計になっています。

### 描画のロジックをコンポーネント化しない：`renderContent()`

`pages/CrossBoardView.tsx`・`pages/BoardDetailView.tsx`・`pages/SearchView.tsx`は、いずれも本文の組み立てを`renderContent()`という**ただの関数**として定義し、JSXの中で`{renderContent()}`のように**呼び出して**います。コメントに、あえて`<RenderContent />`という別コンポーネントにしなかった理由が書かれています。

```typescript
// これは <RenderContent /> のようなコンポーネントとしてではなく、ただの関数として
// 呼び出している（JSXの中で renderContent() のように呼ぶ）。コンポーネントとして
// 呼び出す形（<RenderContent />）にすると、Reactが毎レンダリングで「別の型の
// コンポーネント」と見なして中身を作り直してしまう（内部にstateがあれば消える）。
```

これは初学者が引っかかりやすい落とし穴です。`renderContent`を`<RenderContent />`という別コンポーネントとして定義し直すと、コード自体は動きますが、Reactは`CrossBoardView`が再描画されるたびに`RenderContent`を「新しく登場したコンポーネント」として扱い、前回の描画結果を再利用しません（もし`RenderContent`の内部にstateを持たせていれば、再描画のたびにリセットされてしまいます）。関数として定義し`{renderContent()}`のように**その場で呼ぶ**だけであれば、これは「JSXを組み立てるための普通のTypeScript関数呼び出し」に過ぎず、コンポーネントのライフサイクル（マウント・アンマウント）とは無関係になります。「見た目はコンポーネントっぽいが、実際はただの関数」という区別は、名前だけでは判断できません。**JSXタグ（`<Foo />`）として呼ぶか、普通の関数呼び出し（`foo()`）として呼ぶか**という書き方の違いこそが、Reactにとっての本質的な違いです。

### 似ているが別のコンポーネントに分ける：`CardItem`と`SearchResultItem`

`components/CardItem.tsx`と`components/SearchResultItem.tsx`は、どちらも「1件のカードを表示するクリック可能な要素」という点でよく似ています。しかし本プロジェクトはこれを1つのコンポーネントにまとめず、あえて2つに分けています。理由は`SearchResultItem`のコメントに書かれています。

```typescript
// components/CardItem.tsxと役割は近いが、検索結果は横断ビュー・ボード詳細のように
// 「どのボード・どの列を見ているか」という前後関係が無いため、行の中に
// 「ボード名 / ステータス」を明示する点が異なる（CardItemはその文脈が既に外側の
// 列・セクションで表現されているため省略している）。この差のためにコンポーネントを分けた。
```

`CardItem`は「未着手／作業中／完了」の列（[docs/react 4章](./02-component-jsx.md#4-propsと型付け)の`StatusColumn`）の中に置かれるため、そのカードがどのステータスかは、外側の見出しがすでに表現しています。一方`SearchResultItem`は検索結果の一覧という、そうした前後関係の無い場所に置かれるため、カード自身に「ボード名 / ステータス」を明記する必要があります。**見た目が似ているというだけで無理に共通化せず、「表示される文脈が違う」という本質的な違いがあるものは、あえて別のコンポーネントとして分ける**という判断です。共通化（1つのコンポーネントに`showContext`のようなpropsを追加して出し分ける）もできなくはありませんが、条件分岐が増えるほどコンポーネントの見通しは悪くなります。今回は2つの小さなコンポーネントに分ける方を選んでいます（実際に見た目が完全に共通な部分は、[docs/react 4章](./02-component-jsx.md#4-propsと型付け)の`StatusMessage`のように別途切り出されています）。

### データ取得はコンポーネントごとに独立させる——が、それが崩れたとき

`components/LabelFilterBar.tsx`は、`components/BoardSelect.tsx`とまったく同じ`GET /api/boards`を、独立してもう一度呼び出しています。

```typescript
// ボード一覧はこのコンポーネント自身が取得する（components/BoardSelect.tsxも同じ
// GET /api/boardsを独立して呼んでいる）。このプロジェクトはまだコンポーネント間で
// データを共有する仕組み（Contextなど）を持っておらず、「必要なコンポーネントが
// それぞれ自分で取りに行く」という既存方針をここでも踏襲している
// （3ボード程度の小さな一覧を1回多く取得するコストは無視できる）。
```

これは今も`LabelFilterBar`（検索画面のラベル絞り込みUI）については変わらない方針です。しかし`BoardSelect`自身は、ボード管理モーダル（`BoardManageModal`）の追加にともない、この方針から外れることになりました。

**何が変わったか**：ボード管理モーダルでボードを新規作成したとき、その結果はヘッダーのセレクトボックス（`BoardSelect`）の選択肢にも反映される必要があります（要件5.1）。`BoardSelect`が独立して`useApi(apiPaths.boards())`を呼び続ける方針のままでは、モーダル側の変更をセレクトボックスへ伝える手段がありません。「必要なコンポーネントがそれぞれ独立して取りに行く」という方針は、**取得するだけ**（Read）のコンポーネントが複数あるだけなら問題になりませんが、**一方が書き込みを行い、その結果をもう一方が知る必要がある**（Write→Read）関係が生まれた時点で成立しなくなります。

**採った対応**：ボード一覧の取得を、共通の親である`App.tsx`へ引き上げました（リフトアップ）。

```typescript
// App.tsx
const { data: boards, loading, error, refetch: refetchBoards } = useApi<BoardResponse[]>(apiPaths.boards())
// BoardSelectへはpropsとして渡し、BoardManageModalへはrefetchBoardsをonCreatedとして渡す
```

`BoardSelect`は「自分でデータを取りに行くコンポーネント」から「propsで渡された値を表示するだけのコンポーネント」に変わりました。詳しい経緯は[08-form-and-mutation.md 19章](./08-form-and-mutation.md#19-書き込みpostとデータの更新)を参照してください。

**Contextには飛びつかなかった**：Reactには、離れたコンポーネント同士でデータを共有する**Context**という仕組みがありますが、今回もまだ採用していません。ボード一覧を必要とするコンポーネントは`BoardSelect`と`BoardManageModal`の2つだけであり、共通の親から2つへpropsで配るだけで、コードの見通しは十分に保てます。Contextを持ち込むと、「この値はどこから来るのか」を`useContext`の呼び出し元だけを見ても追えなくなり（Providerの位置まで遡る必要がある）、消費者が少ない今の規模では見合わないコストです。「独立した取得」が成立しなくなったからといって、次の手が必ずContextとは限りません——**まず親へのリフトアップで足りないか**を検討し、それでも足りなくなったとき（消費者がさらに増える、あるいは画面をまたいで深くネストする、など）に初めてContextを検討する、という順序で判断しています。

### この章のまとめ：判断基準の一覧

| 判断 | 基準 | 例 |
| --- | --- | --- |
| stateやコンポーネントをどこに置くか | 複数の画面をまたいで生き続けてほしいものは、`<Routes>`の外側に置く | `BoardSelect` |
| 関数をコンポーネント化するか | JSXタグとして呼ぶ（マウント・アンマウントの対象にしたい）のでなければ、ただの関数のままにする | `renderContent()` |
| コンポーネントを共通化するか分けるか | 見た目が似ていても、表示される文脈（前後関係）が異なるなら分ける | `CardItem` / `SearchResultItem` |
| データをどこで取得するか | 取得するだけの関係が続く間は、必要なコンポーネントがそれぞれ独立して取得する。一方の書き込みを他方が知る必要が生まれたら、共通の親へリフトアップする | `LabelFilterBar`（独立）／ `BoardSelect`・`BoardManageModal`（`App.tsx`へリフトアップ、[19章](./08-form-and-mutation.md#19-書き込みpostとデータの更新)） |

これらはいずれも「絶対唯一の正解」ではなく、本プロジェクトの現在の規模・要件のもとでの判断です。実装が進み前提が変われば、見直される可能性があります（[README.mdの更新ルール](./README.md#このドキュメントの更新ルール)を参照）。
