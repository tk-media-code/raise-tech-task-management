# 削除API（DELETE）

[← 学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **40〜41章** をまとめています。

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

*本ドキュメントは開発と並行して育てていく学習ノートです。実装で分からない概念が出てきたら、まずここに解説がないか確認し、無ければ追記してください。*
