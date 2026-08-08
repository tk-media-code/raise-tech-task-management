# ネイティブ`<dialog>`とモーダルのアクセシビリティ

[← React学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **34章・36章・38章** をまとめています。

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

## 38. 共通の確認ダイアログ——`window.confirm`をやめてネイティブ`<dialog>`に寄せる

[30章](./10-board-management.md#30-削除とkeyによる再マウント)（ボード削除）と[31章](./11-card-deletion.md#31-2つ目の削除機能usedeleteとwindowconfirmの再利用)（カードの完全削除）は、どちらも確認手段に`window.confirm()`を選んでいました。この判断を覆し、共通コンポーネント[`ConfirmDialog.tsx`](../../frontend/src/components/ConfirmDialog.tsx)へ置き換えたのがこの章です。

### きっかけ：確認が出ないまま削除される

「アーカイブ一覧で完全削除を押すと、確認が出ずにいきなり消える」という報告が出発点でした。ところがコードを見ると`window.confirm()`は書かれたままです。ボード削除でも同じく確認が出ないという話だったので、2箇所が同時に効かない以上、原因は個別のコンポーネントではなく**ブラウザ側で標準ダイアログが抑制されていること**（Chromeなら「このページでこれ以上ダイアログを作成しない」のチェック）にあります。

ここが`window.confirm()`の構造的な弱点です。抑制された状態の`window.confirm()`は、ダイアログを出さずに即座に`false`を返します。**アプリ側からは、それが「ユーザーがキャンセルを押した」のか「そもそも表示されなかった」のかを区別できません**。検知もできなければ回避もできない。取り消せない操作の最後の砦を、ユーザーが無自覚に無効化できてしまう機能に預けていたことが問題でした。

30章は「開閉状態の管理・背景クリックの判定・フォーカストラップ・Escapeキーの処理を一切自作せずに済む」ことを理由に`window.confirm()`を選んでいました。この理由づけ自体は今も正しいのですが、そこには「標準ダイアログは必ず表示される」という前提が暗黙に置かれていました。崩れたのはその前提のほうです。

そして[34章](#34-ネイティブdialogとモーダルのアクセシビリティ)でネイティブ`<dialog>`を導入したことにより、30章が挙げていた4つの手間は`showModal()`がほぼ肩代わりしてくれるようになっていました。「自作を避けたい」という当初の動機が、そもそも大きく目減りしていたわけです。

### 共通部品の線引き：どこまでをダイアログの仕事にするか

置き換え先は2箇所（ボード削除・カードの完全削除）あり、両者には無視できない差があります。

| | カードの完全削除 | ボードの削除 |
| --- | --- | --- |
| 本文 | 最初から確定している | 開いた後、GET 2本で件数を数えてから確定する |
| 巻き込まれるもの | このカード1枚だけ | 所属カード全部とラベル |

この差を吸収するために、**本文を`children: ReactNode`で受ける**設計にしました。

```tsx
<ConfirmDialog open={confirmOpen} title="カードの完全削除" confirmLabel="完全に削除する" …>
  <p>「{card.title}」をアーカイブから完全に削除します。</p>
  <p>この操作は取り消せません。よろしいですか？</p>
</ConfirmDialog>
```

`message: string`に加えて`loading: boolean`や`count: number | null`をpropsに並べる作り方もありますが、そうするとこの部品は「汎用の確認ダイアログ」ではなく「削除確認専用の何か」に狭まります。何を確認させたいかを知っているのは呼び出し側なので、文言の組み立ては向こうに残し、ダイアログは「開閉・ボタン・実行中/エラーの見せ方」だけを引き受ける。[`StatusMessage.tsx`](../../frontend/src/components/StatusMessage.tsx)が`children`で本文を受けているのと同じ線引きです。

同じ理由で、**削除処理そのもの（`useDelete`）もダイアログの中には入れていません**。`useDelete`は呼ばれた時点でパスを固定するフックで、「削除できる行ごとに1つ持つ」ことが設計の前提でした（[31章](./11-card-deletion.md#31-2つ目の削除機能usedeleteとwindowconfirmの再利用)）。ダイアログ側に持たせるとパスをpropsで渡すことになり、その前提が部品の外へ漏れ出します。代わりに`submitting`と`error`を受け取り、実行ボタンが押されたら`onConfirm`を呼び返すだけにしました。

### `<dialog>`の入れ子

いちばん厄介だったのがここです。ボード削除の行（`SortableBoardRow`）は`BoardManageModal`——**すでに`showModal()`で開いている`<dialog>`**——の中で描画されます。つまりボード削除の確認をネイティブ`<dialog>`にすると、モーダルの入れ子になります。

[37章](./11-card-deletion.md#37-3つ目の削除機能確認手段をあえてwindowconfirmにしない)でラベル削除がネイティブ`<dialog>`を見送った唯一の理由も、まさにこれでした。今回は避けずに確かめることにしました。

HTML仕様の側は、実のところ何も問題がありません。`showModal()`で開いた`<dialog>`は**トップレイヤー**という特別な描画層に積まれ、後から開いたものが必ず前面に来ます。そしてEscapeキー（仕様上は「close request」）を受け取るのは**最前面のダイアログだけ**です。つまり仕様どおりに動けば「Escapeで確認だけが閉じ、ボード管理モーダルは開いたまま」という、まさに望ましい挙動になります。

問題はReact側にありました。

```tsx
// この1行が無いと、確認ダイアログでEscapeを押しただけで
// BoardManageModalのonCancelまで動いてしまう
event.stopPropagation()
```

ネイティブの`cancel`イベントは**バブルしません**（`bubbles: false`）。素のDOMなら、内側のダイアログで起きた`cancel`が外側の`<dialog>`に届くことはありません。ところが**Reactは、バブルしないイベントも合成イベントとしてReactツリーの祖先へ配り直します**。Reactがtarget限定で扱うのは`scroll`だけで、`cancel`はその例外に入っていないためです。

実際に、`stopPropagation()`を外した状態でテストを走らせると、外側の`onCancel`が呼ばれることを確認できます。

```
✓ 実行中はEscape（cancelイベント）で閉じない
× 入れ子で使っても、Escapeが外側の<dialog>のonCancelへ伝わらない
    → expect(onParentCancel).not.toHaveBeenCalled()
       Number of calls: 1
```

これを止めないと、確認ダイアログでEscapeを押しただけで`BoardManageModal`の`handleCancel`（[29章](./10-board-management.md#29-インライン改名編集とescapeの競合)の分岐）まで動き、ボード管理モーダルごと閉じます。別の行を改名編集中だった場合は、その編集が巻き添えでキャンセルされます。

対処は`stopPropagation()`の1行ですが、**この1行は消しても型チェックもlintも通ってしまいます**。だから[`ConfirmDialog.test.tsx`](../../frontend/src/components/ConfirmDialog.test.tsx)に、外側の`<dialog onCancel>`の中にレンダリングして`cancel`を投げる回帰テストを置いてあります。上のログは、そのテストがちゃんと働くことを確かめたときのものです。

入れ子について、残りの判断も書いておきます。

- **`::backdrop`が二重に掛かる**：親モーダルの暗幕（50%）の上にさらに確認の暗幕が重なり、背景は約75%まで暗くなります。これは**許容**しました。「親モーダルも一段暗転して、この確認が最前面にある」ことはむしろ伝えたい情報ですし、入れ子かどうかで暗さの語彙を変えるほうが不統一です。
- **背景クリック判定は壊れない**：[34章](#34-ネイティブdialogとモーダルのアクセシビリティ)で`stopPropagation()`ではなく`event.target === event.currentTarget`の一致を選んでいたことが、ここで効きます。確認ダイアログ内のクリックはDOM上は外側の`role="presentation"`まで伝わりますが、そのとき`target`は内側の要素なので一致せず、親モーダルは閉じません。伝播そのものを止める方式だったら、こういう入れ子で何が起きるかを毎回考える羽目になっていました。
- **フォーカスの戻し先**：`close()`を呼べばブラウザがフォーカスを開く前の要素に戻してくれる——のは、`<dialog>`がまだDOMに繋がっている場合の話です。このコンポーネントは`open`が`false`になると`null`を返してアンマウントされ、クリーンアップが走る時点では要素がすでに外れているため、ブラウザの復帰処理は働かずフォーカスが`<body>`へ落ちます。単独のモーダルなら大した問題ではありませんが、入れ子だと「親モーダルは開いたままなのにフォーカスだけ迷子」になります。そこで開く直前に`document.activeElement`を控え、クリーンアップで`isConnected`を確認してから戻しています（削除に成功して元の行ごと消えている場合があるため、この確認が要ります）。

### 確認メッセージが後から確定する

ボード削除では、巻き込まれて消えるカードの件数を2本のGETで数えてから見せます。`window.confirm()`は同期APIなので、以前は**先に件数を`await`してから確認を出す**しかありませんでした。押してから確認が現れるまで、通信2本ぶん待たされていたわけです。

アプリ内ダイアログなら、先に開いておいて中身だけ後から差し替えられます。

```tsx
function handleDeleteClick() {
  setConfirmOpen(true)   // まず開く
  void loadCardCount()   // 数えるのはその後
}
```

このとき状態を`countingCards`（取得中か）と`cardCount`（件数、失敗なら`null`）の**2つに分ける**のが要点です。[11章](./04-custom-hooks.md#11-データ取得の3状態とレースコンディション)の`useApi`が`loading`と`data`を分けて持っているのと同じ理由で、1つの`number | null`で兼ねてしまうと「取得中」と「取得に失敗した」が区別できず、失敗したときに「確認しています…」の表示のまま止まって、いつまで待てばいいのか分からない画面になります。

```tsx
<p aria-live="polite">
  「{board.name}」を削除します。
  {countingCards
    ? ' 含まれるカードの件数を確認しています…'
    : cardCount === null
      ? ' このボードに含まれるカード・ラベルもすべて削除されます。'
      : cardCount > 0
        ? ` このボードに含まれる${cardCount}件のカード（アーカイブ済みを含む）とラベルもすべて削除されます。`
        : ' このボードにカードはありません。'}
</p>
```

`aria-live="polite"`は、ダイアログを開いた**後で**この文が書き換わることを支援技術に伝えるためのものです。要素は開いた時点から存在し、後からテキストだけが差し替わるので、ライブリージョンとして機能します（カード完全削除の側は最初から文が確定しているので不要です）。

なお「件数が分からないことを理由に削除操作をブロックしない」という30章からの方針はそのままです。件数取得のGETがたまたま失敗しただけで、本来できるはずの削除ができなくなるのは筋が悪いので、汎用の文言にフォールバックしたうえで実行ボタンは押せるままにしてあります。

### jsdomには`showModal()`が無い

[35章](./13-frontend-testing.md#35-フロントエンドの自動テスト壊れても気づけない場所を守る)の「残っている課題」に挙がっていた壁です。テスト環境のjsdom（30.0.1時点）は`HTMLDialogElement`の`open`プロパティしか実装しておらず、`showModal()`も`close()`も存在しません。

```
typeof showModal: undefined  /  typeof close: undefined
HTMLDialogElement.prototype の own props: [ 'constructor', 'open' ]
```

そのため`showModal()`を呼ぶコンポーネントは、そのままではテスト中に`TypeError`で落ちます。[`src/test/setup.ts`](../../frontend/src/test/setup.ts)に最小限の代替を置いて解決しました。

```ts
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
}
```

`open`属性を出し入れするだけで足りるのは、jsdomの既定スタイルシートに`dialog:not([open]) { display: none }` が入っているためです。これによりTesting Libraryの「画面に見えている要素だけを探す」判定も期待どおり働き、閉じているダイアログの中身は見つからない、という本物に近い挙動になります。

ただし**この代替で再現できないものははっきりさせておく必要があります**。トップレイヤー・背景要素の不活性化・フォーカストラップ・Escapeによる`cancel`イベント・`::backdrop`は、どれもjsdomには無いものです。テストで確認できるのは「Reactのstateとイベントの配線が正しいか」までで、モーダルとして本当に機能しているかはブラウザで見るしかありません。テストが通ったからといって、確かめた範囲を超えて安心しないこと——テストを書くときに毎回意識しておきたい線引きです。

### 結果

置き換えたのは`window.confirm()`を使っていた2箇所だけです。[`LabelPicker`](../../frontend/src/components/LabelPicker.tsx)のラベル削除確認（[37章](./11-card-deletion.md#37-3つ目の削除機能確認手段をあえてwindowconfirmにしない)）はそのまま残しました。あちらはもともと`window.confirm()`を使っておらず今回の不具合の対象外であるうえ、削除対象のチップのすぐ下に出ること自体が「どのラベルを消すのか」を示す手がかりになっているためです。共通化それ自体が目的ではないので、揃えたほうが良くなるものだけを揃える、という判断です。

この章でいちばん残しておきたいのは、**ブラウザ標準の機能に乗るという判断にも、乗る相手によって当たり外れがある**ということかもしれません。`<dialog>`の`showModal()`はフォーカストラップも背景の不活性化も肩代わりしてくれる、乗って得しかない相手でした。一方`window.confirm()`は、ユーザーが無自覚に無効化でき、しかもそれをアプリから検知できないという条件が付いていました。「標準にあるから使う」ではなく、その標準が**どういう条件で動かなくなるか**まで見て選ぶ必要があります。

---

[← React学習ドキュメントトップへ戻る](./README.md)
