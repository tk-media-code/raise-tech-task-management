# ボード管理（改名・削除）

[← React学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **29〜30章** をまとめています。ボードの並べ替え（ドラッグ＆ドロップ）自体は、カードのドラッグ＆ドロップとの比較を伴うため[09-editing-and-drag-and-drop.md 28章](./09-editing-and-drag-and-drop.md#28-単一リストのドラッグドロップとドラッグハンドル)で扱っています。

---

## 29. インライン改名編集とEscapeの競合

ボードの改名（要件定義5.1）は、ボード管理モーダルの各行を、その場で入力欄に切り替える**インライン編集**として実装しています。

### 「今どの行を編集中か」を親（`BoardManageModal`）が持つ

一見、「編集中かどうか」は`SortableBoardRow`自身が`useState`で持てそうに思えます。しかし、このstateは`SortableBoardRow`ではなく親の`BoardManageModal`が`renamingBoardId`として持っています。

```tsx
const [renamingBoardId, setRenamingBoardId] = useState<number | null>(null)
```

理由は2つあります。1つ目は単純で、同時に2行が編集状態になるのを防ぐためです（`renamingBoardId`は「どの1件を編集中か」を表す単一の値であり、複数行が同時にtrueになりうる設計にはなりません）。2つ目がより本質的で、次に説明するEscapeキーの扱いに関わります。

### document一箇所のEscapeリスナーを、編集中かどうかで分岐させる

`BoardManageModal`は、`CardDetailModal`と同じ作法で、モーダルが開いている間`document`にEscapeキーのリスナーを1つだけ登録しています。

```tsx
useEffect(() => {
  if (!open) return

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return
    if (renamingBoardId !== null) {
      setRenamingBoardId(null)
    } else {
      onClose()
    }
  }

  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [open, onClose, renamingBoardId])
```

改名フォームが開いている間にEscapeを押したときの期待される動作は「編集をキャンセルする」であり、「モーダルごと閉じる」ではありません。この2つの意図を、`renamingBoardId`が`null`かどうかで振り分けています。

### なぜ行（`SortableBoardRow`）側で`stopPropagation`しないのか

「入力欄の`onKeyDown`でEscapeを検知し、`event.stopPropagation()`で親のリスナーに届かせない」という実装も一見できそうです。しかしこれは実際には機能しません。Reactの`onKeyDown`は**合成イベント**（SyntheticEvent）と呼ばれる、Reactが独自に管理するイベントの仕組みの上に成り立っていますが、`document.addEventListener('keydown', ...)`で登録したリスナーは、ブラウザの**ネイティブなイベント伝播**を直接見ています。Reactの合成イベント側で`stopPropagation()`を呼んでも、それはReactのイベントシステム内での伝播を止めるだけで、既にブラウザ側で発生済みのネイティブイベントが`document`まで伝わること自体は止められません。

この2つのイベント系統の違いを意識せずに「行側で止めればよい」と実装すると、「入力欄にフォーカスがある間にEscapeを押すと、キャンセルと同時にモーダルまで閉じてしまう」という混乱を招きます。今回の実装が採っている「状態（`renamingBoardId`）を親に集約し、親のリスナー1つが分岐する」という設計は、この種のイベント系統の食い違いを気にせず済む、より確実な解決策です。

### 改名編集に入るたびに下書きを揃える

```tsx
useEffect(() => {
  if (!isRenaming) return
  setDraftName(board.name)
  nameInputRef.current?.focus()
  nameInputRef.current?.select()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isRenaming])
```

`SortableBoardRow`自体は`isRenaming`が`false`⇔`true`と切り替わるだけで、アンマウント・再マウントはされません。[22章](./09-editing-and-drag-and-drop.md#22-カード詳細モーダルを編集可能にする)の`CardDetailModal`が「`card`（オブジェクトそのもの）が変わるたび下書きを詰め直す」設計だったのに対し、ここでは依存配列を`isRenaming`だけにし、`board.name`をあえて外しています。もし`board.name`も依存に含めると、編集中に（例えば他の行の並べ替えによる）`refetch`が走っただけでこの`effect`が再実行され、ユーザーが入力途中の文字列を`setDraftName(board.name)`が上書きしてしまいます。「編集に入った、その瞬間の名前で1回だけ揃える」ことが目的であり、以後`board.name`が変わっても追従させたくないため、意図的な依存配列の絞り込みとして`eslint-disable-next-line`を添えています（同種の判断は[pages/SearchView.tsx](../../frontend/src/pages/SearchView.tsx)にも既に存在します）。

### ドラッグとの整合性

[09-editing-and-drag-and-drop.md 28章](./09-editing-and-drag-and-drop.md#28-単一リストのドラッグドロップとドラッグハンドル)で触れた`useSortable({ id: board.id, disabled: isRenaming })`により、編集中の行はドラッグの起点にも、他の行の挿入先にもなりません。プロトタイプ（`prototype/app.js`）が編集中の`<li>`に`draggable`属性を付けていないのと同じ効果を、dnd-kitの標準オプションで表現しています。

📄 実装：`frontend/src/components/BoardManageModal.tsx`、`frontend/src/components/SortableBoardRow.tsx`

---

## 30. 削除と`key`による再マウント

ボードの削除（要件定義5.1）は、それ自体はシンプルな`DELETE`リクエスト1本ですが、「削除した結果、画面のどこまでを最新化する必要があるか」という影響範囲の広さが、この機能でいちばん考えることの多い部分です。

### `window.confirm()`という選択

削除ボタンを押した直後、ブラウザ標準の`window.confirm()`で確認を取ります。

```tsx
const lines = [`「${board.name}」を削除します。`]
if (cardCount !== null && cardCount > 0) {
  lines.push(`このボードに含まれる${cardCount}件のカード（アーカイブ済みを含む）とラベルもすべて削除されます。`)
}
lines.push('この操作は取り消せません。よろしいですか？')
if (!window.confirm(lines.join('\n'))) return
```

このプロジェクトの他の確認UI（カード詳細モーダルの保存・アーカイブなど）はカスタムのモーダルやインライン表示ですが、削除の確認だけは`window.confirm()`というブラウザ標準のダイアログを使っています。取り消せない操作の直前に一段挟む確認として、これぐらいの重さがちょうどよく、開閉状態の管理・背景クリックの判定・フォーカストラップ・Escapeキーの処理（[29章](#29-インライン改名編集とescapeの競合)で見た複雑さ）を一切自作せずに済みます。`window.confirm()`はブラウザが用意する同期的なAPIで、呼び出すと`true`（OK）/`false`（キャンセル）が返るまでJavaScriptの実行が一時停止する、という他のAPIには無い特殊な性質を持ちますが、削除確認のような「その場で答えを待つ」用途には、この同期性がむしろ都合よく働きます。

### 削除前に件数を確認する2本のGET

確認メッセージに含めるカード件数は、削除ボタンが押されたその瞬間に、非アーカイブ・アーカイブ済みの両方を`Promise.all`で並列取得して合算しています。

```tsx
const [active, archived] = await Promise.all([
  fetchJson<CardResponse[]>(apiPaths.cards({ boardId: board.id, archived: false }), controller.signal),
  fetchJson<CardResponse[]>(apiPaths.cards({ boardId: board.id, archived: true }), controller.signal),
])
```

アーカイブ済みのカードも物理削除の対象になる（[docs/spring-boot 41章](../spring-boot/11-delete-api.md#41-物理削除とdbレベルのon-delete-cascade)のカスケード削除に、非アーカイブ／アーカイブ済みという区別はありません）ため、非アーカイブだけを数えると実際に消える件数を過少に伝えてしまいます。この件数取得が失敗した場合も、削除操作自体はブロックしません。件数が分からないだけの汎用的な確認文へフォールバックします。「確認メッセージの精度を上げるための付加的なGET」が失敗しただけで、本来できるはずの削除ができなくなるのは本末転倒だという判断です。

### `useMutation`ではなく`useDelete`という別のフック

`hooks/useMutation.ts`（[19章](./08-form-and-mutation.md#19-書き込みpostとデータの更新)）はPOST/PUT/PATCHを対象にしており、「成功時はレスポンスのJSON、失敗時は`null`」という約束の上に成り立っています。DELETEはリクエストボディを送らず、成功時のレスポンス（204 No Content）にも本文がありません。「成功を表す値」自体が存在しないため、`useMutation`の「`null`かどうかで成否を区別する」という設計をそのまま使うことができません。

```ts
export function useDelete(path: string): UseDeleteResult {
  // ...
  const remove = useCallback(async (): Promise<boolean> => {
    setSubmitting(true)
    setError(null)
    try {
      await deleteRequest(path)
      return true
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new Error(String(cause)))
      return false
    } finally {
      setSubmitting(false)
    }
  }, [path])

  return { remove, submitting, error }
}
```

`submitting`・`error`の骨格は`useMutation`と同じですが、成否を`TResponse | null`ではなく`boolean`で表す専用のフックとして分けています。

### 204 No Contentを受け取る側の対応

`api/client.ts`の共通リクエスト処理は、`response.json()`を呼ぶ前にステータスコードを見ています。

```ts
if (response.status === 204) return undefined as T
```

DELETE成功時のレスポンスには本文が無いため、空の本文に対して`response.json()`を呼ぶとJSONとしてパースできず例外になります（[docs/spring-boot 40章](../spring-boot/11-delete-api.md#40-削除apideleteと204-no-content)参照）。バックエンドが「本文の無いレスポンス」を返す設計を選んだ以上、フロントエンド側にもそれを前提とした分岐が必要になります。

### 削除の影響範囲：`refetchBoards`だけでは足りない

ボード一覧の再取得（`refetchBoards`）だけでは、削除の影響を画面全体に行き渡らせるには不十分です。考慮すべきことが2つあります。

**1. 削除したボードの詳細画面を、まさに表示中だったかもしれない**

```tsx
const boardDetailMatch = useMatch('/boards/:boardId')

function handleBoardDeleted(deletedBoardId: number) {
  if (boardDetailMatch !== null && boardDetailMatch.params.boardId === String(deletedBoardId)) {
    navigate('/')
  }
  refetchBoards()
  setDataVersion((version) => version + 1)
}
```

`components/BoardSelect.tsx`（[14章](./05-router.md#14-urlを状態の置き場所にする)）が選択状態の判定に使っているのと同じ`useMatch`で、「今表示しているボード詳細のURLが、削除したボードのものと一致するか」を判定します。一致していれば、存在しなくなったボードの詳細画面に取り残されないよう、横断ビュー（`/`）へ`navigate`します。

**2. 他の画面が持つカード一覧は、`App`から直接は触れない**

横断ビュー・アーカイブ画面・検索画面は、それぞれ自分自身の`useApi`でカード一覧を取得しています（[11章](./04-custom-hooks.md#11-データ取得の3状態とレースコンディション)）。`App`はこれらのページの内部状態を持っていないため、`refetch`を直接呼び出すことができません。ボードを削除すると、そのボードに属していたカードもDB側でカスケード削除されますが（[docs/spring-boot 41章](../spring-boot/11-delete-api.md#41-物理削除とdbレベルのon-delete-cascade)）、何もしなければ「もう存在しないはずのカードが、開いたままの画面には残り続ける」ことになります。

```tsx
const [dataVersion, setDataVersion] = useState(0)
// ...
<Routes key={dataVersion}>
```

ここで使っているのが、Reactの`key`props（[5章](./02-component-jsx.md#5-条件付きレンダリングとリスト描画key)でリストの各要素に付けていたのと同じ仕組み）です。`key`が変わると、Reactはその要素を「同じコンポーネントの更新」ではなく「別のインスタンス」とみなし、古い方をアンマウントしてから新しく作り直します。`<Routes>`という、ページ全体を包む要素に`key={dataVersion}`を渡すことで、`dataVersion`が変化するたびに現在表示中のページ（`CrossBoardView`等）が丸ごと作り直されます。その内部にある`useApi`は初期化からやり直されるため、GETが最初から発行され、サーバー側の最新状態（＝カードが消えた状態）に自然と揃います。

削除以外の操作では`dataVersion`を変えないため、通常のページ遷移や再レンダリングでは今まで通りアンマウントされません。「個々のページに`refetch`を伝える手段を1つずつ作り込む」代わりに、「ページ全体を作り直せば、各ページが持つ`useApi`は自分で正しく動く」という、既存の仕組み（`key`によるアンマウント／`useApi`の自己完結した取得ロジック）の組み合わせだけで解決している点が、この設計のポイントです。

📄 実装：`frontend/src/App.tsx`、`frontend/src/hooks/useDelete.ts`、`frontend/src/components/SortableBoardRow.tsx`、`frontend/src/api/client.ts`

---

*本ドキュメントは開発と並行して育てていく学習ノートです。実装で分からないReactの概念が出てきたら、まずここに解説がないか確認し、無ければ追記してください。*
