# 削除API（DELETE）

[← 学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **40〜42章、45章** をまとめています。

---

## 40. 削除API（DELETE）と204 No Content

ボード管理モーダルの「削除」ボタン（要件定義5.1）にあわせて、本プロジェクト初の`@DeleteMapping`が登場します。

```java
@DeleteMapping("/{id}")
@ResponseStatus(HttpStatus.NO_CONTENT)
public void delete(@PathVariable Integer id) {
	boardService.delete(id);
}
```

### なぜ戻り値が`void`なのか

これまでのGET・POST・PUT・PATCHは、いずれも「操作した後のリソースの状態」を戻り値として返していました（一覧・詳細取得はそのリソース自体、作成・更新はその結果）。DELETEは対象を消す操作であり、成功した時点でクライアントへ返すべき「リソースの表現」がそもそも存在しません。そのため戻り値の型を`void`にしています。

### `@ResponseStatus(HttpStatus.NO_CONTENT)`——204という選択

戻り値が無いメソッドをSpring MVCがそのまま処理すると、既定では200 OK（本文は空）が返ります。ここではあえて`@ResponseStatus(HttpStatus.NO_CONTENT)`を付け、204 No Contentを明示しています。204は「リクエストは成功したが、返すべき本文が無い」ことを表すステータスコードで、DELETE成功時のレスポンスとしてRESTの慣習に最も忠実です。[28章](./09-write-api-validation.md#28-登録系apipostの作り方)で見たPOSTの201 Created・[33章](./10-update-api.md#33-更新系apiputpatchの作り方)で見たPUT/PATCHの200 OKと並べると、「操作の性格に応じて返すステータスコードを選ぶ」という一貫した方針が見えてきます。

| メソッド | 返すステータス | 理由 |
| --- | --- | --- |
| POST | 201 Created | 新しいリソース（新しいURL）を作った |
| PUT / PATCH | 200 OK | 既存リソースを更新し、その結果を返す |
| DELETE | 204 No Content | リソースを消したので、返す本文が無い |

### `existsById`を先に呼ぶ理由——`deleteById`は「無かったこと」を教えてくれない

```java
@Transactional
public void delete(Integer id) {
	if (!boardRepository.existsById(id)) {
		throw new ResourceNotFoundException("ボードが見つかりません（id=" + id + "）");
	}
	boardRepository.deleteById(id);
}
```

Spring Data JPAの`deleteById`は、対象のIDが存在しない場合でも例外を投げず、何もしないまま正常終了します（内部的には「削除対象が0件だった」という扱いです）。もしこの`existsById`のチェックを省くと、存在しないIDに対するDELETEリクエストも「削除できた（実際には何も削除していない）」のと区別がつかないまま200番台のレスポンスが返ってしまい、[23章](./06-service-controller.md#23-例外処理とrestcontrolleradvice)で整備した404への変換が効かなくなります。`findById`ではなく軽量な`existsById`（存在確認だけを行うSQL）を選んでいるのは、[06-service-controller.md](./06-service-controller.md)の`findLabelsByBoardId`が採った「エンティティ自体は要らず、存在確認だけで足りる場面では`existsById`を使う」という判断基準と同じです（今回はエンティティを取得しても`delete`に使い道が無いため、なおさら`existsById`で十分です）。

### フロントエンドが204を受け取るときの注意

`fetch`のレスポンスが204のとき、本文（body）は空です。`response.json()`を空の本文に対して呼ぶと、JSONとしてパースできずに例外になります。フロントエンド側（`frontend/src/api/client.ts`）では、ステータスコードが204のときは`response.json()`を呼ばずに打ち切る分岐を入れています。バックエンドが「本文の無いレスポンス」を返す設計を選んだ以上、それを受け取るクライアント側にも対応するコードが必要になる、という一例です。

📄 実装：`backend/.../controller/BoardController.java`の`delete`、`backend/.../service/BoardService.java`の`delete`

---

## 41. 物理削除とDBレベルの`ON DELETE CASCADE`

ボードを削除すると、そのボードに属していたカード・ラベル（さらにその先の`card_label`）も同時に消える必要があります（要件定義5.1「削除時は所属するカードも削除される旨を確認する」）。この連鎖的な削除を、`BoardService.delete`のJavaコードは一切書いていません。

```java
@Transactional
public void delete(Integer id) {
	if (!boardRepository.existsById(id)) {
		throw new ResourceNotFoundException("ボードが見つかりません（id=" + id + "）");
	}
	boardRepository.deleteById(id);   // これだけ
}
```

### `Board`には`@OneToMany`が無い

`Card.board`・`Label.board`（[12章](./03-entity-jpa.md#12-リレーション関連の書き方)）は、それぞれ`@ManyToOne`で「自分がどのボードに属しているか」を持っていますが、逆向き（`Board`が「自分に属するカード一覧」を`List<Card>`として持つ）の`@OneToMany`は、`Board`エンティティに定義していません。これは意図的な設計です。もし`@OneToMany(cascade = CascadeType.REMOVE)`を`Board`に持たせれば、Java側だけで連鎖削除を表現できますが、その場合Hibernateは「削除対象のボードに属するカードを全件SELECTで読み込み、1件ずつ`DELETE`を発行する」という動き方をします。カードが多いボードほど発行されるSQLの本数が増える、[24章](./07-jpa-performance.md#24-n1問題とその回避)で見たN+1と同じ性質の問題です。

### 代わりにDBの外部キー制約へ任せる

`Card.board`・`Label.board`に付いている`@OnDelete(action = OnDeleteAction.CASCADE)`（[12章](./03-entity-jpa.md#12-リレーション関連の書き方)）は、Hibernateがテーブルを作成する際（`ddl-auto=update`）に、外部キー制約自体へ`ON DELETE CASCADE`を刻み込みます。

```sql
-- Hibernateが生成する外部キー制約の例（実際のDDLより抜粋）
alter table if exists card
	add constraint fk... foreign key (board_id) references board on delete cascade
```

この状態だと、`board`テーブルから1行DELETEするだけで、それを参照している`card`・`label`（さらにその先、`card_label`も`card`・`label`への外部キーに同じ`ON DELETE CASCADE`が付いています）の行が、**DBエンジン自身によって**連鎖的に削除されます。`boardRepository.deleteById(id)`が発行するのは`board`テーブルへのDELETE文1本だけで、それ以外のテーブルへの削除はアプリケーションのコードが命令するのではなく、DBが自分の責任で行います。

### JPAのカスケードとDBのカスケード、2つの「カスケード」

「カスケード（cascade、連鎖）」という言葉は、この文脈で2つの異なる仕組みを指すことがあり、混同しやすい点に注意してください。

| | JPAの`cascade`属性（例：`@OneToMany(cascade = CascadeType.REMOVE)`） | DBの`ON DELETE CASCADE`（`@OnDelete`） |
| --- | --- | --- |
| 誰が実行するか | Hibernate（アプリケーション側） | PostgreSQL本体（データベース側） |
| 実際に発行されるSQL | 対象件数ぶんのSELECT・DELETE | 親テーブルへのDELETE1本のみ |
| 効果が及ぶ範囲 | JPAエンティティとして永続化コンテキストに乗せて削除した場合のみ | `psql`や他のツールから直接DELETEしても効く（アプリケーションを経由しない削除にも効く） |

このプロジェクトは後者（DBレベルの`ON DELETE CASCADE`）を選んでいます。削除の実行主体をDBに寄せることで、SQLの発行本数を抑えられるだけでなく、「アプリケーションのコードを経由しない削除」に対しても連鎖削除の一貫性が保証される、という利点もあります。

### 削除後、残ったボードの`position`は詰め直さない

```java
boardRepository.deleteById(id);
// 残ったボードのpositionは詰め直さない
```

ボードを1件削除すると、残ったボードの`position`に欠番（例：`1, 3, 4`）ができることがあります。[39章](./10-update-api.md#39-ボードの改名と並べ替え)で見た「移動元列を詰め直さない」判断、[38章](./10-update-api.md#38-アーカイブフラグ更新と冪等性)で見た「アーカイブする側は`position`に触れない」判断と、根っこは同じ考え方です。`findAllByOrderByPositionAscIdAsc()`による表示順は、欠番があっても崩れません。次にボードが並べ替えられたとき（`updatePosition`）に、リスト全体が1から振り直されるため、欠番は自然に解消されます。「常に完璧な連番を保つ」のではなく、「次に触ったときに正しくなればよい」という割り切りが、更新系・削除系のAPI全体を通じて一貫しています。

📄 実装：`backend/.../entity/Card.java`・`Label.java`の`@OnDelete`、`backend/.../service/BoardService.java`の`delete`

---

## 42. 削除の可否を状態で決める——「在るか」だけでは足りないとき

アーカイブ画面の「完全削除」ボタン（要件定義5.7）にあわせて、2本目の`@DeleteMapping`（`CardController.delete`）が登場します。ボード削除と同じ形に見えますが、`CardService.delete`の中身は40章のボード削除とは異なる判断をしています。

```java
@Transactional
public void delete(Integer id) {
	Card card = cardRepository.findById(id)
			.orElseThrow(() -> new ResourceNotFoundException("カードが見つかりません（id=" + id + "）"));

	if (!card.getIsArchived()) {
		throw new InvalidRequestException("アーカイブ済みのカードのみ完全に削除できます");
	}

	cardRepository.delete(card);
}
```

### `existsById`と`findById`の分かれ目

40章のボード削除は`existsById`で足りていました。「削除してよいか」の判断材料が「そのIDの行が存在するかどうか」だけで済んだからです。カードの完全削除は「アーカイブ済みのカードのみ削除できる」（要件定義5.7）という制約があるため、`isArchived`という**行の中身**を読まないと判断できません。存在確認だけの`existsById`ではこの値を取れないので、実体を取得する`findById`を使う必要があります。「`existsById`か`findById`か」は「重いか軽いか」ではなく、「判断に行の内容が要るかどうか」で決まる、という基準です。

`findByIdWithBoard`（`update`や`updateStatus`が使っている、`board`をjoin fetchするバージョン）ではなく素の`findById`を使っているのは、`delete`が`board`を一切参照しないためです。[24章](./07-jpa-performance.md#24-n1問題とその回避)で見たfetch戦略の裏返しで、使わない関連をjoin fetchしても実行コストが増えるだけの「死に荷」になります。

### 状態による事前検証はService層——38章と同じ方針

「完全削除」ボタンはアーカイブ画面にしか置いておらず、フロントエンド側は非アーカイブのカードに対してこのボタンを表示すること自体がありません。しかしAPIとしての制約は、UIがボタンをどこに置くかとは独立にService層で持っています。これは38章で見た「完了ステータスのカードのみアーカイブできます」という検証とまったく同じ構造で、[29章](./09-write-api-validation.md#29-リクエストdtoとbean-validation)の「フォームの`disabled`→Bean Validation→DBの制約」という多重防御の考え方の一部です。UIのボタン配置はあくまで「先回りの案内」であり、制約の正本（唯一の真実）はサーバー側にある、という一貫した設計方針がここでも貫かれています。

### 400か404か409か

「アーカイブされていないカードへのDELETE」は、意味的にはHTTPステータス409 Conflict（リソースの現在の状態がリクエストと競合している）が最も近い表現です。しかし本プロジェクトの`GlobalExceptionHandler`には409用のハンドラが無く、新設は今回のスコープではありません。代わりに、同じ「状態を理由に操作を拒否する」という構造を持つ38章のアーカイブ制約が400（`InvalidRequestException`）を使っていることに揃え、こちらも400としています。同じ種類の判断には同じステータスコードを割り当てることで、APIを呼ぶ側が「400が返ってきたら業務ルール違反」と一貫して解釈できるようにする狙いです。

検証の順序にも意味があります。`findById().orElseThrow()`を先に書くことで、存在しないIDに対しては404が優先されます。もし先にアーカイブ状態をチェックしてしまうと、存在しないカードに対して「アーカイブされていません」という誤った理由の400が返りかねません。「対象が存在するか」は「その対象がどんな状態か」より手前にある、より根本的な確認です。

### 冪等性の非対称——PATCHとDELETEの違い

38章で見た`updateArchived`は、既に同じ状態（例：既にアーカイブ済みのカードを再度アーカイブしようとする）へのリクエストを200で受け入れる冪等な作りでした。一方、削除済みのカードへ再度DELETEを送ると、今度は404が返ります（1回目は204、2回目は404）。

一見矛盾するようですが、この違いは「PATCHが表しているもの」と「DELETEが表しているもの」の違いから来ています。PATCH archiveは「アーカイブされた状態にしたい」という**意図する状態**を表すリクエストであり、既にその状態ならリクエストの目的は達成済みとみなせます。対してDELETEは「このURLが指すリソースを消したい」というリクエストで、2回目の時点でそのURLが指すリソースはもう存在しません。「存在しないものを操作しようとした」という事実そのものは、意図の達成不達成とは別の話であり、404を返すことで「他の場所で既に削除されていた」ことにクライアント側が気づけるという利点もあります。

### 2つのカスケードの使い分け（41章の続き）

41章では、ボード削除がDBの`ON DELETE CASCADE`に連鎖削除を任せている設計を見ました。カードの完全削除でも同じ仕組みが使われていますが、`CardService`の中には一見矛盾するように見えるコードが同居しています。

```java
// update()：カードは残したまま、付与ラベルだけ入れ替える
cardLabelRepository.deleteByCardId(id);
// …(中略)…
cardLabelRepository.saveAll(cardLabels);
```

```java
// delete()：card_labelを明示的には消さない
cardRepository.delete(card);
```

`update`は`card_label`を明示的に`deleteByCardId`で消しているのに、`delete`は何もしていません。矛盾ではなく、**親であるcard行が消えるかどうか**で決まる使い分けです。`update`はカード自体を残したままラベルの付与だけを入れ替える操作なので、親行へのDELETEが発生せず、DBの`ON DELETE CASCADE`は発火しません。ラベルの差し替えはアプリケーションが自分で面倒を見る必要があります。一方`delete`はcard行そのものを消すため、`CardLabel.card`に付いた`@OnDelete(action = OnDeleteAction.CASCADE)`が効き、`card_label`の該当行はDBが自動的に削除します。なお、消えるのは`card_label`（カードとラベルの結び付き）だけで、`label`（ラベルそのもの）は他のカードからも参照されうる独立したリソースなので残ります。

### positionを詰め直さない理由（39章・41章の延長線）

```java
cardRepository.delete(card);
// positionは詰め直さない
```

39章・41章で見た「詰め直さない」という判断は、ここではさらに一歩踏み込んだ形で成り立ちます。アーカイブ済みのカードは、列の表示順を決める`findByBoardIdAndStatusAndIsArchivedFalseOrderByPositionAscIdAsc`（38章）の対象から、アーカイブされた時点で既に外れています。つまりこのカードを完全に削除しても、画面に表示されている列に**新たな**欠番が生まれることはありません（欠番は、アーカイブされた時点で既にできています）。「次に触ったときに正しくなればよい」という考え方を通り越して、「そもそも触る対象ではなくなっている」という状態です。

📄 実装：`backend/.../service/CardService.java`の`delete`、`backend/.../controller/CardController.java`の`delete`

---

## 45. ボード配下リソースの削除——所属確認を伴う削除

ラベル削除（`DELETE /api/boards/{boardId}/labels/{labelId}`）で、3本目の`@DeleteMapping`が登場します。40〜42章で見た2つの削除（ボード削除・カードの完全削除）のどちらとも少しずつ違う、新しい形の判断が必要になります。

```java
@Transactional
public void deleteLabel(Integer boardId, Integer labelId) {
	if (!labelRepository.existsByBoardIdAndId(boardId, labelId)) {
		throw new ResourceNotFoundException(
				"ラベルが見つかりません（boardId=" + boardId + ", id=" + labelId + "）");
	}
	labelRepository.deleteById(labelId);
}
```

### 40章・42章のハイブリッド

40章のボード削除は`existsById(id)`という「そのIDが存在するか」だけの確認で足りました。URLが`/api/boards/{id}`で、対象を一意に決める手がかりが`id`1つしか無いためです。一方、ラベルのURLは`/api/boards/{boardId}/labels/{labelId}`と、パス変数を2つ持ちます。ここで`labelRepository.existsById(labelId)`（`boardId`を見ない）だけを確認してしまうと、「実在はするが、指定したボードには属していない他ボードのラベルID」を渡された場合でも削除が成立してしまい、URLの`{boardId}`部分が何の意味も持たなくなってしまいます。

そこで使うのが`existsByBoardIdAndId(boardId, labelId)`（`LabelRepository`）です。これは18章のクエリメソッドの応用で、`board_id = ? and id = ?`という2条件のAND検索を、メソッド名だけで組み立てています。`findByBoardIdAndIdIn`（32章、カード新規作成時のラベルID検証）が「一覧を取得してJava側で件数を比較する」ことで同じ種類の不整合（他ボードのIDの紛れ込み）を検出していたのに対し、こちらは1件の存在確認で済むぶん`existsByBoardIdAndName`（32章）と同じ「軽量な確認で足りる」パターンに当てはまります。

「行の中身を読む必要が無いので`existsById`系で足りる」という判断基準そのものは40章と同じですが、確認する条件が`id`単独ではなく`(boardId, id)`の組になっている点が、42章で見た「もう一段深い判断が必要になる」という構造と重なります。42章はその一段深さを`isArchived`という**行の値**で表現していましたが、ここでは**所属関係**（このラベルは本当にこのボードのものか）で表現している、という違いです。

### 使用中のラベルも削除できる——42章とは逆の判断

42章のカード完全削除は「アーカイブ済みのカードのみ削除できる」という状態による制限がありました。ラベル削除にはこの種の制限を設けていません。カードに付与済み（使用中）のラベルであっても、そのまま削除できます。これは実装上の制約ではなく、意図的な仕様判断です（要件定義5.5）。削除すると、そのラベルが付いていた**すべての**カードから、41章で見たDBの`ON DELETE CASCADE`によって自動的に外れます。

```java
labelRepository.deleteById(labelId);
// card_label行はここで明示的に削除しない。Label.board・CardLabel.label双方に付いた
// @OnDelete(CASCADE)によりDB側の外部キー制約で連鎖削除されるため。
```

41章のボード削除・42章のカード完全削除に続く3例目の「カスケードはDBに任せる」実装です。`Label`はボード単位で複数のカードから共有される独立したリソースであるため、削除の影響範囲（何枚のカードから外れるか）はカードごとに異なります。この「影響範囲がリクエストの時点では分からない」という性質のため、フロントエンド側は削除を実行する前に`GET /api/cards?labelIds={labelId}`で該当カードを数え、確認UIに件数を表示しています（`frontend/src/components/LabelPicker.tsx`の`countCardsForLabel`。実装は[docs/react/11-card-deletion.md](../react/11-card-deletion.md)参照）。バックエンド側のレスポンス（`LabelResponse`）に件数フィールドを持たせる案もありましたが、カード1件を表示するたびに毎回集計が走る`CardResponse.labels`側のマッピング処理を汚さずに済むよう、件数取得は削除確認という低頻度な操作のためだけにフロントエンドから既存の一覧APIを呼ぶ形にしています。

### `LabelController`を新設しない理由

`GET /api/boards/{id}/labels`・`POST /api/boards/{id}/labels`（32章）は`BoardController`に実装されており、`DELETE /api/boards/{id}/labels/{labelId}`もここに追加しました。ラベルは`Label`という独立したエンティティですが、常に「あるボードに属するリソース」としてのみ存在し、`/api/labels/{id}`のような単独のURLは用意していません（22章で見たDTOと同じく、URLの形もリソースの所属関係を表しています）。この非対称性——ボードは`/api/boards/{id}`で単独アクセスできるのに、ラベルは必ず`/api/boards/{boardId}/labels/{labelId}`という親子構造の中でしかアクセスできない——は、「ラベルはボードという文脈が無ければ意味を持たない」という業務上の性質をそのままURL設計に反映した結果です。

📄 実装：`backend/.../repository/LabelRepository.java`の`existsByBoardIdAndId`、`backend/.../service/BoardService.java`の`deleteLabel`、`backend/.../controller/BoardController.java`の`deleteLabel`

---

*本ドキュメントは開発と並行して育てていく学習ノートです。実装で分からない概念が出てきたら、まずここに解説がないか確認し、無ければ追記してください。*
