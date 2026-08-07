# ネイティブ`<dialog>`とモーダルのアクセシビリティ

[← React学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **34章** をまとめています。

---

## 34. ネイティブ`<dialog>`とモーダルのアクセシビリティ

`CardDetailModal`・`BoardManageModal`は、当初どちらも`<div>`だけで組み立てられていました。

```typescript
// 以前の構造
<div className="fixed inset-0 z-50 ... bg-slate-900/50" onClick={背景クリックで閉じる}>
  <div role="dialog" aria-modal="true" aria-label="カード詳細">
    {/* 中身 */}
  </div>
</div>
```

見た目のうえでは正しく動きますが、[33章](./07-build-tooling.md#33-oxlintの設定強化)で導入したoxlintの`jsx-a11y`プラグインは、この構造に対して2つのモーダル合計で6件の警告を出していました。

| ルール | 指摘の内容 |
| --- | --- |
| `click-events-have-key-events` | クリックできる要素に、キーボード操作の代替が無い |
| `no-static-element-interactions` | ただの`<div>`にクリックハンドラが付いている（役割が不明） |
| `prefer-tag-over-role` | `role="dialog"`を書くくらいなら`<dialog>`要素を使うべき |

加えて、警告としては現れないもののより深刻な問題がありました。**フォーカストラップがない**ことです。モーダルが開いている間もTabキーで背景側の要素（ヘッダーのボタンや、下に隠れているカード）へフォーカスが移動してしまい、キーボードだけで操作している人にとっては「どこを触っているのか分からない」状態になります。

### 自前で実装するか、ブラウザに任せるか

フォーカストラップを自前で書くこともできます。モーダル内のフォーカス可能な要素を列挙し、最後の要素でTabが押されたら最初へ戻し、最初の要素でShift+Tabが押されたら最後へ送る——という処理です。しかしこれは、**ブラウザが既に持っている機能を書き直す**ことに他なりません。

HTMLの`<dialog>`要素を`showModal()`で開くと、次のすべてがブラウザの責任で行われます。

- **フォーカストラップ**：Tabキーによる移動がダイアログ内に閉じ込められる
- **背景の不活性化**：ダイアログ外の要素が`inert`（クリックもフォーカスも受け付けない状態）になる
- **Escapeキーでの閉じる操作**：`cancel`イベントが発火する
- **暗黙のロール**：`role="dialog"`と`aria-modal="true"`が自動的に付与される
- **`::backdrop`疑似要素**：背景の暗幕を、自前のオーバーレイ用`<div>`なしで描画できる
- **トップレイヤー**：`z-index`の値に関係なく、常に最前面へ描画される

本プロジェクトではこちらを選びました。自前のコードが減るうえに、支援技術（スクリーンリーダー等）から見た振る舞いも、ブラウザが標準として実装しているものに揃います。

### `open`属性ではなく`showModal()`を呼ぶ

ここが`<dialog>`最大の落とし穴です。`<dialog>`には`open`という属性があり、JSXでは次のように書きたくなります。

```typescript
// これは「モーダルではないダイアログ」になってしまう
<dialog open={isOpen}>
```

`open`属性で開いた`<dialog>`は**非モーダル**（non-modal）として扱われます。見た目は表示されますが、前節に挙げた6つの機能——フォーカストラップも、背景の不活性化も、`::backdrop`も、トップレイヤーも——**どれも働きません**。これらが有効になるのは、JavaScriptから`showModal()`メソッドを呼んだときだけです。

`showModal()`は、Reactの「状態を書けば描画が追従する」という宣言的なやり方とは対照的な、**命令的なDOM API**です。そのため、描画が終わった後に実行される`useEffect`（[8章](./03-state-effect.md#8-useeffectと副作用クリーンアップ)）の中から、`useRef`（[20章](./08-form-and-mutation.md#20-userefとdomへの直接アクセス)）で掴んだDOM要素に対して呼びます。

```typescript
const dialogRef = useRef<HTMLDialogElement>(null)

useEffect(() => {
  if (cardId === null) return
  const dialog = dialogRef.current
  if (dialog === null) return

  dialog.showModal()

  return () => {
    dialog.close()
  }
}, [cardId])
```

クリーンアップで`close()`を呼んでいるのは、`showModal()`で開いた`<dialog>`がブラウザのトップレイヤーに**登録される**ためです。閉じる手続きを踏まないまま要素だけがDOMから消えると、その登録の解除や、「ダイアログを開く前にフォーカスがあった要素へ戻す」という後始末が行われません。「開いたら閉じる」を対にしておくのは、[8章](./03-state-effect.md#8-useeffectと副作用クリーンアップ)で見たイベントリスナーの`addEventListener`／`removeEventListener`とまったく同じ考え方です。

### Escapeキー：`cancel`イベントを`preventDefault()`で止める

以前は、両モーダルとも`document`に`keydown`リスナーを登録して自前でEscapeを拾っていました。`showModal()`を使う今、この処理は不要になります——が、**そのまま任せきりにはできません**。

ブラウザがEscapeに対して行う既定の動作は「DOM上で`<dialog>`を閉じる」ことだけです。一方、このモーダルが開いているかどうかを決めているのは、親コンポーネントが持つReactのstate（`selectedCardId`や`boardManageOpen`）です。既定動作をそのまま通すと、**DOMは閉じたのにReactはまだ開いているつもり**という食い違いが起き、同じカードをもう一度開こうとしても何も起こらなくなります。

そこで、`cancel`イベントで既定動作を止め、必ずReact側の経路（`onClose()`）から閉じます。

```typescript
function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
  event.preventDefault()
  onClose()
}
```

```typescript
<dialog ref={dialogRef} onCancel={handleCancel} aria-label="カード詳細">
```

`BoardManageModal`では、この`handleCancel`が[29章](./10-board-management.md#29-インライン改名編集とescapeの競合)で扱った分岐をそのまま引き継ぎます。

```typescript
function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
  event.preventDefault()
  if (renamingBoardId !== null) {
    setRenamingBoardId(null)  // 改名編集中のEscapeは「編集キャンセル」を優先
  } else {
    onClose()
  }
}
```

**判断のロジックは1文字も変わっていません**。変わったのは「Escapeが押されたことをどこから知るか」だけで、`document`のキーイベントを自前で監視する代わりに、ブラウザが`<dialog>`に届けてくれる`cancel`イベントを受け取る形になりました。29章で「documentに1箇所だけリスナーを置き、編集中かどうかで分岐する」と説明した設計判断は、そのまま生きています。

### 既定スタイルの打ち消しと`::backdrop`

`<dialog>`はブラウザ既定のスタイル（中央寄せの`margin: auto`、`border`、`padding`、`max-width`／`max-height`）を持つため、オーバーレイとして使うにはこれらを打ち消す必要があります。

```typescript
className="m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto border-0 bg-transparent p-0 backdrop:bg-slate-900/50"
```

注目したいのは最後の`backdrop:bg-slate-900/50`です。Tailwind CSSの`backdrop:`バリアントは`::backdrop`疑似要素にスタイルを当てるもので、これによって**背景の暗幕を描くためだけの`<div>`が不要**になりました。以前の`bg-slate-900/50`は自前のオーバーレイ`<div>`に付けていたものです。

`z-50`が消えたことにも意味があります。トップレイヤーへ載る`<dialog>`は`z-index`の積み重ね順とは無関係に最前面へ描かれるため、「他の要素より大きな`z-index`を指定する」という管理そのものが要らなくなります。

### それでも`role="presentation"`が残っている理由

背景（白いカードの外側）のクリックで閉じる機能は、`<dialog>`にしても引き続き自前のハンドラが必要です。この判定用の`<div>`には`role="presentation"`を付けています。

```typescript
<div
  role="presentation"
  className="flex min-h-full items-start justify-center p-4 sm:p-8"
  onClick={(event) => {
    if (event.target === event.currentTarget) onClose()
  }}
>
```

`role="presentation"`は「**この要素自体に固有の意味は無く、レイアウトとクリック判定のためだけに存在する**」ことを支援技術へ明示するものです。これを書かないと、oxlintは「意味のない`<div>`にクリックハンドラが付いている」として`no-static-element-interactions`を報告します。

「クリックできるのにキーボードで操作できないのでは？」という疑問は当然ですが、ここでの答えは「**この要素をキーボード操作可能にする必要はない**」です。モーダルを閉じる手段は、Escapeキー（ブラウザが処理）とヘッダーの`×`ボタン（`<button>`なのでTabで到達できる）という2つが既に用意されており、背景クリックはあくまでマウス利用者向けの補助的な近道にすぎません。**すべてのクリック領域をフォーカス可能にするのが正解なのではなく、その機能に到達する経路がキーボードからも別途あればよい**、という考え方です。

なお、`onClick`を`<div>`ではなく`<dialog>`自身に付ける書き方も試しましたが、oxlintは`<dialog>`を「非インタラクティブ要素」と判定して同種の警告を出しました（`no-noninteractive-element-interactions`）。実装としてはどちらでも正しく動きますが、警告を抑制コメントで黙らせるより、`role="presentation"`で意図を明示するほうが読み手にも支援技術にも伝わるため、こちらを選んでいます。

### 結果

この置き換えにより、`jsx-a11y`の警告6件はすべて解消し、同時に自前では実装していなかったフォーカストラップと背景の不活性化が手に入りました。**「警告を消すために書き足す」のではなく、「ブラウザに任せられる部分を任せた結果として警告も消えた」**という順序になっているのが、この対応のいちばんの要点です。

---

## 36. ARIAタブパターンによるモバイル向けステータス切り替え

スマートフォン幅（768px未満）では、「未着手／作業中／完了」の3列カンバンを横に並べる余白が無いため、`components/MobileStatusTabs.tsx`が画面上部にタブボタンを表示し、選択中の1列だけを`components/StatusColumn.tsx`（`isActiveOnMobile`プロパティ）が表示する、という要件8.1向けのUIを追加しました。ここで使った`role="tablist"`/`role="tab"`/`aria-selected`は、本プロジェクトで初めて登場するARIAの複合ウィジェットパターンです。

```typescript
<div className="mb-4 flex gap-1.5 md:hidden" role="tablist" aria-label="ステータス切り替え">
  {STATUSES.map((status) => (
    <button
      key={status}
      type="button"
      role="tab"
      aria-selected={status === activeStatus}
      onClick={() => onSelect(status)}
    >
      {STATUS_LABELS[status]} ({countsByStatus[status]})
    </button>
  ))}
</div>
```

### なぜ`aria-pressed`ではなく`role="tablist"`/`"tab"`なのか

このコードベースには、選択状態を持つボタンの前例として[`LabelToggleChip.tsx`](../../frontend/src/components/LabelToggleChip.tsx)（検索画面のラベル絞り込み、カード作成フォームのラベル選択）がすでにあり、そちらは`aria-pressed`を使っています。今回同じ`aria-pressed`を使わなかったのは、2つのUIが表している「選択」の性質が違うためです。

| | `LabelToggleChip`（`aria-pressed`） | `MobileStatusTabs`（`role="tab"` / `aria-selected`） |
| --- | --- | --- |
| 選択できる数 | 0個〜複数個（独立したON/OFF） | 常にちょうど1個（排他的） |
| ボタン同士の関係 | 互いに無関係 | 「同じグループの中のどれか1つ」という関係がある |
| 対応するARIAの概念 | トグルボタン（単体で完結） | タブ（`tablist`という親子関係を持つ複合ウィジェット） |

`aria-pressed`はボタン1個だけで意味が完結する属性で、「他のボタンが何個押されているか」を考慮しません。一方`MobileStatusTabs`は「未着手・作業中・完了のうち今どれを見ているか」という、3つがひとまとまりで初めて意味を持つ状態を表しています。この「ひとまとまりの中の排他選択」という関係そのものを支援技術に伝えるのが`role="tablist"`（親：これは選択肢のグループだ）と`role="tab"`＋`aria-selected`（子：この選択肢が今選ばれているか）の役割です。

### あえて実装しなかったもの：roving tabindexと矢印キー操作

WAI-ARIAの定める本来のタブパターン（APGのTab Panelパターン）は、キーボード操作についてもう一段踏み込んだ作り込みを求めます。選択中のタブだけを通常のTab移動の対象にし（`tabindex="0"`）、それ以外は`tabindex="-1"`で通常のTab移動から外したうえで、フォーカスが当たっている状態で矢印キーを押すとタブ間でフォーカスと選択が同時に動く「roving tabindex」という仕組みです。

`MobileStatusTabs`ではこれを実装していません。3つのボタンはどれも普通の`<button>`のままなので、Tabキーで1つずつフォーカスでき、Enter/Spaceキーでクリックと同じ選択操作ができます。キーボードだけで操作できるという要件そのものは、roving tabindexが無くても満たされています。[`LabelToggleChip.tsx`](../../frontend/src/components/LabelToggleChip.tsx)も同様に矢印キー操作までは実装しておらず、本プロジェクトは複合ウィジェットのフルスペック実装よりも「素朴な`<button>`の集まりとして、必要十分なキーボード操作性を確保する」という簡略化を一貫して選んでいます。

### あえて付けなかった`role="tabpanel"`

本来のタブパターンでは、`role="tab"`と対になる`role="tabpanel"`（今選ばれているタブに対応する中身）もセットで使います。今回、この`role`は`StatusColumn`には付けていません。

理由は画面幅によって意味が変わってしまうためです。`role="tabpanel"`は「選択中のタブに対応するパネルが1つだけ表示されている」ことを前提にした役割ですが、`StatusColumn`は768px以上では3列とも同時に表示され続けます（[17章](./07-build-tooling.md#17-tailwind-cssの読み方)の`md:`修飾子の通り、`MobileStatusTabs`自体も`md:hidden`でこの幅では消えます）。768px未満でだけ真になる性質を、幅に関わらず常に付いているかのような`role`として書いてしまうと、PC幅で見ている支援技術のユーザーに対して実態と異なる情報を伝えることになります。「CSSで見た目上は1列に絞り込んでいても、ARIAのroleとしてそう言い切れるわけではない」場面もある、という一例です。

### 結果

`role="tablist"`/`"tab"`/`aria-selected`により、「未着手・作業中・完了という3択のうち、今どれを見ているか」という状態がスクリーンリーダー等の支援技術にも正しく伝わるようになりました。一方で、roving tabindexや`role="tabpanel"`まで含めたAPGパターンのフルスペック実装は行わず、既存の`LabelToggleChip.tsx`と同じ水準（ネイティブな`<button>`の持つキーボード操作性に乗る）に揃えています。どこまで作り込むかは、機能的に必要な水準と実装コストを見比べて決める判断であり、本プロジェクトでは一貫して「ブラウザ・HTMLが標準で持っている機能に乗れる部分は乗る」（[34章](#34-ネイティブdialogとモーダルのアクセシビリティ)のフォーカストラップと同じ考え方）を優先しています。

---

[← React学習ドキュメントトップへ戻る](./README.md)
