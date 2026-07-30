# 更新系API（PUT/PATCH）

[← 学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **33〜37章** をまとめています。

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

DELETE（アーカイブ・削除機能）はまだ実装していないため、引き続きここには加えていません。「このAPIに今どんな操作ができるか」を`allowedMethods`という1行の正直な写しに保つという、POST追加時と変わらない方針です。この行を更新し忘れると、`update`・`updateStatus`自体はバックエンド単体では正しく動いていても、ブラウザ（フロントエンド）からのPUT/PATCHリクエストだけがCORSエラーで拒否されるという、`curl`では再現できずブラウザのDevToolsでしか気づけない不具合になります。

---

*本ドキュメントは開発と並行して育てていく学習ノートです。実装で分からない概念が出てきたら、まずここに解説がないか確認し、無ければ追記してください。*
