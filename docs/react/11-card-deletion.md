# カードの完全削除

[← React学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **31〜32章、37章** をまとめています。

---

## 31. 2つ目の削除機能——`useDelete`と`window.confirm`の再利用

アーカイブ済みカードの「完全削除」ボタン（要件定義5.7）は、本プロジェクトで2つ目の削除機能です。1つ目の削除（[30章](./10-board-management.md#30-削除とkeyによる再マウント)のボード削除）で作った部品を、ほとんど手を加えずに再利用しています。

### 行ごとに`useDelete`を持つ理由——`useMutation`と同じ罠

`components/ArchivedCardItem.tsx`は、アーカイブ一覧の1行ぶんのコンポーネントで、既に「復元」ボタンのために`useMutation('PATCH', apiPaths.updateCardArchive(card.id))`を行ごとに持っていました（[19章](./08-form-and-mutation.md#19-書き込みpostとデータの更新)）。「完全削除」の`useDelete`もこの同じコンポーネントの中に追加します。

```tsx
const { remove: deleteCard, submitting: deleting, error: deleteError } = useDelete(apiPaths.card(card.id))
```

一覧全体で`useDelete`を1つだけ持ち、クリックされた行の`card.id`を都度渡す、という設計は取れません。`useDelete(path)`は、フックが呼ばれた時点の`path`を引数として固定するため、一覧のトップレベルで1つだけ生成すると「どの行の『完全削除』を押しても、最後にレンダリングされた行のIDへ送られる」という事故になります。これは`useMutation`について[22章](./09-editing-and-drag-and-drop.md#22-カード詳細モーダルを編集可能にする)や`ArchivedCardItem`自身のdocblockで既に説明されている制約と同じもので、DELETE用のフックにもそのまま当てはまります。「行ごとにコンポーネントを切り出し、各自が自分の`card.id`に対するフックを持つ」という解決策も、`components/CardItem.tsx`の「移動」メニュー・`ArchivedCardItem`の「復元」ボタンと完全に同じ形です。

### `apiPaths`に専用関数を足さない

```ts
apiPaths.card(cardId)  // GET・PUT・DELETEで共用
```

`apiPaths.card()`は、既にカード詳細取得（GET）・編集（PUT）で使われているURLを返す関数です。完全削除（DELETE）もこれをそのまま使い、`apiPaths.deleteCard()`のような専用関数は新設しません。理由は`apiPaths.board()`が既にGET・PUT・DELETEの3メソッドで共用されている前例があるためです（`api/client.ts`）。URLはHTTPメソッドとは独立に「どのリソースを指すか」だけを表現するものなので、URLの文字列が同じである以上、生成する関数を分ける理由がありません。

### 確認メッセージに何を書くべきかは、削除対象の関係の広さで決まる

[30章](./10-board-management.md#30-削除とkeyによる再マウント)のボード削除は、確認メッセージに含めるカード件数を得るために、削除ボタンが押されるたびに2本のGETを発行していました（ボード1つの削除が、複数のカード・ラベルを巻き込むため）。カードの完全削除ではこの事前GETを行いません。

```tsx
const lines = [`「${card.title}」をアーカイブから完全に削除します。`, 'この操作は取り消せません。よろしいですか？']
if (!window.confirm(lines.join('\n'))) return
```

カード1件の削除で巻き込まれるのは、ラベルとの結び付き（`card_label`。[docs/spring-boot 42章](../spring-boot/11-delete-api.md#42-削除の可否を状態で決める在るかだけでは足りないとき)参照）だけで、ラベル自体は削除されません。「何件消えるか」という情報がそもそも存在しないため、確認メッセージも「対象と、取り消せないことだけ」を伝える単純な2行で足ります。確認ダイアログに何を書くべきかは、削除という操作の重さそのものではなく、**その削除が他の何を巻き込むか**によって決まる、という考え方が[30章](./10-board-management.md#30-削除とkeyによる再マウント)との対比から見えてきます。

`window.confirm()`を使う判断自体（カスタムモーダルにしない理由）は[30章](./10-board-management.md#30-削除とkeyによる再マウント)で解説済みのため、ここでは繰り返しません。

### エラー表示は`StatusMessage`——`<p role="alert">`をそのまま真似ない

`components/SortableBoardRow.tsx`（ボード削除）は、削除エラーを`<p role="alert">`で行内に直接表示していました。これは「ボード管理モーダルという狭い幅の中の、1行という限られたスペースに収める」ための選択だとコメントされています。`ArchivedCardItem`はこれをそのまま真似ていません。

```tsx
{restoreError !== null && <StatusMessage kind="error">{restoreError.message}</StatusMessage>}
{deleteError !== null && <StatusMessage kind="error">{deleteError.message}</StatusMessage>}
```

`ArchivedCardItem`は画面幅いっぱいに広がるカード（`w-full`）で、しかも既に「復元」の失敗を`StatusMessage`（[17章](./07-build-tooling.md#17-tailwind-cssの読み方)）で表示していました。同じコンポーネントの中でエラーの見せ方が2種類混在すると読み手が混乱するため、「完全削除」の失敗も同じ`StatusMessage`に揃えています。他のコンポーネントの実装をコピーするときは、その実装が選ばれた**理由**（ここでは「狭い幅に収めるため」）がそのまま自分のコンポーネントにも当てはまるかを確認する必要がある、という一例です。

📄 実装：`frontend/src/components/ArchivedCardItem.tsx`

---

## 32. 影響範囲の見極め——なぜ`dataVersion`が要らないのか

[30章](./10-board-management.md#30-削除とkeyによる再マウント)のボード削除は、`<Routes key={dataVersion}>`という仕組みで、削除の影響をアプリ全体に行き渡らせていました。カードの完全削除では、この仕組みを一切使いません。

```tsx
<ArchivedCardItem
  card={card}
  onSelect={(cardId) => setSelectedCardId(cardId)}
  onRestored={refetch}
  onDeleted={refetch}
/>
```

`pages/ArchiveView.tsx`が`onDeleted`に渡しているのは、自分自身の`refetch`だけです。`App.tsx`側の後始末は何もしていません。

### 業務ルールが、影響範囲をこの画面1枚に閉じ込めている

[30章](./10-board-management.md#30-削除とkeyによる再マウント)で`dataVersion`が必要だった理由は、「削除されたボードに属するカードが、横断ビュー・アーカイブ画面・検索画面など、`App`が直接手を出せない他のページにも残ってしまう」ことでした。カードの完全削除にはこの問題が起こりません。理由は、削除できるカードが**アーカイブ済みのものに限られている**という業務ルール（[docs/spring-boot 42章](../spring-boot/11-delete-api.md#42-削除の可否を状態で決める在るかだけでは足りないとき)）にあります。横断ビュー（`CrossBoardView`）・ボード詳細（`BoardDetailView`）・検索結果（`SearchView`）は、いずれもカード一覧を`archived: false`で取得しています（[11章](./04-custom-hooks.md#11-データ取得の3状態とレースコンディション)）。つまり、完全削除できるカードは、そもそも削除される前からこれらの画面には**表示されていません**。削除の影響が及ぶ画面は、そのカードが唯一表示されていたアーカイブ画面だけであり、そこは`ArchiveView`自身の`refetch`で最新化できてしまいます。

「サーバー側のAPIがどんな制約を持つか」が、フロントエンドの状態管理をどれだけ単純にできるかを左右する、という関係がここに表れています。もし「どんな状態のカードでも削除できる」という仕様だったなら、削除されたカードが他のページに残り続けないよう、[30章](./10-board-management.md#30-削除とkeyによる再マウント)と同じ`dataVersion`の仕組みが必要になっていたはずです。

### 楽観的更新をしない理由（再確認）

「削除に成功したら、行をローカルのstateから即座に取り除けばよいのでは」という楽観的更新も採用していません。

```tsx
// removeは失敗時にfalseを返す（例外は投げない。hooks/useDelete.ts参照）。
if (!(await deleteCard())) return
onDeleted()
```

[19章](./08-form-and-mutation.md#19-書き込みpostとデータの更新)で述べた「一覧の中身を決める権限はサーバー側にある」という方針をここでも踏襲し、`onDeleted`（= `refetch`）でサーバーへ取りに行き直しています。この一覧の中身は、サーバー側の絞り込み条件（`archived=true`）によって決まっており、削除成功後にクライアント側が「消えたはずの行」を自分で取り除く処理を書くことは、この絞り込み条件をフロントエンドにもう一度実装し直すことに等しくなります。唯一の例外はドラッグ＆ドロップ（[25章](./09-editing-and-drag-and-drop.md#25-ドラッグドロップだけの楽観的更新)）で、そちらは「ドロップした瞬間に動いた実感が無いと使い物にならない」という体験上の要請が、この方針を上回るだけの理由になっていました。カードの完全削除にそのような瞬時性は求められていない（確認ダイアログを経由する時点で、既に一呼吸置かれた操作になっている）ため、原則どおりサーバーからの取り直しに委ねています。

📄 実装：`frontend/src/components/ArchivedCardItem.tsx`、`frontend/src/pages/ArchiveView.tsx`

---

## 37. 3つ目の削除機能——確認手段をあえて`window.confirm`にしない

ラベル削除（要件定義5.5）は、本プロジェクトで3つ目の削除機能です。件数取得のロジックは[30章](./10-board-management.md#30-削除とkeyによる再マウント)のボード削除からそのまま転用できますが、確認手段だけは30章・31章のどちらとも異なる選択をしています。

### 件数取得ロジックの転用——`countCardsForDeleteConfirm`と同じ形

```tsx
async function countCardsForLabel(labelId: number): Promise<number | null> {
  try {
    const controller = new AbortController()
    const [active, archived] = await Promise.all([
      fetchJson<CardResponse[]>(apiPaths.cards({ boardId, labelIds: [labelId], archived: false }), controller.signal),
      fetchJson<CardResponse[]>(apiPaths.cards({ boardId, labelIds: [labelId], archived: true }), controller.signal),
    ])
    return active.length + archived.length
  } catch {
    return null
  }
}
```

[30章](./10-board-management.md#30-削除とkeyによる再マウント)の`countCardsForDeleteConfirm`（ボード削除）と、`archived: false`・`archived: true`の2本を`Promise.all`で並行取得して合算する、失敗時は`null`を返し削除フロー自体は止めない、という骨格がそのまま一致します。違いは`apiPaths.cards()`に渡す絞り込み条件だけです（ボード削除は`{ boardId }`のみ、ラベル削除は`{ boardId, labelIds: [labelId] }`を加えて「このラベルが付いたカードだけ」に絞る）。`GET /api/cards`が`labelIds`によるOR条件の絞り込みを既に持っていた（検索画面・要件5.8向けに実装済み）ため、バックエンドに新しいAPIを1本も足さずに済んでいます。「必要な絞り込みが可能な汎用GETが既にあるなら、削除確認のためだけに専用のカウントAPIを新設しない」という判断です。

### 転用したときに紛れ込んだバグ——「取得中」と「取得できなかった」を1つのstateで兼ねない

この件数取得ロジックには、転用の過程で入り込んだバグがありました。**件数の取得に失敗すると、確認パネルが「使用状況を確認しています…」の表示のまま永久に確定しない**というものです。

原因は、2つの異なる意味を1つのstateに載せていたことです。

```tsx
// 修正前
const [pendingCardCount, setPendingCardCount] = useState<number | null>(null)

function handleRequestDelete(label: LabelResponse) {
  setDeleteTarget(label)
  setPendingCardCount(null)                                // 「取得中」のつもりのnull
  void countCardsForLabel(label.id).then(setPendingCardCount)
}
```

`countCardsForLabel`は取得に失敗すると`catch`で`null`を返します。その`null`がそのまま`setPendingCardCount`へ渡るため、**「まだ取得中」を表すnullと区別が付きません**。表示側は`pendingCardCount === null`を「取得中」と解釈するので、失敗した瞬間から表示が止まります。

```tsx
{pendingCardCount === null
  ? ' 使用状況を確認しています…'    // ← 取得に失敗したときもここに落ち、以後変わらない
  : /* ... */}
```

これは[11章](./04-custom-hooks.md#11-データ取得の3状態とレースコンディション)で`useApi`が`loading`と`data`を**分けて**持っている理由そのものです。「読み込み中」「データ無し」「取得済み」は3つの別々の状態であり、`null`という1つの値で2つを兼ねようとすると必ずどこかで衝突します。修正はその原則に戻すだけです。

```tsx
// 修正後：取得中かどうかを独立したstateにする
const [countingLabelCards, setCountingLabelCards] = useState(false)
const [pendingCardCount, setPendingCardCount] = useState<number | null>(null)

void countCardsForLabel(label.id).then((count) => {
  setPendingCardCount(count)
  setCountingLabelCards(false)   // 成功・失敗のどちらでも必ず降ろす
})
```

そのうえで、`null`（取得できなかった）のときの文言を新たに用意しました。件数は言えなくても「削除するとカードからラベルが外れる」という結果自体は変わらないので、それだけを伝えます。ボード削除が件数を数えられなかったときに汎用の文言へフォールバックするのと同じ考え方です。

興味深いのは、**転用元のボード削除には同じバグが無かった**ことです。あちらは`window.confirm()`用の文字列を組み立てる際、`cardCount === null`を「件数不明」として扱い、そもそも「取得中」という表示状態を持っていませんでした（同期APIなので、件数を待ってから確認を出していたためです）。**同じ`number | null`という型でも、`null`が何を意味するかは呼び出し文脈によって違う**——ロジックをコピーするときに型だけを見て安心すると、こういう取りこぼしが起きます。[31章](#31-2つ目の削除機能usedeleteとwindowconfirmの再利用)の「エラー表示は`StatusMessage`」の節で書いた「その実装が選ばれた理由が自分にも当てはまるか確認する」という話と、根は同じです。

なお、このバグは別の作業でボード削除側にも「取得中」の表示を導入することになり、この`LabelPicker`の実装を手本にしようと見比べていて見つかったものです。**動いているコードを手本にするつもりで読んだら、手本の側が壊れていた**わけで、既存実装の転用は「読む」機会そのものに価値がある、という一例でもあります。修正には回帰テストを添え、**テストを書いたら一度わざと壊して、本当に守っているかを確かめる**（[35章](./13-frontend-testing.md#35-フロントエンドの自動テスト壊れても気づけない場所を守る)）という手順も踏んでいます。

### なぜ`window.confirm`ではないのか

[30章](./10-board-management.md#30-削除とkeyによる再マウント)・[31章](#31-2つ目の削除機能usedeleteとwindowconfirmの再利用)はどちらも`window.confirm()`を選び、「開閉状態の管理やフォーカストラップの作り込みが一切不要になる」ことを理由に挙げていました。ラベル削除ではこの前例をあえて踏襲せず、`LabelPicker`内にその場で確認パネルを展開する、独自のインラインUIを使っています。

```tsx
{deleteTarget !== null && (
  <div className="flex flex-col gap-2 rounded border border-red-200 bg-red-50 p-2 text-xs">
    <p>「{deleteTarget.name}」を削除しますか？ ...</p>
    <div className="flex gap-2">
      <button type="button" onClick={handleConfirmDelete} disabled={deletingLabel}>...</button>
      <button type="button" onClick={handleCancelDelete}>...</button>
    </div>
  </div>
)}
```

理由は技術的な制約ではなく、`LabelPicker`が置かれる文脈にあります。`LabelPicker`は`CardCreateForm`（`<form>`の中）と`CardDetailModal`（[34章](./12-dialog-accessibility.md#34-ネイティブdialogとモーダルのアクセシビリティ)で見た、`showModal()`で開く`<dialog>`の中）の両方から使われます。`window.confirm()`はブラウザのネイティブダイアログなので、`<dialog>`の中から呼んでも問題なく動作しますが、もし`window.confirm()`の代わりに34章と同じ「ネイティブ`<dialog>` + `showModal()`」で確認用のカスタムモーダルを作っていたら、`CardDetailModal`から使う場合に「`<dialog>`の中からさらに`<dialog>`を開く」という、本プロジェクトにまだ無い入れ子構成を持ち込むことになっていました（HTML標準としては複数の`<dialog>`が同時にトップレイヤーへ積まれること自体は許容されており技術的には動きますが、確かめる価値のある複雑さが一つ増えます）。

「影響件数を確認前に表示したい」という要件を満たす手段として、①`window.confirm()`のまま件数を含めた文字列を事前生成する（30章と同じ）、②ネイティブ`<dialog>`によるカスタムモーダル（34章と同じ手法をもう1つ増やす）、③このコンポーネント自身のstateで開閉する素の`<div>`（新しい仕組みを増やさない）という3案のうち、③を選んでいます。`window.confirm()`は`OK`/`キャンセル`の2択とメッセージ文字列しか表現できず、「件数を確認中は取得中である旨を示しつつボタンは押せる」といった段階的な表示ができません。カスタム`<dialog>`は表現力では③と同等ですが、入れ子の複雑さを増やすだけの見返りが無いと判断しました。

### `deleteTarget`という「どのラベルの確認パネルを開いているか」を表すstate

```tsx
const [deleteTarget, setDeleteTarget] = useState<LabelResponse | null>(null)
const [pendingCardCount, setPendingCardCount] = useState<number | null>(null)
```

[29章](./10-board-management.md#29-インライン改名編集とescapeの競合)の`renamingBoardId`（「どの行が改名編集中か」を親が1つのstateで持つ）と同じ考え方です。ラベルは複数並んでおり、確認パネルを同時に開けるのは1つだけでよいため、「開いている／いない」の`boolean`ではなく「どのラベルの確認中か（`null`なら誰も確認中でない）」という値を持たせています。`pendingCardCount`を`deleteTarget`とは別のstateに分けているのは、「対象は決まったが件数はまだ取得中」という中間状態（`countCardsForLabel`が非同期のため必ず一瞬発生する）を表現するためで、[11章](./04-custom-hooks.md#11-データ取得の3状態とレースコンディション)の「読み込み中とデータなしを区別する」という考え方の小さな再現でもあります。

### 削除後、選択中のラベルからも外す

```tsx
if (selectedLabelIds.includes(deletedId)) {
  onChange(selectedLabelIds.filter((id) => id !== deletedId))
}
```

`LabelPicker`は[21章](./08-form-and-mutation.md#21-フォームの中でネストした作成を行う)で見たとおり「controlled」コンポーネントで、選択状態（`selectedLabelIds`）は呼び出し元が持っています。削除したラベルがちょうど選択済みだった場合にこれを行わないと、送信時にバックエンドの`labelIds`検証（[docs/spring-boot 32章](../spring-boot/09-write-api-validation.md#32-アプリケーション層での重複許可値チェック)の考え方の延長）に弾かれてしまいます。作成時にラベルを自動選択する（[21章](./08-form-and-mutation.md#21-フォームの中でネストした作成を行う)）のとちょうど逆方向の、対称的な後始末です。

📄 実装：`frontend/src/components/LabelPicker.tsx`

---

*本ドキュメントは開発と並行して育てていく学習ノートです。実装で分からないReactの概念が出てきたら、まずここに解説がないか確認し、無ければ追記してください。*
