# Service層・Controller層・DTO・例外処理

[← 学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **20〜23章** をまとめています。

---

## 20. Service層と`@Transactional`

> **Serviceとは？**
> [2章](./01-architecture.md#2-レイヤードアーキテクチャ)のレイヤードアーキテクチャにおける、ビジネスロジック（業務上の処理手順やルール）を担う層です。ControllerとRepositoryの間に立ち、「エンティティをレスポンス用DTOへ詰め替える」「存在チェックを行う」といった判断をここに集約します。

```java
@Service
@Transactional(readOnly = true)
public class BoardService {

	private final BoardRepository boardRepository;
	private final LabelRepository labelRepository;

	public BoardService(BoardRepository boardRepository, LabelRepository labelRepository) {
		this.boardRepository = boardRepository;
		this.labelRepository = labelRepository;
	}

	// ...
}
```

| 要素 | 意味 |
| --- | --- |
| `@Service` | このクラスをIoCコンテナに登録するための目印（[3章](./01-architecture.md#3-di依存性注入とiocコンテナ)）。`@Component`の一種で、「Service層のクラスである」という意図を表す |
| コンストラクタでの`BoardRepository`受け取り | コンストラクタインジェクション（[3章](./01-architecture.md#3-di依存性注入とiocコンテナ)）。IoCコンテナが起動時にRepositoryのBean（[17章](./05-repository.md#17-repository層とspring-data-jpa)）を自動的に渡してくれる |

### 20.1 そもそもトランザクションとは（DBの基礎）

> **トランザクションとは？**
> 「複数の処理をひとまとめにし、全部成功したときだけ確定（コミット）し、途中で失敗したら全部なかったことにする（ロールバックする）」という作業の単位です。中途半端な状態がデータベースに残ることを防ぐための仕組みです。

具体例として、本プロジェクトにはまだ無いが将来追加しうる「カードを1枚作成し、同時に初期ラベルを2件付与する」処理を考えます。素朴に実装すると、SQLは次の3本になります。

```sql
INSERT INTO card (board_id, title, status, position, ...) VALUES (...);  -- 1本目：カード本体
INSERT INTO card_label (card_id, label_id) VALUES (..., 1);              -- 2本目：ラベル付与1件目
INSERT INTO card_label (card_id, label_id) VALUES (..., 2);              -- 3本目：ラベル付与2件目
```

もし2本目まで成功し、3本目が失敗（例：存在しない`label_id`を指定してしまい外部キー制約違反になる）したらどうなるでしょうか。トランザクションという仕組みが無ければ、「ラベルが1つしか付いていない中途半端なカード」がそのままDBに残ってしまいます。この3本を1つのトランザクションにまとめておけば、3本目の失敗と同時に1本目・2本目もまとめて取り消され（ロールバック）、「カード自体が存在しない」という処理前の状態に戻ります。

**生SQLでの明示的な書き方と、Springでの対応**

| 生SQL | 役割 | Springでの対応 |
| --- | --- | --- |
| `BEGIN` | ここからトランザクション開始 | メソッド呼び出しの開始時（`@Transactional`が検知し自動発行） |
| （通常のSQL文を複数） | 業務処理そのもの | メソッド内の処理 |
| `COMMIT` | 全部確定する | メソッドが正常に終了したとき |
| `ROLLBACK` | 全部取り消す | メソッドが例外を投げて終了したとき |

**ACID（トランザクションが守る4つの性質）を本プロジェクトの言葉で言うと**

| 頭文字 | 正式名 | 本プロジェクトでの意味 |
| --- | --- | --- |
| A | Atomicity（原子性） | 上記の「全部成功か全部失敗か」そのもの。中間状態を許さない |
| C | Consistency（一貫性） | トランザクションの前後でデータの整合性ルールが必ず守られる。本プロジェクトでは`@Check`制約や外部キー制約（[14章](./03-entity-jpa.md#14-dbレベルの制約check)）が、アプリ側のバグに対してもこれを担保する最後の砦になる |
| I | Isolation（分離性） | 複数のトランザクションが同時に走ったとき、互いの「処理中の内容」がどこまで見えるか。次の20.2で詳しく扱う |
| D | Durability（永続性） | 一度`COMMIT`したデータは、電源断などが起きても失われない。PostgreSQL自体が保証する領域で、アプリ側で意識することはほぼ無い |

**Springの既定のロールバック規定**：`@Transactional`が例外発生時に自動でロールバックしてくれるのは、`RuntimeException`（非検査例外）と`Error`のみです。検査例外（`Exception`を継承し、コンパイラがtry-catchを強制する例外）は、既定では**ロールバックされずコミットされてしまいます**（Javaの検査例外は「呼び出し元が回復可能」という位置づけのため、Springは「業務的に想定内の結果」と解釈するのが既定動作です）。[23章](#23-例外処理とrestcontrolleradvice)の`ResourceNotFoundException`が`RuntimeException`を継承しているのは、`throws`宣言を省略できるからというだけでなく、投げた瞬間にトランザクションが確実にロールバックされることも理由の1つです。

📄 Laravelとの対比：Eloquentでも`DB::transaction(function () { ... })`のようにクロージャで同じことができ、クロージャ内で例外が投げられると自動でロールバックされる発想は共通です。ただしSpring/Javaでは「例外の型（検査/非検査）によって既定の挙動が変わる」という一段階余分なルールがある点に注意してください。

### 20.2 参照しかしない本プロジェクトで、なぜトランザクションが必要か（分離レベル）

`CardService`のメソッドはどれも参照（SELECT）しかしません。「更新しないなら、そもそもトランザクションなど要らないのでは？」という疑問は自然です。ここでは「複数のSQL文の間に、他の変更が割り込んだらどうなるか」という切り口で考えます。

**同時実行で起きうる3つの異常**

`CardService.search()`は「カード本体を取得するSQL」と「ラベルをまとめて取得するSQL」の2本を発行します（[24章](./07-jpa-performance.md#24-n1問題とその回避)）。この2本の**間**に、もし別の操作がデータを変更したらどうなるでしょうか。

| 異常 | 何が起きるか |
| --- | --- |
| ダーティリード（Dirty Read） | 他のトランザクションがまだ`COMMIT`していない、書きかけの値を読んでしまう。後でその変更が`ROLLBACK`されたら、読んだ値は「最初から存在しなかった」ことになる |
| ノンリピータブルリード（Non-Repeatable Read） | 同じ行を同じトランザクション内で2回読んだのに、1回目と2回目で値が変わっている（間に別のトランザクションがUPDATE/DELETEしてコミットしたため） |
| ファントムリード（Phantom Read） | 同じ条件のSELECTを2回実行したのに、行の**件数**が変わっている（間に別のトランザクションがINSERT/DELETEしてコミットしたため） |

**分離レベル（Isolation Level）**は、この3つの異常のうちどこまでを許すかを段階的に設定するものです。

| 分離レベル | ダーティリード | ノンリピータブルリード | ファントムリード |
| --- | --- | --- | --- |
| READ UNCOMMITTED | 許す | 許す | 許す |
| READ COMMITTED | 防ぐ | 許す | 許す |
| REPEATABLE READ | 防ぐ | 防ぐ | 許す（PostgreSQLの実装では実質防ぐ） |
| SERIALIZABLE | 防ぐ | 防ぐ | 防ぐ |

**本プロジェクトの実際の設定**：`application.properties`・`application-dev.properties`・`docker-compose.yml`のいずれにも分離レベルの指定は無く、PostgreSQLの既定値である**READ COMMITTED**のまま動いています。実際、開発環境の起動ログにもこう出力されています。

```
Isolation level: READ_COMMITTED [default READ_COMMITTED]
```

READ COMMITTEDが保証するのは、「各SQL文は、**その文が実行された時点で**コミット済みのデータだけを見る」ことです。つまりダーティリードは起きませんが、ノンリピータブルリードは起き得ます。

> ⚠️ **訂正**：本章では以前「1つのトランザクションにまとめることで、2本のクエリが同じスナップショット（同時点のDBの状態）を見ることになる」と説明していましたが、これはREAD COMMITTEDの下では正確ではありません。READ COMMITTEDは**SQL文ごと**にスナップショットを取り直すため、同じトランザクション内でも2本目のSQLが1本目より後の状態を見る可能性があります。この保証が欲しい場合は`REPEATABLE READ`以上に引き上げる必要があります（20.4節で実際に違いを確認します）。

**では1つのトランザクションにまとめることの本当の効果は何か**。厳密な同時点保証ではなく、次の2点です。

1. 2本のSQLの間でダーティリード（コミット前の中途半端な値）を読む心配が無い
2. 1つのDBコネクション・1つのHibernateセッション（永続化コンテキスト）に両方のSQLが乗るため、1本目で取得したエンティティ（`card.getBoard()`など）を2本目の処理でもそのまま安全に使い続けられる。コネクションが分かれていれば、そもそも1本目で取得したエンティティを2本目で使い回すこと自体ができない

**なぜREAD COMMITTEDのままで良いのか**：要件定義（[01-overview.md](../requirements/01-overview.md)）に明記されている通り、本アプリは個人利用が前提で「同時に複数人・複数端末から編集する状況を想定しない」。`CardService.search()`の2本のクエリの間に他の変更が割り込む確率はほぼ無視でき、仮に割り込んだとしても「一覧のラベル表示が一瞬だけ古い状態になる」程度で、業務上の破綻にはなりません。将来、複数ユーザー対応（要件定義10章）などでより強い一貫性が必要になったら、`@Transactional(isolation = Isolation.REPEATABLE_READ)`のようにメソッド単位で個別に引き上げられます。

### 20.3 `@Transactional`は「どうやって」効いているのか（AOPプロキシ）

アノテーションを1つ付けるだけで、なぜ`BEGIN`/`COMMIT`/`ROLLBACK`が自動的に挟まるのでしょうか。種明かしをすると、IoCコンテナ（[3章](./01-architecture.md#3-di依存性注入とiocコンテナ)）が実際にBeanとして登録しているのは`CardService`本体ではなく、それを内側に包んだ**プロキシ（代理）オブジェクト**です。`CardController`がコンストラクタインジェクションで受け取っている`cardService`も、実はこのプロキシです。

Springが実行時に自動生成するプロキシは、イメージとしては次のような処理を行います（実際に存在するコードではなく、動作を理解するための疑似コードです）。

```java
// 実際のコードではない。@Transactionalが実行時に生成する処理のイメージ
class CardServiceProxy extends CardService {
	private final CardService target; // 本物のCardService

	@Override
	public List<CardResponse> search(CardSearchCondition condition) {
		トランザクション開始(); // BEGIN
		try {
			List<CardResponse> result = target.search(condition); // 本物の処理を呼ぶ
			コミット(); // COMMIT
			return result;
		} catch (RuntimeException | Error e) {
			ロールバック(); // ROLLBACK
			throw e;
		}
	}
}
```

この「本体をプロキシで包む」という仕組み（AOP: Aspect Oriented Programming、業務ロジックとは別の関心事を横断的に差し込む技法）から、2つの落とし穴が生まれます。

1. **自己呼び出しには効かない**：クラスの外から`cardService.findById(1)`のように呼べば、必ずプロキシを経由するので`@Transactional`が働きます。しかし、クラス**内部**で`this.toResponses(...)`のように自分自身のメソッドを呼ぶ場合は、プロキシを経由しない直接呼び出しになるため、そのメソッド単体に`@Transactional`を付けても無視されます。`CardService.findById()`が内部で`toResponses()`を呼んでいるのはまさにこの形ですが、`CardService`は**クラス全体**に`@Transactional(readOnly = true)`が付いており、外部から呼ばれる入口（`findById`自体）で既にプロキシ経由のトランザクションが開始済みのため、問題は起きません。もし「`toResponses`だけ個別に`@Transactional`を付けて別扱いにしよう」としても、内部呼び出しである限りその指定は効かない点に注意してください。
2. **`public`メソッドにしか効かない**：プロキシは対象クラスを継承（またはインターフェースを実装）して差し込むため、`private`メソッドやオーバーライドできない`final`メソッドには適用できません。

**伝播（Propagation）**：`@Transactional`には伝播設定があり、既定値は`REQUIRED`です。「既にトランザクションが開始済みならそれに参加し、無ければ新規に開始する」という意味で、`Controller → Service → 別のService`のように呼び出しが入れ子になっても、`BEGIN`が二重に発行されることはありません（最初に入ったところが唯一の境界になります）。

**`readOnly = true`が実際にしていること**：単に「更新検知を省略する」だけでなく、3つの効果があります。

| 効果 | 内容 |
| --- | --- |
| ダーティチェックの省略 | Hibernateの`FlushMode`が変わり、永続化コンテキストが保持するエンティティの「読み込み時点のコピー」と「現在の値」を毎回比較する処理（ダーティチェック）が不要になる |
| DBへの伝達 | JDBCの`Connection.setReadOnly(true)`が呼ばれ、DBドライバ・DB自体にも「このトランザクションは参照専用」と伝わる（PostgreSQLでは実際に書き込みを行うと明確なエラーになる。20.4節で確認する） |
| 意図の明示 | コードを読む人に対して「このメソッドは更新を行わない」という設計意図を伝えるドキュメントとしての役割 |

**注意**：`readOnly = true`は「トランザクションを張らない」という意味ではありません。トランザクション自体は通常通り開始されており（20.1の`BEGIN`〜`COMMIT`はそのまま行われる）、その中身が参照専用に制限される、というだけです。

### 20.4 手を動かして確かめる

**① プロキシであることを実際に見る**

`TaskManagementApplication`に一時的な`CommandLineRunner`を追加し、DIコンテナから取り出した`CardService`の実際のクラス名を出力させると、本物の`CardService`ではなくプロキシのクラス名が表示されます。次は本プロジェクトのSpring Boot 4.1.0で実際に確認した結果です。

```
PROXY_CLASS_NAME=com.tkmedia.taskmanagement.service.CardService$$SpringCGLIB$$0
```

`$$SpringCGLIB$$0`という部分が、CGLIB（継承によってプロキシを生成する仕組み）によって実行時に生成されたサブクラスであることを示しています。確認用のコードは次の手順で追加・削除してください。

1. `TaskManagementApplication.java`に一時的に以下を追加する

   ```java
   @Bean
   CommandLineRunner printProxyClassName(CardService cardService) {
       return args -> System.out.println("PROXY_CLASS_NAME=" + cardService.getClass().getName());
   }
   ```

2. `docker compose logs backend | grep PROXY_CLASS_NAME`で出力を確認する（DevToolsが変更を検知して自動的に再起動し、起動時にログへ出力される）
3. 確認できたら追加したコードを削除する（`git checkout -- backend/src/main/java/com/tkmedia/taskmanagement/TaskManagementApplication.java`でも戻せる）

**② 分離レベルの違いを実際に体感する**

PostgreSQLコンテナの中で2つのセッション（接続）を使い、片方をトランザクション中のまま、もう片方から別の変更をコミットしてみます。以下は本プロジェクトのシードデータ（`db/seed/dummy-data.sql`。`card_id=1`には`label_id=1,2`の2件が存在する）に対して実際に実行し、結果を確認したものです。

まずREAD COMMITTED（本プロジェクトの既定）の場合。

```bash
docker compose exec -T db psql -U taskuser -d taskmanagement <<'SQL'
SHOW transaction_isolation;
BEGIN;
SELECT count(*) AS a_first_read FROM card_label WHERE card_id = 1;
\! psql -U taskuser -d taskmanagement -c "DELETE FROM card_label WHERE card_id = 1 AND label_id = 2;"
SELECT count(*) AS a_second_read_same_txn FROM card_label WHERE card_id = 1;
COMMIT;
SQL
```

`\!`はpsqlのメタコマンドで、その場でシェルコマンドを実行します。ここではコンテナ内のローカル`psql`を使い、**別セッション**からラベルを1件削除・コミットさせています。実行結果（抜粋）は次の通りでした。

```
 a_first_read
--------------
            2
(1 row)

DELETE 1

 a_second_read_same_txn
------------------------
                      1
```

同じトランザクションの中にもかかわらず、1回目の読み取り（2件）と2回目の読み取り（1件）で結果が変わりました。これがノンリピータブルリードです。

作業後は必ず元に戻してください。

```bash
docker compose exec -T db psql -U taskuser -d taskmanagement -c \
  "INSERT INTO card_label (card_id, label_id) VALUES (1, 2);"
```

続いてREPEATABLE READで同じ手順を試すと、結果が変わります。

```bash
docker compose exec -T db psql -U taskuser -d taskmanagement <<'SQL'
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT count(*) AS a_first_read_rr FROM card_label WHERE card_id = 1;
\! psql -U taskuser -d taskmanagement -c "DELETE FROM card_label WHERE card_id = 1 AND label_id = 2;"
SELECT count(*) AS a_second_read_same_txn_rr FROM card_label WHERE card_id = 1;
COMMIT;
SQL
```

```
 a_first_read_rr
-----------------
               2

DELETE 1

 a_second_read_same_txn_rr
----------------------------
                          2
```

トランザクション開始時点のスナップショットが保持されるため、間で別セッションが削除・コミットしても、**同じトランザクションの中では2件のまま**です（`COMMIT`した後に改めて問い合わせると、実際の値である1件が見えるようになります）。忘れずに復元してください。

```bash
docker compose exec -T db psql -U taskuser -d taskmanagement -c \
  "INSERT INTO card_label (card_id, label_id) VALUES (1, 2);"
```

**③ `readOnly`の安全弁を確認する**

```bash
docker compose exec -T db psql -U taskuser -d taskmanagement <<'SQL'
BEGIN TRANSACTION READ ONLY;
UPDATE card SET title = 'x' WHERE id = 1;
SQL
```

```
ERROR:  cannot execute UPDATE in a read-only transaction
```

`readOnly = true`が単なる気休めの設定ではなく、DBレベルで書き込みを実際に拒否させる仕組みであることが確認できます（`UPDATE`が失敗した時点でエラーになっており、テーブルへの変更は発生していません）。

### importを間違えやすい注意点

`@Transactional`という名前のアノテーションはJavaに2種類あります。

| import元 | `readOnly`属性 |
| --- | --- |
| `org.springframework.transaction.annotation.Transactional` | ある（本プロジェクトで使うのはこちら） |
| `jakarta.transaction.Transactional` | ない |

後者をimportしてしまうとコンパイルは通ってしまいますが（`readOnly`を指定しようとした時点でコンパイルエラーにはなるので気づけますが）、属性を指定しなければ意図と異なるアノテーションのまま気づかずに動いてしまう可能性があります。IDEの自動importに任せきりにせず、どちらか意識することが大切です。

### メソッドの実装：エンティティをDTOへ詰め替える

```java
public List<LabelResponse> findLabelsByBoardId(Integer boardId) {
	if (!boardRepository.existsById(boardId)) {
		throw new ResourceNotFoundException("ボードが見つかりません（id=" + boardId + "）");
	}
	return labelRepository.findByBoardIdOrderByIdAsc(boardId).stream()
			.map(BoardService::toResponse)
			.toList();
}
```

`findLabelsByBoardId`が先に`existsById`でボードの存在を確認しているのは、「指定IDのボード自体が存在しない」場合と「ボードは存在するがラベルが0件」の場合を区別するためです。これを省くと、どちらのケースも同じ空配列（`[]`）として返ってしまい、クライアント側が`boardId`の指定ミスに気づけなくなります。

> 📄 ここまでは参照専用（`readOnly = true`）のメソッドだけを扱いました。書き込みを行うメソッドでクラス既定の`readOnly = true`をどう上書きするかは[31章](./09-write-api-validation.md#31-登録処理の中身)を参照してください。

---

## 21. Controller層とREST API

Controllerは、HTTPリクエストの受け口です。URLとHTTPメソッド（GET/POST等）に応じて処理をServiceへ振り分けます。

```java
@RestController
@RequestMapping("/api/boards")
public class BoardController {

	private final BoardService boardService;

	public BoardController(BoardService boardService) {
		this.boardService = boardService;
	}

	@GetMapping
	public List<BoardResponse> list() {
		return boardService.findAll();
	}

	@GetMapping("/{id}")
	public BoardResponse get(@PathVariable Integer id) {
		return boardService.findById(id);
	}
}
```

| アノテーション | 意味 |
| --- | --- |
| `@RestController` | `@Controller`（このクラスをリクエストの振り分け先とする）と`@ResponseBody`（戻り値のオブジェクトをレスポンスボディにそのまま書き込む）を組み合わせたもの。戻り値はテンプレート名としてではなく、Jacksonによって**JSON**へ変換されて返される |
| `@RequestMapping("/api/boards")` | クラスに付けると、このController配下の全メソッドに共通するURLの接頭辞になる |
| `@GetMapping` / `@GetMapping("/{id}")` | HTTP GETリクエストをこのメソッドに割り当てる。`{id}`はパス変数のプレースホルダ |
| `@PathVariable Integer id` | URLパスの`{id}`部分を、メソッドの引数`id`に束縛する |

`CardController`では、絞り込み条件をクエリパラメータ（`?boardId=1&keyword=...`）として受け取ります。

```java
@GetMapping
public List<CardResponse> list(
		@RequestParam(required = false) Integer boardId,
		@RequestParam(required = false) Boolean archived,
		@RequestParam(required = false) String keyword,
		@RequestParam(required = false) List<Integer> labelIds) {
	return cardService.search(new CardSearchCondition(boardId, archived, keyword, labelIds));
}
```

`@RequestParam(required = false)`で受ける引数は、`int`/`boolean`のようなプリミティブ型ではなく`Integer`/`Boolean`のラッパー型にする必要があります。パラメータが指定されなかったとき、プリミティブ型には代入すべき`null`が存在せず例外になってしまうためです。`List<Integer> labelIds`は、`?labelIds=1,2`（カンマ区切り）と`?labelIds=1&labelIds=2`（同名パラメータの繰り返し）のどちらの形式でも、Spring MVCが同じ`List<Integer>`にバインドしてくれます。

### 本プロジェクトのエンドポイント一覧

| メソッド | パス | クエリパラメータ／ボディ | 説明 |
| --- | --- | --- | --- |
| GET | `/api/boards` | — | ボード一覧 |
| GET | `/api/boards/{id}` | — | ボード1件 |
| GET | `/api/boards/{id}/labels` | — | 指定ボードのラベル一覧 |
| POST | `/api/boards` | ボディ：`BoardCreateRequest`（`name`） | ボード新規作成。成功時は201 + `Location`ヘッダー（[28章](./09-write-api-validation.md#28-登録系apipostの作り方)） |
| GET | `/api/cards` | `boardId`, `archived`, `keyword`, `labelIds`（すべて任意・組み合わせ可） | カード一覧（絞り込み） |
| GET | `/api/cards/{id}` | — | カード1件（アーカイブ済みかどうかは問わない） |
| POST | `/api/cards` | ボディ：`CardCreateRequest`（`boardId`, `title`, `description`, `dueDate`, `labelIds`） | カード新規作成。ステータスは常に`todo`固定。成功時は201 + `Location`ヘッダー（[28章](./09-write-api-validation.md#28-登録系apipostの作り方)） |
| PUT | `/api/cards/{id}` | ボディ：`CardUpdateRequest`（`title`, `description`, `dueDate`, `labelIds`） | カード編集（タイトル・説明・期日・ラベル）。所属ボード・ステータスは対象外（[33章](./10-update-api.md#33-更新系apiputpatchの作り方)） |
| PATCH | `/api/cards/{id}/status` | ボディ：`CardStatusUpdateRequest`（`status`, `position`） | ステータス変更＋列内の並び替え（[33章](./10-update-api.md#33-更新系apiputpatchの作り方)） |

### 「0件」と「見つからない」の違い

`GET /api/cards`は、条件に合致するカードが1件も無くても**HTTP 200・空配列（`[]`）**を返します。一覧を取得するエンドポイントにとって「結果が空であること」自体は正常な結果であり、404（Not Found）にはしません。一方、`GET /api/boards/{id}`のように**1件を名指しで取得する**エンドポイントで、そのIDが存在しない場合は404を返します（[23章](#23-例外処理とrestcontrolleradvice)）。この使い分けは、REST APIの一般的な設計慣習に沿ったものです。

> CORS（Cross-Origin Resource Sharing。異なるオリジン間の通信を許可する設定）は、フロントエンドの実装に着手した時点で対応しました。開発時はフロントエンド（`http://localhost:5173`）とAPI（`http://localhost:8080`）でポートが異なり別オリジンになるため、`CorsConfig`（`config/`パッケージ）で許可を与えています。仕組みと設定の詳細は[27章](./08-configuration-cors.md#27-corsとフロントエンドとの接続)を参照してください。

---

## 22. DTO（レコード）でエンティティを外に出さない

Controllerの戻り値は、`Card`や`Board`といったエンティティそのものではなく、`CardResponse`・`BoardResponse`といった専用のクラス（DTO: Data Transfer Object）です。

```java
public record CardResponse(
		Integer id, Integer boardId, String boardName, String title, String description,
		LocalDate dueDate, String status, Boolean isArchived, Integer position,
		List<LabelResponse> labels) {
}
```

### recordとは

Java 25（正確にはJava 16以降）の`record`は、フィールド・コンストラクタ・各フィールドの値を返すアクセサメソッド（`id()`のような、`getId()`ではなく`id()`という名前になる点に注意）・`equals()`/`hashCode()`/`toString()`を、この1行の宣言だけで自動生成してくれる「不変の入れ物」用のクラスです。DTOは「Controllerが受け取った値、あるいはServiceが組み立てた値をそのまま運ぶだけ」の役割なので、Lombok未導入の本プロジェクトでは、手書きのgetter/setterクラスよりrecordの方が本質に合っています。record内のコンポーネント（`id`, `boardId`, ...）の宣言順が、そのままJSON化した際のキーの出力順になります。

📄 `record`が自動生成するもの（コンストラクタ・アクセサ・`equals`/`hashCode`/`toString`）を言語構文として詳しく知りたい場合は、[docs/java/03-type-system.md](../java/03-type-system.md#15-record) の15章を参照してください。

### なぜエンティティを直接returnしないのか

1. `Card.board`は`fetch = LAZY`（[12章](./03-entity-jpa.md#12-リレーション関連の書き方)）です。エンティティをそのままJacksonでJSONに変換しようとすると、トランザクションの外側（`open-in-view=false`の下ではJSON変換のタイミングが該当）でこの遅延プロキシに触れることになり、`LazyInitializationException`を招きます。トランザクション内であっても、Jacksonが関連を辿ろうとして意図しない追加SQL（N+1、[24章](./07-jpa-performance.md#24-n1問題とその回避)）を発生させかねません
2. エンティティを直接返すと、DBのテーブル構造（カラム名など）がそのままAPIのレスポンス形式と直結してしまいます。DTOを1枚挟むことで、「DBの都合」と「API利用者への契約」を分離できます

このDTOへの詰め替えは、`CardService`が`@Transactional`のトランザクション内（[20章](#20-service層とtransactional)）で行います。

> 📄 ここで扱ったのは「サーバー→クライアント」方向のレスポンスDTOです。「クライアント→サーバー」方向のリクエストDTO（`CardCreateRequest`等）とBean Validationについては[29章](./09-write-api-validation.md#29-リクエストdtoとbean-validation)を参照してください。

---

## 23. 例外処理と`@RestControllerAdvice`

存在しないIDが指定されたとき、Serviceは専用の例外を投げます。

```java
public class ResourceNotFoundException extends RuntimeException {
	public ResourceNotFoundException(String message) {
		super(message);
	}
}
```

`RuntimeException`（非検査例外）を継承しているのは、呼び出し元のControllerに`throws`宣言やtry-catchを書かせずに済ませるためです。Serviceで投げられたこの例外は、Controllerを素通りして`GlobalExceptionHandler`まで届きます。

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(ResourceNotFoundException.class)
	public ProblemDetail handleResourceNotFound(ResourceNotFoundException ex, HttpServletRequest request) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
		problem.setTitle("リソースが見つかりません");
		problem.setInstance(URI.create(request.getRequestURI()));
		return problem;
	}
}
```

| 要素 | 意味 |
| --- | --- |
| `@RestControllerAdvice` | `@ControllerAdvice`（例外ハンドラをアプリ全体に横断的に適用する）と`@ResponseBody`を組み合わせたアノテーション。アプリ内のどのControllerで例外が発生しても、このクラスの`@ExceptionHandler`が呼び出される。各Controllerに個別のtry-catchを書かずに済み、「業務処理」と「エラー応答の形式」という関心事を分離できる |
| `@ExceptionHandler(ResourceNotFoundException.class)` | このメソッドが`ResourceNotFoundException`（およびそのサブクラス）を処理することを示す |
| `ProblemDetail` | Spring Framework 6以降が提供する、**RFC 9457**（Problem Details for HTTP APIs）に沿ったエラー表現のための型 |

戻り値が`ProblemDetail`の場合、`@ExceptionHandler`メソッドに`@ResponseStatus`を付けなくても、`ProblemDetail`内の`status`の値がそのままHTTPステータスコードとして使われ、Content-Typeも自動的に`application/problem+json`になります。`instance`（今回のエラーが発生したリクエストパス）は自動では設定されないため、`HttpServletRequest`をハンドラの引数として受け取り、明示的にセットしています。

### レスポンスの実例

```
GET /api/boards/999
→ HTTP/1.1 404
  Content-Type: application/problem+json

{
  "type": "about:blank",
  "title": "リソースが見つかりません",
  "status": 404,
  "detail": "ボードが見つかりません（id=999）",
  "instance": "/api/boards/999"
}
```

`spring.mvc.problemdetails.enabled=true`（[8章](./02-build-config.md#8-applicationproperties-の読み方)）を設定しているため、Spring MVCが自前で処理する例外（例えば`GET /api/boards/abc`のようにパス変数の型変換に失敗した場合の400 Bad Request）も、同じ`application/problem+json`形式で返ります。自前の例外（404）とフレームワーク起因の例外（400など）のレスポンス形式が統一されることで、クライアント側のエラー処理を1本化できます。

📄 N+1問題との関係は [24章](./07-jpa-performance.md#24-n1問題とその回避) 、`open-in-view`との関係は [25章](./07-jpa-performance.md#25-open-in-viewと遅延読み込みの境界) を参照してください。カード・ボード新規作成のバリデーションエラー（400）をこの仕組みにどう追加したか、そして「同じ`spring.mvc.problemdetails.enabled=true`が生む、もう1つの`@ControllerAdvice`との優先順位の落とし穴」は[30章](./09-write-api-validation.md#30-バリデーションエラーを400で返す)で詳しく扱います。
