# Repository層

[← 学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **17〜19章** をまとめています。

---

## 17. Repository層とSpring Data JPA

> **Repositoryとは？**
> データベースへのアクセス（検索・登録・更新・削除）を担う層です。[2章](./01-architecture.md#2-レイヤードアーキテクチャ)のレイヤードアーキテクチャで見た「Repository層」が、ここで初めて実装されます。

Spring Data JPAでは、Repositoryを**インターフェースとして宣言するだけ**で、実装クラスをSpring Data JPAが起動時に自動生成してくれます。本プロジェクトの`BoardRepository`を教材にします。

```java
public interface BoardRepository extends JpaRepository<Board, Integer> {

	List<Board> findAllByOrderByPositionAscIdAsc();
}
```

| 要素 | 意味 |
| --- | --- |
| `interface BoardRepository` | クラスではなく**インターフェース**として宣言する。中身（実装）を自分で書く必要がない |
| `extends JpaRepository<Board, Integer>` | 「対象のエンティティは`Board`、その主キーの型は`Integer`」という2つの型引数を指定する。これだけで`findById`・`findAll`・`save`・`deleteById`・`existsById`・`count`といった基本的なCRUDメソッドが**実装なしで**使えるようになる |
| `@Repository`を書いていない | Spring Data JPAが`JpaRepository`を継承したインターフェースを自動的に見つけ、コンポーネントスキャン（[4章](./01-architecture.md#4-アプリケーションの起動の仕組み)）の対象として登録してくれるため、明示的なアノテーションは不要 |

実装クラスの正体は、アプリ起動時にSpring Data JPAが動的に生成する**プロキシ**（インターフェースを実装したダミーの実体）です。`BoardService`（[20章](./06-service-controller.md#20-service層とtransactional)）はこのプロキシをDIで受け取り、実際にJPAが書かれたSQL相当の処理を呼び出す、という形になります。

> **Laravelとの対比**
> LaravelのEloquentモデルは「データの形」と「データアクセス」を1つのクラス（`Board::all()`のように）が兼ねますが、Spring Data JPAでは[10章](./03-entity-jpa.md#10-jpahibernateormとは)のEntity（データの形）とRepository（データアクセス）が別クラスに分かれます。またEloquentは実装済みのクラスをそのまま使うのに対し、Spring Data JPAは「インターフェースだけ書けば実装はフレームワークが自動生成する」という、Javaらしい型ベースの自動化がされている点が特徴的です。

---

## 18. クエリメソッド（メソッド名からのクエリ自動生成）

`findAllByOrderByPositionAscIdAsc()`のように、**メソッド名そのものから**Spring Data JPAがクエリを組み立てる仕組みを「クエリメソッド」と呼びます。本プロジェクトでは`BoardRepository`と`LabelRepository`で使っています。

```java
// BoardRepository
List<Board> findAllByOrderByPositionAscIdAsc();

// LabelRepository
List<Label> findByBoardIdOrderByIdAsc(Integer boardId);
```

メソッド名は次のように機械的に分解されます。

| メソッド名の断片 | 意味 |
| --- | --- |
| `findAllBy` / `findBy` | 検索処理であることを示す接頭辞 |
| `BoardId` | `Label`エンティティの`board`フィールド（[12章](./03-entity-jpa.md#12-リレーション関連の書き方)の`@ManyToOne`）の先にある`id`を辿るという意味。生成されるSQLは`label`テーブルの`board_id`列との単純な比較になり、`board`テーブルへの実際のJOINは発生しない |
| `OrderByPositionAscIdAsc` | `position`の昇順、`position`が同値の場合は`id`の昇順、という並び替え条件 |

`findByBoardIdOrderByIdAsc(Integer boardId)`は「引数`boardId`と`label.board.id`が一致する行を、`id`昇順で返す」というSQL相当の処理に変換されます。`BoardRepository.findAllByOrderByPositionAscIdAsc()`で`position`だけでなく`id`も第2ソートキーに加えているのは、`position`の値が（将来の並び替え機能の実装状況によっては）重複しうる場合に、一覧の表示順が実行のたびに揺れないようにするためです。

クエリメソッドは手軽な反面、条件が増えるほどメソッド名が長くなり読みにくくなるという限界があります。カード一覧のような「4つの条件をすべて任意で組み合わせる」検索は、この仕組みでは表現しきれません（[19章](#19-queryとjpql動的な絞り込み)）。

---

## 19. `@Query`とJPQL（動的な絞り込み）

カード一覧API（`GET /api/cards`）は、`boardId`・`archived`・`keyword`・`labelIds`という4つの条件を持ち、それぞれ「指定されていれば絞り込み、されていなければ無視する」という任意条件です。この組み合わせは18章のクエリメソッドの命名規則では表現できないため、`CardRepository.search`では`@Query`アノテーションでクエリを直接記述しています。

```java
@Query("""
		select c
		  from Card c
		  join fetch c.board b
		 where (:boardId is null or b.id = :boardId)
		   and c.isArchived = :archived
		   and (:keyword is null
		        or lower(c.title) like lower(concat('%', cast(:keyword as string), '%'))
		        or lower(c.description) like lower(concat('%', cast(:keyword as string), '%')))
		   and (:filterByLabels = false
		        or exists (select 1
		                     from CardLabel cl
		                    where cl.id.cardId = c.id
		                      and cl.id.labelId in :labelIds))
		 order by b.position asc,
		          b.id asc,
		          case c.status when 'todo' then 1 when 'doing' then 2 when 'done' then 3 else 4 end asc,
		          c.position asc,
		          c.id asc
		""")
List<Card> search(@Param("boardId") Integer boardId,
		@Param("archived") boolean archived,
		@Param("keyword") String keyword,
		@Param("filterByLabels") boolean filterByLabels,
		@Param("labelIds") Collection<Integer> labelIds);
```

### JPQLとは

**JPQL**（Jakarta Persistence Query Language）は、SQLに似た構文を持つ、JPAが定義する問い合わせ言語です。SQLとの決定的な違いは、`from Card c`のように**テーブル名ではなくエンティティクラス名**を書く点です。Hibernateがこれを実際のSQL（`from card c1_0 ...`）に変換して実行します。

### なぜSpecification/Criteria APIではなくJPQLを選んだか

Spring Data JPAには、動的な条件分岐が必要な検索を組み立てるための`Specification`（Criteria APIのラッパー）という仕組みもあります。本プロジェクトでは次の理由からJPQLを選びました。

- 絞り込み条件が4つで固定であり、将来的に激増する見込みがない規模である
- JPQLはSQLに近い構造で読めるため、SQLとJPAを並行して学ぶ読者にとって、Criteria APIの`Root`/`CriteriaBuilder`/`Subquery`のような専用APIより理解の段差が小さい
- 実行されるクエリの全体像が`@Query`の中に1箇所にまとまって見える。Specificationは条件ごとに複数のstaticメソッドへ分散しがちで、全体像がコードから読み取りにくい

条件の種類が多い・組み合わせを外部設定で切り替えたいといったケースではSpecificationが有利になりますが、本APIの規模ではJPQLの方が読みやすいと判断しました。

### null-guardイディオム：`(:x is null or ...)`

`(:boardId is null or b.id = :boardId)`という書き方が、このクエリの骨格です。「パラメータが指定されていなければ、そのAND条件全体を常に真にして絞り込みを無効化する」という、任意条件をJPQLで表現する定番のパターンです。`archived`だけはこの形にせず`c.isArchived = :archived`という単純な等値比較にしていますが、これは「未指定時は非アーカイブのみを表示する」という仕様を、呼び出し側（`CardService`）が`archived`を`null→false`に正規化してから渡すことで実現しているためです（判断のロジックをService層に寄せ、Repositoryのクエリ自体は単純に保っています）。

### `keyword`パラメータの型キャストが必要になった理由

`:keyword`は`is null`という比較にしか現れない文脈があると、Hibernateがバインドパラメータの型を確定できないことがあります。実際に本プロジェクトでも、`cast(:keyword as string)`を書かずに実装したところ、`GET /api/cards`（`keyword`未指定）の呼び出しで次のエラーが発生しました。

```
org.springframework.dao.InvalidDataAccessResourceUsageException:
JDBC exception executing SQL [... lower(('%'||?||'%')) ...]
ERROR: function lower(bytea) does not exist
```

型が確定しないままパラメータがPostgreSQLへ送られると、JDBCドライバが型不明のパラメータを`bytea`（バイナリ列）として送ってしまい、文字列関数の`lower()`がそれを受け付けられずSQLエラーになります。`cast(:keyword as string)`とJPQL側で明示することで、この型推論の失敗を防いでいます。「動くはずのクエリが実際には動かない」という実例として、型推論に曖昧さを残さないことの大切さを示しています。

### `labelIds`：空リストを`in`に渡せない問題

JPQLの`in :labelIds`に空のコレクションをそのまま渡すと、`in ()`という不正なSQLになってしまいます（Hibernateやそのバージョンによって挙動は変わりますが、依存しない設計にする方が安全です）。この問題を、`filterByLabels`というboolean引数を1つ増やすことで回避しています。

```java
// CardService.search() での正規化
boolean filterByLabels = condition.labelIds() != null && !condition.labelIds().isEmpty();
List<Integer> labelIds = filterByLabels ? condition.labelIds() : List.of(0);
```

`filterByLabels = false`のときは、JPQL側の`(:filterByLabels = false or exists (...))`というOR条件の左辺が常に真になるため、右辺の`exists`句（サブクエリ）自体が評価されません。このとき`labelIds`に渡っている`List.of(0)`は、あくまで引数の型を満たすためだけのダミー値（番兵）で、実際にはクエリの結果に影響しません（IDが1から採番されるため、`0`はどのラベルにも一致しない安全な値です）。

サブクエリでは`cl.id.cardId` / `cl.id.labelId`のように、`CardLabel`の複合主キー（[13章](./03-entity-jpa.md#13-複合主キー)の`CardLabelId`）を直接指定しています。`cl.card.id`と書いても同じ結果になりますが、`cl.id.cardId`は`card_label`テーブルの列そのものを指すため、サブクエリ内に余計なJOINが発生しないことがSQLログからも明確になります。

### `order by`に潜む罠：ステータスの並び順

`status`カラムの値は`todo` / `doing` / `done`という文字列です。これをそのまま`order by c.status`と書くと、**アルファベット順**（`doing` < `done` < `todo`）に並んでしまい、画面で期待される列順（未着手→作業中→完了）と食い違います。

```sql
order by ...,
         case c.status when 'todo' then 1 when 'doing' then 2 when 'done' then 3 else 4 end asc,
         ...
```

`case`式で明示的に1・2・3という順序を割り当てることで、この罠を回避しています。「文字列を並び替えると意味順にならないことがある」という、SQL・JPQLどちらでも起こりうる典型的な落とし穴です。

📄 このJPQLを実際に呼び出すService層の実装は [20章](./06-service-controller.md#20-service層とtransactional) 、N+1問題との関係は [24章](./07-jpa-performance.md#24-n1問題とその回避) を参照してください。
