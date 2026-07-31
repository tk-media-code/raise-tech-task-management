# カードの編集とドラッグ＆ドロップ

[← React学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **22〜26章** をまとめています。

---

## 22. カード詳細モーダルを編集可能にする

`CardDetailModal`は、これまで`<dl>`（定義リスト）で値を表示するだけの閲覧専用コンポーネントでした。要件5.2「カード詳細を開き、説明・期日・ラベルを追加/変更できる」に対応するため、`<form>`を持つ編集可能なコンポーネントに書き換えました。

### 「下書きstate」を持つ項目と持たない項目

タイトル・説明・期日・ラベルは、`useState`による**下書き**を持ちます。

```tsx
const [title, setTitle] = useState('')
const [description, setDescription] = useState('')
const [dueDate, setDueDate] = useState('')
const [labelIds, setLabelIds] = useState<number[]>([])

useEffect(() => {
  if (card === null) return
  setTitle(card.title)
  setDescription(card.description ?? '')
  setDueDate(card.dueDate ?? '')
  setLabelIds(card.labels.map((label) => label.id))
}, [card])
```

`useState`の初期値は空文字列・空配列にしておき、`card`（`useApi`が取得したカード本体）が届いた**後**に`useEffect`で詰め直しています。[03-state-effect.md 7章](./03-state-effect.md#7-stateとusestate)の「初期値は初回描画にしか使われない」という制約がここでも効いています。モーダルを開いた瞬間はまだ`card === null`（通信中）で、GETが完了して初めて`card`に値が入るという2段階を経るため、`useState(card.title)`のように最初から値を渡す方法は使えません。この依存配列を`cardId`ではなく`card`（オブジェクトそのもの）にしているのも意図的です。「保存」に成功して`refetch()`が完了すると、同じカードに対して**新しいcardオブジェクト**が届きます。`cardId`は変わっていなくても、依存配列を`card`にしておけばこの再取得を検知でき、サーバー側で正規化された値（`title.trim()`済みの表記など）を改めて下書きへ反映できます。

一方、ステータスの`<select>`だけは下書きstateを持たず、`card.status`へ**直接**紐づけています。

```tsx
<select value={card.status} onChange={handleStatusChange} disabled={changingStatus}>
```

タイトル等が「入力してから保存ボタンで確定する」編集なのに対し、ステータス変更は要件5.3の設計上、選んだ瞬間に確定する（PATCHが即座に送られる）操作です。「保存を待つ下書き」という概念がそもそも無いため、下書きstateを用意する理由もありません。`<select>`は変更が成功して`refetch()`が完了するまで`disabled`にしておき、その間に表示している値と実際の値がずれないようにしています。

### `<select>`の値と`isCardStatus`型ガード

```tsx
async function handleStatusChange(event: ChangeEvent<HTMLSelectElement>) {
  const nextStatus = event.target.value
  if (!isCardStatus(nextStatus)) return
  const updated = await changeStatus({ status: nextStatus })
  if (updated === null) return
  refetch()
  onUpdated()
}
```

`event.target.value`の型はTypeScript上ただの`string`です。`<option>`は`STATUSES`（`lib/status.ts`）から生成しているため実行時には必ず3値のいずれかですが、TypeScriptはその保証をしてくれません。`lib/grouping.ts`（[docs/react 12章](./04-custom-hooks.md#12-usememoと再計算の抑制)で登場した`groupCardsByStatusAndBoard`）が使っているのと同じ`isCardStatus`型ガードをここでも使い、`string`から`CardStatus`へ絞り込んでいます。

### 更新の反映範囲：このモーダル自身と、呼び出し元の両方

保存・ステータス変更が成功すると、2つの`refetch`系の処理を呼びます。

```tsx
refetch()   // このモーダル自身のuseApi（card本体）を取り直す
onUpdated() // 呼び出し元（CrossBoardView・BoardDetailView・SearchViewのカード一覧）に再取得を依頼する
```

`refetch`だけでは、モーダルの外にある一覧（カードの並びやステータス列）は更新されません。`onUpdated`だけでは、モーダル自身が表示しているステータス（`card.status`に直接紐づく`<select>`の値）が古いままになります。要件5.4「横断ビュー上でカードを編集・ステータス変更すると、元のボード詳細画面にも反映される」は、呼び出し元（`CrossBoardView`・`BoardDetailView`・`SearchView`）がそれぞれ自分の`useApi`の`refetch`を`onUpdated`として渡すことで実現しています。

---

## 23. dnd-kitの構成要素

要件5.3のドラッグ＆ドロップは、`@dnd-kit/core`・`@dnd-kit/sortable`というライブラリ（dnd-kit）で実装しています。自前でマウスイベントを組み立てるのではなくライブラリを使う理由は、要件定義（[docs/requirements 9.2](../requirements/05-tech-stack-and-roadmap.md)）がタッチ操作への対応を理由に採用を決めているためです。

| 要素 | 役割 |
| --- | --- |
| `<DndContext>` | ドラッグ＆ドロップ全体を包むプロバイダ。センサー・衝突判定・イベントハンドラをここに集約する |
| `useDroppable({ id })` | 「ここへドロップできる」領域を登録するフック。列（ステータス×ボード）そのものに使う |
| `useSortable({ id })` | 「ドラッグでき、かつ並べ替えの対象になる」要素を登録するフック。カード1枚（`CardItem`）に使う |
| `<SortableContext items={...}>` | 同じ列に属するカードのID一覧を保持し、列内の並べ替えを可能にする |
| `<DragOverlay>` | ドラッグ中、ポインタに追従する見た目のコピーを描画する（[26章](#26-dragoverlayと見た目のコピー)） |

### 列とカード、2段構えのドロップ判定

`components/SortableCardList.tsx`は、`useDroppable`と`SortableContext`の**両方**を使います。

```tsx
function SortableCardList({ id, cards, onSelect, onMoved, emptyHint, dropIndicator }: Props) {
  const { setNodeRef } = useDroppable({ id })
  const indicator = dropIndicator?.columnId === id ? dropIndicator : null
  const showEmptyIndicator = indicator !== null && indicator.beforeCardId === null

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-8 flex-col gap-3 rounded-lg ${showEmptyIndicator ? 'outline-2 -outline-offset-2 outline-dashed outline-blue-500' : ''}`}
    >
      <SortableContext id={id} items={cards.map((card) => card.id)} strategy={noSorting}>
        {cards.length === 0 ? emptyHint : null}
        {cards.map((card) => (
          <CardItem key={card.id} card={card} onSelect={onSelect} onMoved={onMoved} showDropLine={indicator?.beforeCardId === card.id} />
        ))}
      </SortableContext>
    </div>
  )
}
```

`useDroppable`が担うのは「カードが1枚も無い列」「列内の最後のカードより下の余白」へドロップされたケースです。`SortableContext`だけでは、カードが1枚も無い列にはそもそも「並べ替え対象のID」が1つも無いため、空の列へドロップする操作を検出できません。列自体を表す`useDroppable`をあわせて登録することで、空の列でもドロップ可能な領域として機能します。

`min-h-8`というTailwindクラスを`SortableCardList`の外枠に必ず与えているのも、この「空の列へのドロップ」を成立させるためです。高さ0の要素は、dnd-kitの当たり判定（重なり検出）が実質的に機能せず、ドロップ操作自体が成立しません。

`strategy`に渡している`noSorting`（`() => null`を返すだけの自作の`SortingStrategy`）は、dnd-kit標準の`verticalListSortingStrategy`をあえて使わない選択です。理由は[27章](#27-挿入位置の可視化)で扱います。

### `CardItem`自身がドラッグ対象になる

```tsx
function CardItem({ card, onSelect, onMoved }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={`... ${isDragging ? 'opacity-40' : ''}`}
    >
```

`useSortable`が返す`setNodeRef`・`style`（`transform`/`transition`）・`attributes`・`listeners`を、ドラッグの起点にしたいDOM要素へそのまま渡します。`transform`はドラッグ中の移動量、`transition`はドロップ後に本来の位置へ滑らかに戻るアニメーションで、`CSS.Transform.toString`（`@dnd-kit/utilities`）がdnd-kit内部の値をCSSの`transform`プロパティ文字列へ変換します。`isDragging`はこの要素が今まさにドラッグされている最中かどうかを表す真偽値で、元の位置を半透明にする（実際に指に追従する見た目は[26章](#26-dragoverlayと見た目のコピー)の`<DragOverlay>`が担う）ために使っています。

専用の「つまみ」（ドラッグハンドル）を別に用意せず、カード全体を`{...listeners}`の対象にしているのは、[24章](#24-センサーとactivationconstraint)のしきい値によって、クリックとドラッグの区別がライブラリ側で解決されるためです。

---

## 24. センサーと`activationConstraint`

dnd-kitは「何をきっかけにドラッグを開始するか」を**センサー**という単位で切り替えられます。本プロジェクトは3種類を組み合わせています。

```tsx
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  useSensor(KeyboardSensor),
)
```

| センサー | `activationConstraint` | 何のためか |
| --- | --- | --- |
| `PointerSensor` | `distance: 8` | マウス・トラックパッドでの操作。**8pxを超えて動くまではドラッグ開始と見なさない** |
| `TouchSensor` | `delay: 200, tolerance: 5` | タッチ操作（要件5.3・8.1）。**200ms指を置いたままにし、その間5pxを超えて動けばスクロールの意図と判断してドラッグを開始しない** |
| `KeyboardSensor` | なし | キーボード操作によるアクセシビリティ対応 |

### クリックとドラッグを同じ要素で共存させる

`CardItem`は、カード全体が`useSortable`のドラッグ対象でありながら、内側に「カード詳細を開く」`<button>`と「移動」`<select>`という、それ自体クリック・選択操作を必要とする要素を持っています。`activationConstraint.distance`（あるいは`delay`/`tolerance`）が無いと、これらをクリックしようとしただけの操作もすべてドラッグ開始と誤認識され、`onClick`・`<select>`のクリックが機能しなくなります。

しきい値を設けることで、動かさない単純なクリックは（移動量が0または僅かなため）ドラッグとして扱われず、ブラウザの既定の挙動（ボタンの`onClick`発火、`<select>`のドロップダウン展開）がそのまま働きます。実際に8pxを超えて動かして初めて、dnd-kitがそのポインタ操作を掌握し、ドラッグとして扱い始めます。

### なぜスマートフォン・タブレットにも対応するのか

要件5.3は「スマートフォン・タブレットでのタッチ操作によるドラッグ＆ドロップにも対応する」ことを明記しています。`TouchSensor`を単に追加するだけでなく、`delay`を設けているのは、指でスワイプして**画面をスクロールしたいだけの操作**と、カードを**ドラッグして移動したい操作**を区別するためです。`delay`が無ければ、カード一覧を指でスクロールしようとするたびにドラッグが始まってしまい、スクロール自体ができなくなります。

要件5.3はこれに加え、「カードの『移動』ボタンや『…』メニューから選べる明示的な操作手段」も求めています。`CardItem`の「移動 ▾」セレクト（[22章](#22-カード詳細モーダルを編集可能にする)のステータス`<select>`と同じ考え方）が、この明示的な操作手段にあたります。この`<select>`は`className`に`md:hidden`（[07-build-tooling.md 17章](./07-build-tooling.md#17-tailwind-cssの読み方)のレスポンシブ修飾子）を付け、768px未満のスマートフォン幅でのみ表示しています。768px以上ではドラッグ＆ドロップと、カード詳細モーダルの「ステータス」欄という2つの手段が既にあり、`<select>`は不要になるためです。

---

## 25. ドラッグ＆ドロップだけの楽観的更新

[08-form-and-mutation.md 19章](./08-form-and-mutation.md#19-書き込みpostとデータの更新)の「なぜ楽観的更新にしないのか」は、`hooks/useCardDragAndDrop.ts`においては**例外**を設けています。

```tsx
// 楽観的更新：ローカルの配列を並べ替えて即座に表示へ反映する
setOptimisticCards([...untouched, ...renumbered])

try {
  await patchJson<CardStatusUpdateRequest, CardResponse>(apiPaths.updateCardStatus(draggedCard.id), {
    status: destination.status,
    position: insertIndex,
  })
  refetch() // 成功時はサーバー側の最終状態を取り直す
} catch (cause) {
  setError(/* ... */)
  setOptimisticCards(null) // 失敗時は直ちに取り消す
}
```

カード作成のような「新しい行が増えるだけ」の操作は、反映がPATCH＋refetchの往復ぶん（数百ミリ秒）遅れても違和感が薄いものでした。ドラッグ＆ドロップは性質が異なります。「指を離した場所にカードが収まる」ことが操作の結果そのものであり、その間だけ元の位置に戻って見えてしまうと、あたかも操作が取り消されたかのように誤解を招きます。この体感の差が、例外を設ける理由になっています。

### `optimisticCards`が消えるタイミング

```tsx
const [optimisticCards, setOptimisticCards] = useState<CardResponse[] | null>(null)

useEffect(() => {
  setOptimisticCards(null)
}, [cards])
```

`cards`（`useApi`が返す、親コンポーネントの生データ）が新しいオブジェクトに変わるたび、このフックは`optimisticCards`をリセットします。ドロップ操作の成功時に呼ぶ`refetch()`は、その完了を`await`できる形で公開されていません（[08-form-and-mutation.md 19章](./08-form-and-mutation.md#19-書き込みpostとデータの更新)の`refetch`は`() => void`）。そのため「いつ楽観的な表示を手放すか」を、`refetch`の呼び出し側では判断できません。代わりに`cards`自体の変化を`useEffect`で監視し、**サーバー側の最新データが実際に届いた瞬間**に手放す、という間接的な設計にしています。この一手間により、`useCardDragAndDrop`を呼ぶ側（`BoardDetailView`・`CrossBoardView`）は、`dragAndDrop.cards`という1つの配列だけを見ていれば「今どちらの状態を表示すべきか」を意識せずに済みます。

失敗時（`catch`節）は`refetch()`を呼ばないため、この`useEffect`に頼ることができません。サーバー側は実際には何も変わっていないので、`setOptimisticCards(null)`をその場で直接呼び、表示をサーバーの状態（＝直前の`cards`）へ戻しています。

---

## 26. `DragOverlay`と見た目のコピー

ドラッグ中、指（ポインタ）に追従して表示されるカードは、リスト内の実物（`CardItem`）ではなく、`<DragOverlay>`が描画する専用のコピー（`components/CardDragPreview.tsx`）です。

```tsx
<DndContext /* ... */>
  {/* ...カード一覧... */}
  <DragOverlay>
    {dragAndDrop.activeCard !== null && <CardDragPreview card={dragAndDrop.activeCard} />}
  </DragOverlay>
</DndContext>
```

### なぜ`CardItem`をそのまま`<DragOverlay>`に描画しないのか

`CardItem`は`useSortable({ id: card.id })`を呼び出し、`card.id`という**sortable id**をdnd-kitに登録しています。もし同じ`CardItem`を`<DragOverlay>`の中でも描画すると、リスト内の1枚（実際にその位置にある`CardItem`）と、オーバーレイの1枚という、**同じidに対する2つの`useSortable`バインディング**が同時に存在することになり、dnd-kitの内部状態管理と衝突します。

この問題を避けるため、`CardDragPreview`は`useSortable`を一切呼ばない、**見た目だけを複製した表示専用コンポーネント**として別に用意しています。ドラッグ中の元の位置（`CardItem`側）は半透明になり（[23章](#23-dnd-kitの構成要素)の`isDragging`）、実際に指に追従する見た目は`CardDragPreview`側が担う、という役割分担です。

### `activeCard`はどこで管理するか

```tsx
function handleDragStart(event: DragStartEvent) {
  const source = optimisticCards ?? cards ?? []
  setActiveCard(source.find((card) => card.id === event.active.id) ?? null)
}
```

`<DndContext>`の`onDragStart`で、ドラッグが始まったカードのIDから実体（`CardResponse`）を探して`activeCard`にセットします。`onDragEnd`（ドロップ時）では、成否によらず`setActiveCard(null)`を最初に呼び、オーバーレイを消します。これらの状態は[25章](#25-ドラッグドロップだけの楽観的更新)の楽観的更新と同じ`useCardDragAndDrop`フックの中で管理されており、呼び出し側の`BoardDetailView`・`CrossBoardView`は`dragAndDrop.activeCard`を`<DragOverlay>`へそのまま渡すだけで済みます。

---

## 27. 挿入位置の可視化

23章までの実装は、カードをどこへドロップしても「重なった相手カードの手前」に挿入する、という簡略化した割り切りでした。ドラッグ中に挿入位置を示す表示も無く、指を離すまでカードがどこに収まるか分かりづらいという課題がありました。この章では、その挿入位置を**ドラッグ中に線で示し、指を離した位置と一致させる**ための3つの工夫を扱います。

### `collisionDetection`のカスタマイズ

dnd-kitは「ドラッグ中のカードが今どのドロップ領域の上にあるか」を`collisionDetection`関数で判定します。既定でよく使われる`closestCenter`は、**全ドロップ領域の中心との距離**で最も近いものを選びます。これは、列全体を覆う`useDroppable`（[23章](#23-dnd-kitの構成要素)）の中心が個々のカードの中心より近くなる場面があり、カードとカードの間にポインタがあっても「列そのもの（＝末尾）」と判定されてしまう問題を引き起こしていました。

```tsx
export const cardCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length > 0) {
    const overCard = pointerCollisions.find((collision) => typeof collision.id === 'number')
    return overCard === undefined ? pointerCollisions : [overCard]
  }
  return closestCenter(args)
}
```

`pointerWithin`は、`closestCenter`と違い**ポインタが実際に重なっている領域**を返します。カードは列の`useDroppable`の内側にあるため、ポインタがカードの上にあると列・カード両方がヒットします。sortable idの型（カードは`card.id`という`number`、列は`columnId()`が組み立てる`string`）でどちらか見分け、より具体的なカード側を優先しています。`pointerWithin`は座標（`pointerCoordinates`）が無いと何も返せないため、`KeyboardSensor`によるキーボード操作時は空配列になります。その場合だけ`closestCenter`にフォールバックすることで、マウス・タッチ操作は正確な当たり判定、キーボード操作は引き続き動作する、という両立を実現しています。この関数は`<DndContext collisionDetection={cardCollisionDetection}>`として渡します。

### 挿入位置を1つの純粋関数にまとめる

「今どこに挿入されようとしているか」の計算（`resolveDropTarget`）を、`hooks/useCardDragAndDrop.ts`内の**purely関数**（React stateに触れない、`event`と現在のカード一覧だけから結果を求める関数）として独立させています。

```tsx
function resolveDropTarget(event: DragMoveEvent, source: CardResponse[]): DropTarget | null {
  // ...over.idから移動先の列を求め、destinationCards（対象カードを除いた列の並び）の中で
  // 挿入位置(insertIndex)を求める...
}
```

この関数を、ドラッグ中の**プレビュー**（後述の`handleDragMove`）と、指を離した瞬間の**確定処理**（`handleDragEnd`）の**両方**から呼びます。同じ入力に対して常に同じ結果を返す関数を1箇所にまとめることで、「ラインが示していた位置」と「実際にカードが収まる位置」が食い違う心配がなくなります。`handleDragEnd`は次のように、直前の`handleDragMove`が計算した結果（`dropTarget`という state）を優先し、無ければ改めて同じ関数を呼びます。

```tsx
const destination = dropTarget ?? resolveDropTarget(event, source)
```

挿入位置が「相手カードの手前」か「後ろ」かは、ドラッグ中のカードの実測矩形（`event.active.rect.current.translated`）の中心Y座標と、重なった相手カード（`event.over.rect`）の中心Y座標を比較して決めています。`onDragMove`・`onDragEnd`のイベントオブジェクトにはポインタの座標そのものは含まれていない（座標を持つのは`collisionDetection`に渡される引数だけ）ため、代わりにドラッグ中カード自身の位置を使っています。

### `onDragMove`と`onDragOver`の違い

挿入位置プレビューの更新には、`<SortableContext>`の並べ替えでよく使われる`onDragOver`ではなく`onDragMove`を使っています。

```tsx
<DndContext
  collisionDetection={cardCollisionDetection}
  onDragStart={dragAndDrop.handleDragStart}
  onDragMove={dragAndDrop.handleDragMove}
  onDragEnd={dragAndDrop.handleDragEnd}
  onDragCancel={dragAndDrop.handleDragCancel}
>
```

`onDragOver`は「`over`（重なっている対象）が変わったとき」だけ発火します。同じカードの上半分から下半分へポインタを動かしただけでは`over`（カードのid）自体は変わらないため、`onDragOver`はこの移動を検知できません。`onDragMove`はポインタが動くたびに発火するため、この「同じカードの中での手前/後ろの切り替え」も含めて`resolveDropTarget`を呼び直せます。

高頻度に発火する分、`handleDragMove`では計算結果が実質的に変わっていなければ`setDropTarget`に同じstateの参照を返し、無駄な再レンダリングを避けています。

```tsx
setDropTarget((prev) => {
  if (prev !== null && next !== null && /* ...prevとnextが同じ挿入位置... */) return prev
  return next
})
```

### `onDragCancel`

Escapeキーでドラッグを中断すると、dnd-kitは`onDragEnd`ではなく`onDragCancel`を呼びます。

```tsx
function handleDragCancel() {
  setActiveCard(null)
  setDropTarget(null)
}
```

これが無いと、キャンセルしたはずのドラッグの見た目（`<DragOverlay>`・挿入ライン）が残ったままになります。`onDragEnd`と同様に`<DndContext onDragCancel={...}>`へ接続するだけで済み、[26章](#26-dragoverlayと見た目のコピー)の`activeCard`と本章の`dropTarget`、両方の後片付けをここでまとめて行います。

### `verticalListSortingStrategy`を使わない理由

[23章](#23-dnd-kitの構成要素)で触れたとおり、`SortableContext`の`strategy`には`verticalListSortingStrategy`ではなく、常に`null`を返す自作の`noSorting`を渡しています。

```tsx
const noSorting: SortingStrategy = () => null
```

`verticalListSortingStrategy`は、ドラッグ中のカードが重なった位置に応じて**同じ列内の他のカードをCSS transformでずらす**（隙間を空ける）ためのストラテジーです。これは列**内**の並べ替えでは機能しますが、列**間**の移動では他の列のカードはずれないため、同じアプリの中で「列内は動く・列間は動かない」という一貫性のない見た目になってしまいます。本章の挿入ライン（`CardItem`の`showDropLine`）は、この「他のカードをずらす」演出に頼らず、ラインだけで挿入位置を示す設計です。他のカードを一切動かさないことで、`event.over.rect`（ドラッグ開始時点で測定された矩形）が常に正しく、`resolveDropTarget`の計算結果とずれる心配もありません。

---

*本ドキュメントは開発と並行して育てていく学習ノートです。実装で分からないReactの概念が出てきたら、まずここに解説がないか確認し、無ければ追記してください。*
