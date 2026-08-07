# 登録系API（POST）とバリデーション

[← 学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **28〜31章** をまとめています。

---

## 28. 登録系API（POST）の作り方

これまでのController（[21章](./06-service-controller.md#21-controller層とrest-api)）はすべて`@GetMapping`でした。カード・ボードの新規作成にあわせて、本プロジェクト初の`@PostMapping`が登場します。2つのControllerを並べると、書き込み系APIの形が繰り返しであることが見て取れます。

```java
// CardController
@PostMapping
public ResponseEntity<CardResponse> create(@Valid @RequestBody CardCreateRequest request) {
	CardResponse created = cardService.create(request);
	return ResponseEntity.created(URI.create("/api/cards/" + created.id())).body(created);
}
```

```java
// BoardController
@PostMapping
public ResponseEntity<BoardResponse> create(@Valid @RequestBody BoardCreateRequest request) {
	BoardResponse created = boardService.create(request);
	return ResponseEntity.created(URI.create("/api/boards/" + created.id())).body(created);
}
```

| 要素 | 意味 |
| --- | --- |
| `@PostMapping` | HTTP POSTリクエストをこのメソッドに割り当てる。`@RequestMapping("/api/cards")`（クラスレベル）と組み合わさり、`POST /api/cards`になる |
| `@RequestBody` | HTTPリクエストの**ボディ**（JSON）を、Jacksonを介して指定した型のオブジェクトへ変換する。`@GetMapping`の`@RequestParam`（[21章](./06-service-controller.md#21-controller層とrest-api)）が**URL**から値を受け取るのに対し、こちらは**ボディ**から受け取る |
| `@Valid` | このパラメータに対してBean Validation（[29章](#29-リクエストdtoとbean-validation)）を実行する。付け忘れると、DTOにアノテーションを書いても一切検証されない |
| `ResponseEntity<T>` | ステータスコード・ヘッダー・ボディをまとめて表現する型。GET系メソッドが素の`CardResponse`を返しているのに対し、POSTだけこの型を使っている（理由は次項） |

### GETは`ResponseEntity`を使わないのに、なぜPOSTは使うのか

GET系メソッド（`list`・`get`）は、戻り値の型をそのまま返すだけで十分でした。成功時のステータスコードは常に200（Spring MVCの既定）で、追加のヘッダーも不要だったからです。POSTでは事情が変わります。

- **ステータスコード**：RESTの設計慣習では、リソースを新規作成するPOSTの成功時は200ではなく**201 Created**を返すのが望ましいとされています。「作成した」という結果を、ステータスコード自体で表現するためです。
- **`Location`ヘッダー**：201のレスポンスには、作成されたリソースのURLを`Location`ヘッダーで示すのが慣習です。クライアントはこのヘッダーを読めば、`GET`で改めて取得できる場所が分かります。

```java
return ResponseEntity.created(URI.create("/api/cards/" + created.id())).body(created);
```

`ResponseEntity.created(URI)`は、「201 Created」かつ「指定したURIを`Location`ヘッダーに設定する」ためのビルダーメソッドです。`.body(created)`でレスポンスボディに`CardResponse`本体を続けます。実際に`curl`で確認すると次のようになります。

```
POST /api/cards
{"boardId":1,"title":"打合せ資料"}

→ HTTP/1.1 201
  Location: /api/cards/18

{"id":18,"boardId":1,"boardName":"仕事","title":"打合せ資料", ...}
```

`Integer`のような単純な値をそのまま返せばよいGETと違い、POSTは「ステータスコード」「ヘッダー」「ボディ」という3つの異なる情報をまとめて返す必要があるため、それらを1つにパッケージ化できる`ResponseEntity`を使います。

---

## 29. リクエストDTOとBean Validation

### `spring-boot-starter-validation`の導入

`@NotBlank`や`@Size`のようなアノテーションは、それ自体では何もチェックしてくれません。付与されたアノテーションを実際に読み取り、値を検証する**実装**が別途必要です。この実装（Hibernate Validator）を有効にするため、`build.gradle`に依存を追加しました。

```groovy
implementation 'org.springframework.boot:spring-boot-starter-validation'
```

このstarterを加えるだけで、`@Valid`が付いた引数に対する自動検証がSpring MVCの処理経路（`RequestResponseBodyMethodProcessor`）に組み込まれます。追加のBean定義は不要です（[3章](./01-architecture.md#3-di依存性注入とiocコンテナ)の自動構成と同じ考え方）。

### リクエストDTOの実装

```java
public record CardCreateRequest(
		@NotNull(message = "ボードを指定してください") Integer boardId,
		@NotBlank(message = "タイトルを入力してください") @Size(max = 200, message = "タイトルは200文字以内で入力してください") String title,
		String description,
		LocalDate dueDate,
		List<Integer> labelIds) {
}
```

```java
public record BoardCreateRequest(
		@NotBlank(message = "ボード名を入力してください") @Size(max = 50, message = "ボード名は50文字以内で入力してください") String name) {
}
```

| アノテーション | 検証内容 |
| --- | --- |
| `@NotNull` | 値が`null`でないこと。型を問わず使える最も緩い制約 |
| `@NotBlank` | 値が`null`でなく、かつ空文字列・空白のみでもないこと（`String`専用。`isBlank()`相当の判定がされる） |
| `@Size(max = ...)` | 文字列の長さ（または配列・コレクションの要素数）が指定範囲内であること |

`message`属性に日本語のメッセージを直接書いているのは、本プロジェクトの規模でメッセージ用の`.properties`ファイル（国際化リソース）を別途用意するほどの必要が無いためです。既定のメッセージ（英語）に頼らず、検証に失敗した理由をそのままフロントエンドへ届けたいという意図もあります。

### レスポンスDTO（22章）との性格の違い

[22章](./06-service-controller.md#22-dtoレコードでエンティティを外に出さない)の`CardResponse`もrecordでしたが、役割はまったく逆です。

| | リクエストDTO（`CardCreateRequest`） | レスポンスDTO（`CardResponse`） |
| --- | --- | --- |
| 向き | クライアント → サーバー | サーバー → クライアント |
| 値の由来 | JSONをJacksonが変換して**組み立てる** | ServiceがエンティティやDBの値から**組み立てる** |
| 検証 | `@Valid`でアノテーションによる自動検証が必要 | 検証不要（サーバーが正しい値しか作らないため） |
| コンパクトコンストラクタでの正規化 | しない（[19章](./05-repository.md#19-queryとjpql動的な絞り込み)の`CardSearchCondition`と同じ方針。判断はService層に置く） | — |

### `dueDate`に`@FutureOrPresent`を付けなかった理由

Bean Validationには「未来または現在の日付であること」を検証する`@FutureOrPresent`もあります。一見、期日は未来のはずに思えますが、`frontend/src/lib/dueDate.ts`の`DueDateBadge`は「期限切れ（過去の期日）」を🔴で明示する仕様です。過去の期日は不正な入力ではなく、「締切を過ぎたタスクをそのまま記録しておきたい」という正当な業務上のユースケースにあたります。バリデーションは「形式として成立しない」値だけを弾き、「業務上あり得なくはない」値まで弾かないよう、意図的に付けていません。

### 3層の多重防御

`title`の200文字・`name`の50文字という上限は、実は3つの層すべてに同じ数値で表現されています。

| 層 | 実装 | 破られたときの挙動 |
| --- | --- | --- |
| ① フロントエンド | `<input maxLength={200}>` | ブラウザがそもそも201文字目を入力させない（UXとしての防御） |
| ② Bean Validation | `@Size(max = 200)` | DevToolsで①を回避されても、サーバーが400で拒否する |
| ③ DBのカラム長 | `@Column(length = 200)` → `varchar(200)` | ①②を両方とも回避する経路（バグや将来の別クライアント）があっても、DBが物理的に受け付けない |

[14章](./03-entity-jpa.md#14-dbレベルの制約check)で見た`@Check`（`status`の3値制約）と同じ「入口を複数用意して守る」という多重防御の考え方が、ここでは「文字数」という別の軸で3層に広がっています。①だけでは悪意のあるクライアントを止められず、③だけでは利用者に不親切（送信してから初めてエラーになる）です。3層それぞれ役割が異なります。

### `description`の上限は2層しかない——制約の「出どころ」の違い

カードの説明（`description`）にも`@Size(max = 2000)`とフロントエンドの`maxLength={2000}`がありますが、こちらは①②の2層だけで、③にあたるDBの制約がありません。`Card.description`のカラムは`text`型（長さ制限なし）だからです。

この非対称は、上限値の**出どころ**が違うことから生まれています。`title`の200文字は「DBのカラムが`varchar(200)`である」という物理的な事実が先にあり、`@Size`と`maxLength`はそれをアプリ側の層へ写し取ったものです。だからこそ3層の数値は必ず一致していなければならず、片方だけを変えるとDBエラー（500）という最悪の形で破綻します。

一方`description`の2000文字は、DBにも要件定義にも根拠が無く、「個人のタスクメモとして妥当な範囲」という**業務上の判断**としてこちらで決めた値です。守りたいのは「際限なく長い本文がそのまま保存されてしまう状態を避ける」ことであり、DBの物理的な限界ではありません。この目的なら、アプリ側の2層で十分に達成できます。

上限を後から変えるときの手触りも対照的です。`description`を3000文字に緩めたければ、`CardCreateRequest`・`CardUpdateRequest`・2つの`maxLength`という4箇所を揃えて直すだけで済みます。`title`の200文字を変えるには、それに加えてDBカラムの変更（＝マイグレーション）が必要になります。**「その制約は誰が決めたのか」を意識すると、何層で守るべきかも自ずと決まります。**

なお、2000という値は`CardCreateRequest`（作成時）と`CardUpdateRequest`（編集時）の両方に同じだけ書いています。ここがずれると「作れたのに保存し直せないカード」が生まれてしまうため、上限を変更するときは必ず両方を同時に直します。

> 📄 `@NotBlank String title`のように、recordの**コンポーネント宣言**に直接書いたアノテーションが、なぜフィールドだけでなくコンストラクタ引数にも自動的に効くのかは、Javaの言語機能としての説明を[docs/java/07-syntax-reference.md](../java/07-syntax-reference.md#29-アノテーションの読み方構文として)に追記しています。

---

## 30. バリデーションエラーを400で返す

### `MethodArgumentNotValidException`とその既定のハンドリング

`@Valid`の検証に失敗すると、Spring MVCは`MethodArgumentNotValidException`を投げます。これは[23章](./06-service-controller.md#23-例外処理とrestcontrolleradvice)の`ResourceNotFoundException`と違い、**アプリのコードが書いた例外ではありません**。Controllerの引数を組み立てる段階（Serviceに処理が到達する前）でSpring MVC自身が投げる例外です。

`spring.mvc.problemdetails.enabled=true`（[8章](./02-build-config.md#8-applicationproperties-の読み方)）が有効な場合、Spring Bootはこの例外に対しても既定のハンドリングを自動登録します。実際にどのクラスが登録されているかは、依存jarを展開して確認できます。

```
org.springframework.boot.webmvc.autoconfigure.ProblemDetailsExceptionHandler
  extends ResponseEntityExceptionHandler
  @ControllerAdvice（@Orderの指定なし）
```

`ResponseEntityExceptionHandler`はSpring Frameworkが提供する基底クラスで、`MethodArgumentNotValidException`・`HttpMessageNotReadableException`など、フレームワーク自身が投げる例外向けの`handleXxx`メソッドをあらかじめ持っています。Boot既定のこのクラスを何もカスタマイズせずに使うと、`GET /api/boards/999`の404（[23章](./06-service-controller.md#23-例外処理とrestcontrolleradvice)）とは違う、次のような素っ気ないレスポンスになります。

```
POST /api/boards
{"name":"   "}

→ HTTP/1.1 400

{"detail":"Invalid request content.","instance":"/api/boards","status":400,"title":"Bad Request"}
```

「入力内容の何が悪かったか」がまったく分からず、フロントエンドが入力欄の下にエラーを出し分ける手がかりになりません。

### 自前のハンドラで上書きする——そして実際にハマった落とし穴

`GlobalExceptionHandler`に、フィールドごとのエラーメッセージを含む専用のハンドラを追加しました。

```java
@ExceptionHandler(MethodArgumentNotValidException.class)
public ProblemDetail handleValidationError(MethodArgumentNotValidException ex, HttpServletRequest request) {
	ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "入力内容に誤りがあります");
	problem.setTitle("バリデーションエラー");
	problem.setInstance(URI.create(request.getRequestURI()));

	Map<String, String> errors = new LinkedHashMap<>();
	for (FieldError fieldError : ex.getFieldErrors()) {
		errors.put(fieldError.getField(), fieldError.getDefaultMessage());
	}
	problem.setProperty("errors", errors);
	return problem;
}
```

`ex.getFieldErrors()`は、検証に失敗した`FieldError`（「どのフィールドが」「どんな理由で」失敗したか）の一覧です。フィールド名をキーにした`Map`へ詰め替え、`problem.setProperty("errors", errors)`で**RFC 9457の標準外の拡張メンバー**として追加します（`ProblemDetail`は標準の`type`/`title`/`status`/`detail`/`instance`に加え、`setProperty`で自由な追加項目を持てます）。

このメソッドを追加した直後、実際には**呼ばれませんでした**。`curl`で確認しても、相変わらず`"Invalid request content."`という既定のメッセージが返り続けたのです。原因は、[本章冒頭](#methodargumentnotvalidexceptionとその既定のハンドリング)で見た`ProblemDetailsExceptionHandler`（Boot既定のアドバイス）と、`GlobalExceptionHandler`（自前のアドバイス）が、**どちらも`MethodArgumentNotValidException`を処理できる`@ControllerAdvice`として同時に存在している**ことでした。

Spring MVCは、複数の`@ControllerAdvice`が同じ例外を処理できる場合、`@Order`の値（小さいほど優先）でどちらを使うか決めます。`@Order`を指定しなければ既定値（`Ordered.LOWEST_PRECEDENCE`、最も低い優先度）になり、自前の`GlobalExceptionHandler`もBoot既定の`ProblemDetailsExceptionHandler`も**同じ優先度**で並んでいました。優先度が同点の場合にどちらが選ばれるかはBean登録順に依存し、今回はBoot既定のクラスが先に処理してしまっていた、という状況です。

解決策は、`GlobalExceptionHandler`に明示的な最高優先度を与えることでした。

```java
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class GlobalExceptionHandler {
```

これで自前のハンドラが確実に先に選ばれるようになり、期待通りのレスポンスが返るようになりました。

```
POST /api/boards
{"name":"   "}

→ HTTP/1.1 400

{
  "detail": "入力内容に誤りがあります",
  "instance": "/api/boards",
  "status": 400,
  "title": "バリデーションエラー",
  "errors": { "name": "ボード名を入力してください" }
}
```

**教訓**：`spring.mvc.problemdetails.enabled=true`は「フレームワーク起因の例外にも既定のレスポンスを与える」便利な設定ですが、それは「もう1つの`@ControllerAdvice`が舞台裏に存在する」ことも意味します。自前のハンドラで同じ例外を上書きしたいときは、`@Order`で優先順位を明示しないと、静かに無視される可能性があります（このハンドラを完全にカスタマイズする、Springが公式に推奨するもう1つの方法は、`ResponseEntityExceptionHandler`を自分で継承し、該当メソッドだけを`@Override`することです。今回は既存の`GlobalExceptionHandler`の設計——1クラスに複数の独立したハンドラを並べる形——を保ちたかったため、`@Order`による上書きを選びました）。

### `InvalidRequestException`：Bean Validationでは表現できない不正

Bean Validationは「1つのフィールド単体が正しい形か」しか見られません。「指定されたラベルIDが、実は別のボードのものだった」という不正は、DBの内容と突き合わせて初めて分かる**業務ルール**の違反であり、アノテーションでは検出できません。この種の不正には、新設した`InvalidRequestException`（`ResourceNotFoundException`と対になる、400を返す非検査例外）を使います。

```java
List<Label> labels = labelRepository.findByBoardIdAndIdIn(board.getId(), labelIds);
if (labels.size() != labelIds.size()) {
	throw new InvalidRequestException("指定されたラベルの一部が、このボードに存在しません");
}
```

`GlobalExceptionHandler`の対応ハンドラも、`ResourceNotFoundException`用のハンドラとほぼ同じ形です（ステータスが404から400に変わるだけ）。

| 例外 | いつ投げられるか | ステータス |
| --- | --- | --- |
| `MethodArgumentNotValidException` | `@Valid`の検証時点（Controllerの引数を組み立てる段階） | 400 |
| `InvalidRequestException` | Service層での業務ルール照合時点 | 400 |
| `ResourceNotFoundException` | 指定されたIDそのものが存在しない | 404 |

同じ400でも、前者2つは発生する層が異なります。「リクエストの形は正しいが中身が矛盾している」場合と「形そのものが不正」の場合を、例外クラスとして分けて扱っています。

### あえて何も足していない部分：`HttpMessageNotReadableException`

不正なJSON（壊れた構文、日付として解釈できない文字列など）を送ると、Jacksonが`@RequestBody`をデシリアライズする段階で失敗し、`HttpMessageNotReadableException`が投げられます。

```
POST /api/cards
{"boardId":1,"title":"日付不正","dueDate":"2026-13-99"}

→ HTTP/1.1 400

{"detail":"Failed to read request","instance":"/api/cards","status":400,"title":"Bad Request"}
```

この例外には専用のハンドラを追加していません。理由は、Bean Validationの400（「値は形式的に正しいが制約を満たさない」）と違い、こちらは「JSONとして解釈できない」というより低いレベルの失敗であり、フィールド単位のメッセージを組み立てる意味が薄いためです。Boot既定の`ProblemDetailsExceptionHandler`がそのまま処理するのに任せています。「必要になったら足す」という判断そのものも、[README.mdの更新ルール](./README.md#このドキュメントの更新ルール)に沿って記録しておきます。

---

## 31. 登録処理の中身

### 書き込み側の`@Transactional`

`CardService`・`BoardService`はどちらもクラスに`@Transactional(readOnly = true)`（[20章](./06-service-controller.md#20-service層とtransactional)）が付いています。書き込みを行う`create`メソッドには、クラスの指定を上書きする形で個別に`@Transactional`を付けます。

```java
@Transactional
public CardResponse create(CardCreateRequest request) {
	// ...
}
```

`readOnly = true`のままだと、20章で見たとおりHibernateのダーティチェック省略やJDBCの`Connection.setReadOnly(true)`が働き、書き込みが想定通りに行われない可能性があります。メソッド単位のアノテーションはクラス単位の指定より優先されるため、この1行だけで「このメソッドだけは書き込みを行う」と明示できます。

### `@CreationTimestamp`・`@UpdateTimestamp`と`@ColumnDefault`の役割分担——実際に起きたNOT NULL違反

`Card`・`Board`エンティティには元々`@ColumnDefault("now()")`が付いていました。「DBのDEFAULT句に対応する値」（[11章](./03-entity-jpa.md#11-エンティティの基本アノテーション)）という説明の通りですが、これだけでは新規作成が**動きません**。

```java
@Column(name = "created_at", nullable = false)
@ColumnDefault("now()")
private OffsetDateTime createdAt;
```

`@ColumnDefault`はテーブル生成（DDL）に`DEFAULT now()`という句を刻むだけのアノテーションです。Hibernateが実行するINSERT文は、値をJavaコードに一切書いていなくても**全カラムを明示的に列挙**します。

実際に開発環境のログ（`logging.level.org.hibernate.SQL=debug`。[04-profiles.md 16章](./04-profiles.md#16-環境ごとの設定切り替えプロファイル)）で確認したINSERT文は次のとおりです。

```sql
insert into card (board_id, created_at, description, due_date, is_archived, position, status, title, updated_at)
values (?, ?, ?, ?, ?, ?, ?, ?, ?)
```

`createdAt`フィールドに何もセットしなければ、このINSERT文の`created_at`列には`null`がバインドされます。DBのDEFAULT句は「INSERT文がそのカラムに**一切触れなかった**場合」にしか働かないため、明示的に`null`を渡された時点でDEFAULTは適用されず、`created_at`は`NOT NULL`制約なのでエラーになります——という事態を、実装時に実際に踏みかけました。

解決策は、Hibernate拡張の`@CreationTimestamp`・`@UpdateTimestamp`を追加することです。

```java
@Column(name = "created_at", nullable = false)
@ColumnDefault("now()")
@CreationTimestamp
private OffsetDateTime createdAt;

@Column(name = "updated_at", nullable = false)
@ColumnDefault("now()")
@UpdateTimestamp
private OffsetDateTime updatedAt;
```

| アノテーション | いつ値をセットするか |
| --- | --- |
| `@CreationTimestamp` | INSERT直前、Java側（アプリケーションサーバー）の現在時刻を1回だけセットする |
| `@UpdateTimestamp` | INSERT時は`@CreationTimestamp`と同様にセットし、UPDATE時（本プロジェクトは未実装）にも都度セットし直す |

`@ColumnDefault`を削除しなかったのは、`db/seed/dummy-data.sql`のようにHibernateを経由しない直接INSERT（アプリのコードが一切関与しない経路）に対する保険としての役割が別にあるためです。**「Hibernate経由のINSERTを守るのは`@CreationTimestamp`、それ以外の直接INSERTを守るのは`@ColumnDefault`」**という、[29章](#29-リクエストdtoとbean-validation)の多重防御と同じ発想の役割分担です。

### `position`の採番

同一ボード・同一ステータス内での表示順（`position`）は、既存の最大値に1を足す形で決めます。

```java
@Query("select coalesce(max(c.position), 0) from Card c where c.board.id = :boardId and c.status = :status")
Integer findMaxPosition(@Param("boardId") Integer boardId, @Param("status") String status);
```

`coalesce(max(...), 0)`の`coalesce`は、SQL標準の集約関数`max`が対象行0件のとき`NULL`を返すことへの対処です。「カードが1件も無いボードへの最初の1件」のような場合でも、`coalesce`がSQL側で`0`という既定値を用意しておいてくれるため、呼び出し側（Service）は常に「戻り値+1」という同じ計算で済みます。

アーカイブ済みのカードもこの集計対象に含めている（`isArchived`で絞り込んでいない）点に注意してください。もし除外すると、「todo列に3件→全部アーカイブ→新規作成」という流れでpositionが1から採番され直し、アーカイブ済みカードを後で復帰させたときに同じpositionのカードが2件できてしまいます。「同一ボード・同一ステータスに**存在したことがある**全カード」を母集団にして初めて、positionの一意性が保てます。

### `findById`と`getReferenceById`——早く失敗させる選択

カード作成時、指定された`boardId`のボードを取得する方法は2通りあります。

```java
// 採用した方法：実体を取得する（SELECTが1本発行される）
Board board = boardRepository.findById(request.boardId())
		.orElseThrow(() -> new ResourceNotFoundException("ボードが見つかりません（id=" + request.boardId() + "）"));
```

```java
// 採用しなかった方法：IDだけを持つプロキシを取得する（SELECTは発行されない）
Board board = boardRepository.getReferenceById(request.boardId());
```

`getReferenceById`はSELECTを1本省ける代わりに、存在しないIDを渡してもこの時点では**例外が起きません**（プロキシの生成自体はIDの実在を確認しないため）。実際に問題が表面化するのは、このプロキシを使って`Card`をINSERTしようとした瞬間、外部キー制約違反というデータベース由来のエラーになったときです。これは「何が」「なぜ」失敗したのかが呼び出し元から分かりにくく、`ResourceNotFoundException`のような意味のある404にも変換しにくいエラーです。今回は「無いものは早い段階ではっきり404にする」ことを優先し、1本余分なSELECTを許容して`findById`を使っています。

### `save()`は`persist`か`merge`か——`CardLabel`の複合主キー

ラベルの紐付け（`card_label`への行追加）は、[13章](./03-entity-jpa.md#13-複合主キー)の複合主キーエンティティ`CardLabel`を新規作成する処理です。

```java
CardLabel cardLabel = new CardLabel();
cardLabel.setCard(saved);
cardLabel.setLabel(label);
// cardLabel.setId(...) は呼ばない
cardLabelRepository.saveAll(cardLabels);
```

`CardLabel`の主キー（`id`フィールド、`@EmbeddedId`）を意図的にセットしていません。Spring Data JPAの`save()`は、渡されたエンティティが「新規」か「既存」かを`isNew()`という判定で振り分け、新規なら`EntityManager.persist()`（INSERT）を、既存なら`merge()`（SELECTで既存行を確認してからUPDATEまたはINSERT）を呼びます。`isNew()`の既定の判定基準は「主キーが`null`かどうか」です。`id`をセットしないまま`save()`すれば「新規」と判定され、`persist()`一発でシンプルにINSERTされます。

もし`new CardLabelId(saved.getId(), label.getId())`のように自分で複合主キーを組み立てて`setId(...)`していたら、`isNew()`は「主キーがある＝既存」と誤認し、`merge()`という不要なSELECTを挟む回り道になっていたはずです。`id`を自分でセットしなくても正しくINSERTできるのは、`@MapsId`（[13章](./03-entity-jpa.md#13-複合主キー)）が`card`・`label`フィールドに設定済みの関連からID部分を自動的に導出してくれるためです。ただしこれが機能する前提として、導出元である`saved.getId()`が**この時点で既に確定していること**が必要です。`Card`は`@GeneratedValue(strategy = GenerationType.IDENTITY)`（[11章](./03-entity-jpa.md#11-エンティティの基本アノテーション)）のため、`IDENTITY`戦略はDBに採番を委ねる都合上、INSERTをその場で即座に実行しないとIDが分からず、Hibernateは`cardRepository.save(card)`の呼び出し中に実際のINSERTを発行します。そのため`save()`の戻り値である`saved`の`getId()`は、次の行の時点で確実に値を持っています。

### JPQL実行時の自動flush

カード作成の最後は、[22章](./06-service-controller.md#22-dtoレコードでエンティティを外に出さない)と同じ`toResponses(...)`（レスポンスDTOへの変換）を呼び出して締めくくります。

```java
return toResponses(List.of(saved)).get(0);
```

`toResponses`の内部では`CardLabelRepository.findAllWithLabelByCardIdIn(...)`というJPQLクエリを実行しており、これは直前に`cardLabelRepository.saveAll(...)`で永続化コンテキストに乗せたばかりの`card_label`行を対象にしています。INSERT文がまだDBに送信されていない状態でSELECTを実行すれば、作成したばかりのラベル付与が結果に含まれないはずですが、実際には正しく反映されます。これは、Hibernateの既定のフラッシュモード（`FlushModeType.AUTO`）が「クエリを実行する直前に、保留中の変更を自動的にDBへ送信する」という動作をするためです。永続化コンテキストの変更内容とクエリの実行結果の間に食い違いが起きないよう、Hibernateが自動的に同期を取ってくれています。

---

## 32. アプリケーション層での重複・許可値チェック

ラベル新規作成（要件定義5.5、`POST /api/boards/{id}/labels`）の`BoardService.createLabel`には、これまでの`create`系メソッドには無かった2種類の検証が登場します。

```java
if (!ALLOWED_LABEL_COLORS.contains(request.color())) {
	throw new InvalidRequestException("許可されていない色です");
}
String name = request.name().trim();
if (labelRepository.existsByBoardIdAndName(boardId, name)) {
	throw new InvalidRequestException("同じ名前のラベルが既に存在します");
}
```

どちらも[29章](#29-リクエストdtoとbean-validation)の`@NotBlank`・`@Size`では表現できません。「色が空でないか」「名前が空でないか」という**形式**はBean Validation（`LabelCreateRequest`）が担いますが、「その色が既定パレットに含まれるか」「その名前が同じボード内で重複していないか」は、アプリケーションが持つデータ（許可リスト・DBの既存行）と突き合わせないと判定できない**業務ルール**であり、[31章](#31-登録処理の中身)で見た`InvalidRequestException`の出番です。`CardService.create`のラベルID存在チェック（[30章](#30-バリデーションエラーを400で返す)の表）と同じ切り分け方の3つ目の実例になります。

### なぜDBのUNIQUE制約を使わないのか

「同一ボード内でラベル名を重複させない」だけなら、DB側に`(board_id, name)`のUNIQUE制約を張る選択肢もあります。今回はそちらを採らず、`existsByBoardIdAndName`によるアプリ層のチェックだけにしました。

```java
boolean existsByBoardIdAndName(Integer boardId, String name);
```

理由は2つあります。

1. **エラーの質**：UNIQUE制約違反はDBが`DataIntegrityViolationException`（Spring Data JPAが変換する汎用の例外）としてはじき返します。`GlobalExceptionHandler`にはこの例外専用のハンドラが無いため、素通りすれば意図しない500（内部サーバーエラー）としてクライアントに返ってしまいます。事前にアプリ層で確認し、`InvalidRequestException`という「何が悪かったかを言葉で説明できる」例外に変換してから返す方が、フロントエンドにとって扱いやすいレスポンスになります。
2. **`ddl-auto=update`との相性**：本プロジェクトのスキーマは`spring.jpa.hibernate.ddl-auto=update`（[16章](./04-profiles.md#16-環境ごとの設定切り替えプロファイル)）でエンティティから自動生成されています。`update`モードは新しいテーブル・カラムの追加には対応しますが、既存テーブルへの制約追加を確実に行うとは限りません。`@Table(uniqueConstraints = ...)`をエンティティに書き足しても、既に起動済みの環境ではDB側の制約が反映されない可能性があります（`BoardCreateRequest`のクラスコメントに書かれている、ボード名の一意制約をあえて設けていない理由とも共通する注意点です）。

この2点から、**「重複を防ぐ」という目的そのものはDB制約でもアプリ層でも達成できますが、「防いだ結果をどう利用者に伝えるか」まで含めて考えると、今回はアプリ層でのチェックの方が実装コストに見合う**と判断しました。この判断はデータの整合性を100%保証するものではありません（同時に2件の作成リクエストが飛べば、`existsByBoardIdAndName`のSELECTと`save()`のINSERTの間ですり抜けが起きる可能性があります）。CardService・BoardServiceのposition採番が抱えているのと同じ種類のレースコンディションで、個人利用アプリの規模では許容する、という既存の割り切り（[31章](#31-登録処理の中身)）に揃えています。

### プリセットパレットをどこに持たせるか

色の許可リストは、`CardService.INITIAL_STATUS`（[31章](#31-登録処理の中身)）と同じ考え方で、使う場所（`BoardService`）に閉じた`private static final`定数として持たせています。

```java
private static final Set<String> ALLOWED_LABEL_COLORS = Set.of(
		"#e74c3c", "#e67e22", "#f1c40f", "#2ecc71",
		"#3498db", "#9b59b6", "#e84393", "#7f8c8d");
```

この8色はフロントエンドの`frontend/src/lib/labelColors.ts`にも同じ値・同じ順序で存在します（[docs/react/08-form-and-mutation.md 21章](../react/08-form-and-mutation.md#21-フォームの中でネストした作成を行う)参照）。2箇所に同じ値を重複して持たせているのは、本プロジェクトがまだ「バックエンドとフロントエンドで定数を共有する仕組み」（例：OpenAPIからの型生成）を持っていないためで、値がずれた場合は「フロントで選べた色がバックエンドで拒否される（400）」という形で気づける、という程度の緩い保証にとどまります。

---

*本ドキュメントは開発と並行して育てていく学習ノートです。実装で分からない概念が出てきたら、まずここに解説がないか確認し、無ければ追記してください。*
