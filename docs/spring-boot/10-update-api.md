# 更新系API（PUT/PATCH）

[← 学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **33〜39章** をまとめています。

---

## 33. 更新系API（PUT/PATCH）の作り方

これまでのController（[21章](./06-service-controller.md#21-controller層とrest-api)・[28章](./09-write-api-validation.md#28-登録系apipostの作り方)）は`@GetMapping`と`@PostMapping`のみでした。カードの更新（要件定義5.2・5.3）にあわせて、本プロジェクト初の`@PutMapping`・`@PatchMapping`が登場します。

```java
@PutMapping("/{id}")
public CardResponse update(@PathVariable Integer id, @Valid @RequestBody CardUpdateRequest request) {
	return cardService.update(id, request);
}

@PatchMapping("/{id}/status")
public CardResponse updateStatus(@PathVariable Integer id, @Valid @RequestBody CardStatusUpdateRequest request) {
	return cardService.updateStatus(id, request);
}
```

### なぜ2本に分けたのか——PUTとPATCHの使い分け

HTTPの仕様上、PUTは「リソース**全体**を置き換える」ことを、PATCHは「リソースの**一部**だけを変更する」ことを表すメソッドとされています。カードの更新には性質の異なる2つの操作があり、この違いをそのままAPI設計に反映しました。

| | `PUT /api/cards/{id}` | `PATCH /api/cards/{id}/status` |
| --- | --- | --- |
| 担当する属性 | タイトル・説明・期日・ラベル | ステータス・列内の並び順（`position`） |
| リクエストDTO | `CardUpdateRequest` | `CardStatusUpdateRequest` |
| 操作の性格 | フォームに入力し「保存」ボタンで確定する編集 | ドラッグ＆ドロップ・「移動」メニュー・カード詳細のセレクトボックスによる、即座に反映される変更 |
| 呼び出し元 | `CardDetailModal`の保存処理 | `CardDetailModal`のステータス選択・`CardItem`の移動メニュー・ドラッグ＆ドロップ |

もし両方を1本の`PUT`にまとめると、ドラッグ＆ドロップで列を移動させるたびに、画面が保持しているタイトル・説明・期日・ラベルをすべて送り直す必要が生じます。それ自体は動きますが、「ステータスだけを動かしたい」という操作の意図と、実際に送信するデータの範囲が一致しません。逆に`CardUpdateRequest`が`status`を持たないのは、[29章](./09-write-api-validation.md#29-リクエストdtoとbean-validation)で見た「1つのDTOには1つの操作の入力だけを持たせる」という設計方針を踏襲したものです。

### 戻り値：ここでも`ResponseEntity`は使わない

[28章](./09-write-api-validation.md#28-登録系apipostの作り方)ではPOSTが201 Created + `Location`ヘッダーを返すために`ResponseEntity<CardResponse>`を使いました。PUT・PATCHはどちらも素の`CardResponse`を返しています。

```java
public CardResponse update(@PathVariable Integer id, @Valid @RequestBody CardUpdateRequest request) {
```

新しいリソース（新しいURL）を作るわけではないので、201も`Location`も不要です。更新後の状態を200 OKでそのまま返せば十分であり、GET系メソッドと同じ「素の型を返す」形に戻ります。「レスポンスに特別な情報を足す必要があるときだけ`ResponseEntity`を使う」という判断基準が、POSTとPUT/PATCHの違いとして表れています。

---

## 34. ダーティチェックによる更新

`CardService.create`（[31章](./09-write-api-validation.md#31-登録処理の中身)）は、組み立てた新しい`Card`エンティティを`cardRepository.save(card)`で明示的に保存していました。一方、`update`メソッドにはこの`save()`の呼び出しがありません。

```java
@Transactional
public CardResponse update(Integer id, CardUpdateRequest request) {
	Card card = cardRepository.findByIdWithBoard(id)
			.orElseThrow(() -> new ResourceNotFoundException("カードが見つかりません（id=" + id + "）"));

	// ...正規化・ラベル検証...

	card.setTitle(title);
	card.setDescription(description);
	card.setDueDate(request.dueDate());
	// card.save(card) は呼ばない

	// ...
}
```

`findByIdWithBoard`が返す`card`は、このメソッドが実行されているトランザクション（`@Transactional`）の**永続化コンテキスト**に乗っている、Hibernate管理下のエンティティです。永続化コンテキストは「取得した時点の値」を内部に記憶しており、トランザクションがコミットされる直前（フラッシュ時）に、記憶していた値と現在のフィールドの値を比較します。差分があるフィールドが1つでもあれば、そのエンティティに対応するUPDATE文を自動的に発行します。この仕組みを**ダーティチェック**（dirty checking。「汚れている＝変更されている」ものを検出する、の意）と呼びます。

```sql
-- Hibernateが自動的に発行するUPDATE文の例（実際のログより）
update card set description=?, due_date=?, title=?, updated_at=? where id=?
```

`create`で`save()`が必要だったのは、`new Card()`で作った**まだ永続化コンテキストに存在しないエンティティ**を、そこへ加える（persistする）操作そのものが必要だったからです。`update`では、その前段の`findByIdWithBoard`が既にエンティティを永続化コンテキストに乗せてくれているため、setterで値を書き換えるだけで十分です。「INSERTするために保存を明示的に呼ぶ」POSTと、「取得済みのものをそのまま書き換えるとコミット時に自動でUPDATEされる」PUT/PATCHとで、必要なコードの形が変わるのはこのためです。

### `@UpdateTimestamp`が実際に動き出す

`Card`エンティティの`updatedAt`フィールドには、[31章](./09-write-api-validation.md#31-登録処理の中身)の時点で既に`@UpdateTimestamp`が付いていました。

```java
@Column(name = "updated_at", nullable = false)
@ColumnDefault("now()")
@UpdateTimestamp
private OffsetDateTime updatedAt;
```

このアノテーションはINSERT時にもUPDATE時にも値をセットし直しますが、更新系APIが存在しなかった間は「UPDATE時」が実際に発生する経路が無く、事実上INSERT専用と変わりませんでした。`update`・`updateStatus`が実装されたことで、ダーティチェックによるUPDATE発行のたびに`@UpdateTimestamp`が現在時刻を採番し直すようになり、ようやく「作成時刻は不変・更新時刻は変更のたびに動く」という本来の役割分担が意味を持つようになりました。

---

## 35. コレクションの差し替え——ラベルの全削除＋再作成

カード編集ではラベルの付与内容も変更できます。`create`（[31章](./09-write-api-validation.md#31-登録処理の中身)）は「まだ何も紐付いていないカード」に対して`card_label`行をINSERTするだけでしたが、`update`は「既に紐付いているかもしれない」カードが相手になるため、単純な追加では済みません。

```java
cardLabelRepository.deleteByCardId(id);
if (!labels.isEmpty()) {
	List<CardLabel> cardLabels = labels.stream()
			.map(label -> {
				CardLabel cardLabel = new CardLabel();
				cardLabel.setCard(card);
				cardLabel.setLabel(label);
				return cardLabel;
			})
			.toList();
	cardLabelRepository.saveAll(cardLabels);
}
```

採用したのは「今の付与内容を全部消してから、選ばれているものを丸ごと入れ直す」という単純な方針です。「今のcard_label行と新しいlabelIdsを見比べて、外れた分だけDELETE・増えた分だけINSERT」という差分計算も可能ですが、1枚のカードに付くラベルは要件上せいぜい数枚程度であり、差分を求めるコードの複雑さに見合いません。

### `deleteByCardId`——派生クエリではなく`@Modifying`を選んだ理由

```java
@Modifying
@Query("delete from CardLabel cl where cl.id.cardId = :cardId")
void deleteByCardId(@Param("cardId") Integer cardId);
```

[18章](./05-repository.md#18-クエリメソッドメソッド名からのクエリ自動生成)で見たメソッド名からの自動生成は、削除にも使えます（`deleteByIdCardId(Integer cardId)`のような命名）。ただしSpring Data JPAは、この形の削除メソッドを「対象行をまずSELECTで読み込み、1行ずつ`EntityManager.remove()`を呼ぶ」という実装に変換します。対象がN件あれば、SELECT 1回＋DELETE N回のSQLが発行されることになります。

`@Modifying`を付けた`@Query`は、これとは別の経路です。JPQLの`delete`文をそのまま**一括DELETE**としてDBへ送るため、対象件数によらずSQL1本で完結します。`CardLabel`は他のエンティティからJPAレベルでの連鎖的な永続化操作（カスケード）を受けない中間テーブルの行であり、読み込みを経由せず一括削除しても永続化コンテキストとの整合性が崩れる心配がないため、こちらを選びました。[24章](./07-jpa-performance.md#24-n1問題とその回避)で読み取り側について学んだ「SQLの発行回数を数える」意識を、ここでは書き込み側にも適用しています。

### 削除と再作成の順序

`@Modifying`な`@Query`は、呼び出された時点で**即座に**DELETE文をDBへ送信します。`create`のコメントで説明したような「永続化コンテキストに保留され、フラッシュ時にまとめて実行される」INSERT/UPDATEとは異なる経路です。そのため`deleteByCardId(id)`の直後に`saveAll(cardLabels)`を呼んでも、削除は既に完了しており、以前と同じラベルIDを選び直した場合でも複合主キーの一意制約違反にはなりません。「削除は即座・追加は遅延」という2つの異なるタイミングが1つのメソッドの中に同居している点は、意識しておく価値があります。

---

## 36. ステータス変更と列内の並び替え

`PATCH /api/cards/{id}/status`は、ステータスの変更だけでなく、同一列内でのドラッグによる並び替え（要件5.3「同一ステータス内での並び順…を保持する」）も担当します。

```java
List<Card> destinationColumn =
		cardRepository.findByBoardIdAndStatusAndIsArchivedFalseOrderByPositionAscIdAsc(boardId, newStatus);

destinationColumn.removeIf(c -> c.getId().equals(card.getId()));

int insertIndex = request.position() == null
		? destinationColumn.size()
		: Math.min(request.position(), destinationColumn.size());
destinationColumn.add(insertIndex, card);

for (int i = 0; i < destinationColumn.size(); i++) {
	destinationColumn.get(i).setPosition(i + 1);
}
card.setStatus(newStatus);
```

### 「対象カードのpositionだけ書き換える」のではなく、列全体を振り直す

一見、動かしたいカード1枚の`position`を挿入先の値に書き換えるだけで済みそうに思えます。しかし同じ列に既に並んでいる他のカードのpositionは変わらないままなので、挿入位置によっては複数のカードが同じposition値を持つことになり、順序が一意に定まらなくなります。ここでは移動先列に並ぶカード全員（対象カードを含む）を正しい順序でJavaの`List`に並べ直したうえで、`for`ループで**1から連番に振り直す**ことで、常に重複のない一意な順序を保証しています。

`destinationColumn`は`findByBoardIdAndStatusAndIsArchivedFalseOrderByPositionAscIdAsc`が返した、永続化コンテキストに乗っている`Card`のリストです。[34章](#34-ダーティチェックによる更新)のダーティチェックはリスト全体の各要素に対しても働くため、`setPosition(i + 1)`で書き換えた分だけ、コミット時にそれぞれ独立したUPDATE文が発行されます（値が変わらなかったカードにはUPDATE文自体が発行されません。ダーティチェックは「差分があるフィールドだけ」を見るためです）。

### 列間移動と列内並べ替えを1本のロジックで扱う

`destinationColumn.removeIf(...)`は、「同じ列の中で並べ替える」場合にだけ意味を持ちます。対象カードが既に新しいステータスの列に含まれている（＝同じ列内での移動である）場合、そのカードをいったん取り除いてから、決まった挿入位置へ改めて差し込みます。列をまたぐ移動（対象カードがまだ旧ステータスのまま）では、`destinationColumn`にそもそも対象カードが含まれていないため、この`removeIf`は何もしない`no-op`になります。1つの実装が「列間の移動」と「列内の並べ替え」という要件5.3の2つの受け入れ条件を同時に満たしているのは、この分岐を作らない工夫によるものです。

### 移動元の列は詰め直さない

対象カードが抜けた後の旧ステータス列は、positionを詰め直しません。例えば`1, 2, 3, 4`という並びから3番目のカードが抜けても、残りは`1, 2, 4`のままにします。position値に欠番ができますが、「昇順に並べたときの順序」自体は崩れないため、表示上の実害はありません。次にその列で何らかの並べ替えが発生すれば、このメソッドが列全体を1から振り直すため、欠番は自然に解消されます。「今すぐ完璧な連番を保つ」より「次に触ったときに正しくなればよい」という割り切りは、[31章](./09-write-api-validation.md#31-登録処理の中身)のposition採番が抱えるレースコンディションを許容する判断と同じ性格のものです。

### なぜ「画面に見えている並び」を母集団にするのか

移動先列の取得は、アーカイブ済みカードを除外した`findByBoardIdAndStatusAndIsArchivedFalseOrderByPositionAscIdAsc`を使います。[31章](./09-write-api-validation.md#31-登録処理の中身)の`findMaxPosition`はアーカイブ済みも母集団に含めていましたが、こちらは目的が異なります。`findMaxPosition`は「これまでに採番された値と重複しない新しい値」を知りたいだけですが、`updateStatus`が受け取る`position`（挿入位置のインデックス）は、**フロントエンドの画面に実際に見えているカードの並び**（＝`archived=false`のもの）を指しています。アーカイブ済みカードをここで混ぜてしまうと、同じインデックス値でも指し示す相手がずれてしまいます。同じ「position」という言葉を扱う2つのクエリが、それぞれ異なる母集団を選んでいる理由はここにあります。

---

## 37. CORSへの追記

[27章](./08-configuration-cors.md#27-corsとフロントエンドとの接続)で見た`CorsConfig`は、実装済みのHTTPメソッドだけを`allowedMethods`に列挙する方針でした。PUT・PATCHを実装したことで、この1行も更新が必要です。

```java
.allowedMethods("GET", "POST", "PUT", "PATCH")
```

DELETE（完全削除機能）はまだ実装していないため、引き続きここには加えていません（アーカイブは後述のとおりPATCHで実装したため、この行の更新は不要でした）。「このAPIに今どんな操作ができるか」を`allowedMethods`という1行の正直な写しに保つという、POST追加時と変わらない方針です。この行を更新し忘れると、`update`・`updateStatus`自体はバックエンド単体では正しく動いていても、ブラウザ（フロントエンド）からのPUT/PATCHリクエストだけがCORSエラーで拒否されるという、`curl`では再現できずブラウザのDevToolsでしか気づけない不具合になります。

---

## 38. アーカイブ：フラグ更新と冪等性

要件定義5.7「完了したカードを削除せずに退避する」は、`status`に4つ目の値（例えば`"archived"`）を追加するのではなく、`Card`が最初から持っていた`isArchived`という**独立したboolean列**で表現します。

```java
@PatchMapping("/{id}/archive")
public CardResponse updateArchived(@PathVariable Integer id, @Valid @RequestBody CardArchiveUpdateRequest request) {
	return cardService.updateArchived(id, request);
}
```

### なぜ`status`の4値目にしなかったのか

`status`に`"archived"`を追加する設計も一見成立しそうですが、そうすると「アーカイブされている間、元々どの列にいたか」という情報が失われます。要件5.7は「アーカイブ一覧から、カードを**元のステータスへ**『復元』できる」と定めており、元の列を覚えておく必要があります。`isArchived`を`status`とは別の軸にしておけば、アーカイブ中も`status`列の値（`todo`/`doing`/`done`）をそのまま保持でき、復元時は`isArchived`をfalseに戻すだけで元の列に戻せます。[36章](#36-ステータス変更と列内の並び替え)で見た`ALLOWED_STATUSES`やDBの`@Check`制約（3値固定）に一切手を入れずに済むのも、この設計を選んだ利点です。

### アーカイブ可能な条件を検証する

要件定義5.7は「完了したカードを削除せずに退避する」機能として、アーカイブできる対象を「完了」列のカードだけに限定しています。この制約は`CardArchiveUpdateRequest`のBean Validationでは表現できません（`archived`は単なる`Boolean`であり、対象カードの`status`と組み合わせて判断する必要があるため）。[32章](./09-write-api-validation.md#32-アプリケーション層での重複許可値チェック)のラベル色チェックと同じく、Service層で明示的に検証します。

```java
if (archived) {
	if (!"done".equals(card.getStatus())) {
		throw new InvalidRequestException("完了ステータスのカードのみアーカイブできます");
	}
	card.setIsArchived(true);
} else {
	// ...復元処理...
}
```

この`if`が`archived`（＝アーカイブする方向）のときにしか出てこないのは、復元（`archived == false`）には対応する制約が無いためです。アーカイブ処理が`status`を一切変更しない（前節参照）ことにより、アーカイブされているカードの`status`は必ず`"done"`のまま保たれます。したがって「アーカイブされているカードを復元してよいか」を判定するための追加チェックはそもそも不要で、復元は常に許可されます。

フロントエンド（`components/CardDetailModal.tsx`）側でも同じ条件でボタンを`disabled`にしていますが、これはサーバーへの無駄なリクエストを防ぐための先回りに過ぎず、実際の業務ルールの検証はこのService層が最終的な砦です。フォームの`disabled`→Bean Validation→アプリ層チェックという多層防御の考え方は[29章](./09-write-api-validation.md#29-リクエストdtoとbean-validation)と同じです。

### 状態遷移の冪等性

`updateStatus`（36章）は、指定された`status`が3値のいずれでもなければ400エラーを返しました。一方`updateArchived`のリクエストDTOは`Boolean`1つだけで、`true`/`false`以外の値を送ること自体がJSONのレベルであり得ないため、「値として不正」というエラーは発生しません。代わりに考慮したのが、**既に同じ状態への変更が重複して届いたときの振る舞い**です。

```java
if (card.getIsArchived().equals(archived)) {
	return toResponses(List.of(card)).get(0);
}
```

カード詳細モーダルの「アーカイブ」ボタンを連打したり、ネットワークの再送で同じリクエストが2回届いたりしても、2回目以降は何も変更せず現在の状態をそのまま200で返します。「既にアーカイブ済みのカードをもう一度アーカイブする」ことをエラーとして扱わないのは、このAPIが「アーカイブする/しないを指定する」という**結果指向**の操作であり、「まだアーカイブされていないカードだけを対象にした手続き」ではないためです。この考え方はHTTPのPUT/PATCHが一般に持つ「同じリクエストを何度送っても結果が変わらない」という冪等性の性質にも合致します。

### 復元時だけpositionを採番し直す理由

```java
} else {
	Integer boardId = card.getBoard().getId();
	card.setPosition(cardRepository.findMaxPosition(boardId, card.getStatus()) + 1);
	card.setIsArchived(false);
}
```

アーカイブする側（`true`にする側）は`status`・`position`のどちらにも触れません。[36章](#36-ステータス変更と列内の並び替え)の「移動元の列は詰め直さない」という判断と同じく、抜けた列に欠番ができてもその列を次に並べ替えたときに自然と解消されるためです。

一方、復元する側（`false`に戻す側）は`position`を`findMaxPosition(boardId, status) + 1`で**採番し直します**。アーカイブされている間に元の列が並べ替えられていると、保持していたposition値が既に他のカードに使われてしまっている可能性があるためです（保持したままにすると、同じ列に同じposition値を持つカードが2枚できてしまいます）。[31章](./09-write-api-validation.md#31-登録処理の中身)で見た`create`の採番と同じ式を使っているのはこのためで、`findMaxPosition`がアーカイブ済みカードも母集団に含めている（[36章](#36-ステータス変更と列内の並び替え)末尾の対比を参照）ことも、この計算が正しく機能する前提になっています。結果として、復元されたカードは元にいた場所ではなく、常にその列の**末尾**に置かれます。要件5.7が求めているのは「元のステータス列に戻ること」であり、列内の元の位置までの厳密な復元は求めていないため、これで受け入れ条件を満たします。

📄 実装：`backend/.../controller/CardController.java`の`updateArchived`、`backend/.../service/CardService.java`の`updateArchived`

---

## 39. ボードの改名と並べ替え

ボード管理モーダル（要件定義5.1・6.2②）の改名・並べ替えも、ここまでの章で学んだ「更新系API」のパターンをそのまま適用したものです。新しい仕組みは登場せず、既存の考え方をどう再利用したかを整理します。

```java
@PutMapping("/{id}")
public BoardResponse update(@PathVariable Integer id, @Valid @RequestBody BoardUpdateRequest request) {
	return boardService.update(id, request);
}

@PatchMapping("/{id}/position")
public BoardResponse updatePosition(
		@PathVariable Integer id, @Valid @RequestBody BoardPositionUpdateRequest request) {
	return boardService.updatePosition(id, request);
}
```

### 改名：34章のダーティチェックをそのまま使う

`BoardService.update`は、`CardService.update`（[34章](#34-ダーティチェックによる更新)）と全く同じ形です。

```java
@Transactional
public BoardResponse update(Integer id, BoardUpdateRequest request) {
	Board board = boardRepository.findById(id)
			.orElseThrow(() -> new ResourceNotFoundException("ボードが見つかりません（id=" + id + "）"));
	board.setName(request.name().trim());
	return toResponse(board);
}
```

`findById`で取得した`board`は既に永続化コンテキストに乗っているため、`setName`で値を書き換えるだけでよく、`save()`の明示呼び出しは不要です。カードの`update`が「タイトル・説明・期日・ラベル」という複数の属性を一度に扱っていたのに対し、こちらは`name`1つだけなので、本体はさらに単純になっています。

### 並べ替え：36章との違いは「区分が無いこと」

`BoardService.updatePosition`は、`CardService.updateStatus`（[36章](#36-ステータス変更と列内の並び替え)）の「対象を取り除く→挿し込む→列全体を1から振り直す」という手順をそのまま踏襲しています。

```java
List<Board> ordered = new ArrayList<>(boardRepository.findAllByOrderByPositionAscIdAsc());
ordered.removeIf(b -> b.getId().equals(board.getId()));

int insertIndex = Math.min(request.position(), ordered.size());
ordered.add(insertIndex, board);

for (int i = 0; i < ordered.size(); i++) {
	ordered.get(i).setPosition(i + 1);
}
```

大きな違いは、カードにあった「ステータス」「アーカイブ済みかどうか」という**区分**が、ボードには存在しないことです。カードの`updateStatus`は「移動先の列（ボード×ステータス）」という部分集合を対象に振り直しましたが、ボードは常に「全ボード」という1つのリストだけを相手にします。[36章](#36-ステータス変更と列内の並び替え)の`CardRepository`が「採番用（アーカイブ済みも含む全件、`findMaxPosition`）」と「挿入位置算出用（非アーカイブのみ、`findByBoardIdAndStatusAndIsArchivedFalseOrderByPositionAscIdAsc`）」という2つの母集団を使い分けていたのに対し、`BoardRepository.findAllByOrderByPositionAscIdAsc()`はその両方を1つのメソッドで兼ねます。区分という次元が無くなったことで、コード自体も素直になっています。

### `findAllByOrderByPositionAscIdAsc()`の戻り値をなぜコピーするのか

```java
List<Board> ordered = new ArrayList<>(boardRepository.findAllByOrderByPositionAscIdAsc());
```

Spring Data JPAのクエリメソッドが返す`List`の実装は、必ずしも`ArrayList`のような可変（`removeIf`・`add`が使える）なリストとは限りません。`new ArrayList<>(...)`でコピーを作ってから操作することで、この実装詳細に依存しない安全なコードになります。

### 必須にした`position`——`CardStatusUpdateRequest`との非対称

```java
public record BoardPositionUpdateRequest(
		@NotNull(message = "位置を指定してください")
		@PositiveOrZero(message = "位置は0以上で指定してください") Integer position) {
}
```

`CardStatusUpdateRequest.position`（[36章](#36-ステータス変更と列内の並び替え)）は`@PositiveOrZero`だけで`@NotNull`を付けず、未指定（`null`）を「列の末尾へ挿入」という意味として受け付けていました。カード詳細モーダルのステータス選択のように「位置までは意識していないが、とにかく移動させたい」という呼び出し元が存在したためです。

ボードの並べ替えには、そのような呼び出し元がありません。`⠿`のドラッグも`▲`/`▼`ボタンも、必ず「どこに挿入するか」が明確に決まった状態でリクエストを送ります。「省略時は末尾へ」という緩さを持たせる理由が無いため、`BoardPositionUpdateRequest.position`は`@NotNull`で必須にしています。同じ「並べ替えの挿入位置」という役割のフィールドでも、呼び出し元の事情によって必須/任意が変わりうる、という一例です。

### 振り直し後に欠番が残らない

[36章](#36-ステータス変更と列内の並び替え)の`updateStatus`は、移動元の列を詰め直さないため`1, 2, 4`のような欠番が残ることがありました。`updatePosition`にはそもそも「移動元列」という概念が無く、対象は常に全ボードの1リストだけです。そのリスト全体を毎回1から振り直すため、ボードの並べ替えでは欠番が生じません。

📄 実装：`backend/.../controller/BoardController.java`の`update`・`updatePosition`、`backend/.../service/BoardService.java`の`update`・`updatePosition`

---

*本ドキュメントは開発と並行して育てていく学習ノートです。実装で分からない概念が出てきたら、まずここに解説がないか確認し、無ければ追記してください。*
