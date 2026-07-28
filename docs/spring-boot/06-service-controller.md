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

### `@Transactional(readOnly = true)`の効果

クラス全体に付けている`@Transactional(readOnly = true)`には3つの意味があります。

1. **トランザクション境界の明示**：このクラスの各メソッドの開始から終了までが1つのトランザクションになる。`CardService.search()`はカード本体の取得とラベルの取得で2回SQLを発行しますが（[24章](./07-jpa-performance.md#24-n1問題とその回避)）、1つのトランザクションにまとめることで両者が同じスナップショット（同時点のDBの状態）を見ることになる
2. **遅延読み込みとの関係**：[25章](./07-jpa-performance.md#25-open-in-viewと遅延読み込みの境界)で解説する`open-in-view=false`の設定下では、トランザクションの範囲＝遅延読み込み（`fetch = LAZY`）が安全に行える範囲です。DTOへの詰め替えをこのトランザクションの中で完了させることで、「トランザクションの外で遅延読み込みに触れて例外になる」という事故を避けています
3. **読み取り専用の最適化**：`readOnly = true`にすると、Hibernateは更新検知（ダーティチェック。エンティティの変更をSQLとして反映するための仕組み）を省略できます。参照系のメソッドではこの処理自体が不要なので、その分のオーバーヘッドを削減できます

**importを間違えやすい注意点**：`@Transactional`という名前のアノテーションはJavaに2種類あります。

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

| メソッド | パス | クエリパラメータ | 説明 |
| --- | --- | --- | --- |
| GET | `/api/boards` | — | ボード一覧 |
| GET | `/api/boards/{id}` | — | ボード1件 |
| GET | `/api/boards/{id}/labels` | — | 指定ボードのラベル一覧 |
| GET | `/api/cards` | `boardId`, `archived`, `keyword`, `labelIds`（すべて任意・組み合わせ可） | カード一覧（絞り込み） |
| GET | `/api/cards/{id}` | — | カード1件（アーカイブ済みかどうかは問わない） |

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

📄 N+1問題との関係は [24章](./07-jpa-performance.md#24-n1問題とその回避) 、`open-in-view`との関係は [25章](./07-jpa-performance.md#25-open-in-viewと遅延読み込みの境界) を参照してください。
