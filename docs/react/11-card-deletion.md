# カードの完全削除

[← React学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **31〜32章** をまとめています。

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

*本ドキュメントは開発と並行して育てていく学習ノートです。実装で分からないReactの概念が出てきたら、まずここに解説がないか確認し、無ければ追記してください。*
