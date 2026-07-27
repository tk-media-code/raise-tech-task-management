# クラスの構成要素

[← Java学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **6〜11章** をまとめています。

---

## 6. クラスの構成要素

> **クラスとは？**
> データ（フィールド）と、そのデータを扱う処理（メソッド）をひとまとめにした設計図です。この設計図から実際に作られた実体を**インスタンス**（またはオブジェクト）と呼びます。

本プロジェクトで最もシンプルな`Board`エンティティを教材にします。

```java
@Entity
@Table(name = "board")
public class Board {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Integer id;

	@Column(nullable = false)
	private String name;

	@Column(nullable = false)
	private Integer position;

	@Column(name = "created_at", nullable = false)
	@ColumnDefault("now()")
	private OffsetDateTime createdAt;

	public Integer getId() {
		return id;
	}

	public void setId(Integer id) {
		this.id = id;
	}

	// name, position, createdAt のgetter/setterは同じ形なので省略
}
```

| 構成要素 | このクラスでの該当箇所 | 役割 |
| --- | --- | --- |
| フィールド | `id`・`name`・`position`・`createdAt` | インスタンスが保持するデータ |
| コンストラクタ | このクラスには明示的な記述が無い | インスタンスを作るときに呼ばれる初期化処理（[8章](#8-コンストラクタとオーバーロード)） |
| メソッド | `getId()`・`setId(Integer id)`など | インスタンスに対する操作 |

`Board`クラスにはコンストラクタが1つも書かれていません。コンストラクタを1つも書かなかった場合、Javaは自動的に「引数無し・処理内容も無し」の**デフォルトコンストラクタ**を用意します。`new Board()`と書けるのはこのためです。

---

## 7. アクセス修飾子

> **アクセス修飾子とは？**
> クラス・フィールド・メソッドに対して、「どこから参照・呼び出しできるか」という公開範囲を指定するキーワードです。

Javaには次の4段階があります。

| 修飾子 | 参照できる範囲 | 本プロジェクトでの使用状況 |
| --- | --- | --- |
| `public` | どこからでも | 全エンティティ・Service・Controllerのクラス自体、getter/setter、APIとして呼ばれるメソッド |
| `protected` | 同じパッケージ内 ＋ 別パッケージのサブクラス | **未使用**（継承を使う設計が無いため） |
| （何も書かない＝package-private） | 同じパッケージ内のみ | `TaskManagementApplicationTests`（テストクラス自体とテストメソッド）のみ |
| `private` | 同じクラス内のみ | 全エンティティのフィールド、Service間で共有しない内部処理 |

`Board`エンティティのフィールドは全て`private`です。

```java
@Column(nullable = false)
private String name;
```

`name`フィールドはクラスの外から直接触れず、必ず`getName()`・`setName(String name)`というメソッド（**アクセサ**と呼びます）を経由します。フィールドを直接公開しない理由は、「値を設定するときに検証を挟みたくなった」「内部の持ち方を変えたくなった」といった将来の変更を、アクセサの中身を書き換えるだけで済ませられるようにするためです（呼び出す側のコードは`board.getName()`のままで影響を受けません）。

package-privateの例は、唯一のテストクラスに現れます。

```java
@SpringBootTest
class TaskManagementApplicationTests {

	@Test
	void contextLoads() {
	}

}
```

`class`の前にも`void contextLoads()`の前にも`public`が付いていません。JUnit 5ではテストクラス・テストメソッドを`public`にする必要が無く、同じパッケージ内のテストランナーから呼び出せれば十分なため、package-privateのままにするのが一般的です。

> **PHPとの対比**
> PHPのクラスにも`public`・`protected`・`private`があり、意味もほぼ同じです。ただしPHPには「何も書かない」という4段階目（package-private）に相当するものが無く、修飾子を省略すると`public`扱いになる点が異なります。またPHPには名前空間単位でのアクセス制御という概念自体が存在しません。

---

## 8. コンストラクタとオーバーロード

> **コンストラクタとは？**
> `new`でインスタンスを作るときに呼ばれる、初期化専用の特殊なメソッドです。クラス名と同じ名前を持ち、戻り値の型を書きません。

本プロジェクトで唯一、同じクラスに複数のコンストラクタを持つのが`CardLabelId`です。

```java
@Embeddable
public class CardLabelId implements Serializable {

	@Column(name = "card_id")
	private Integer cardId;

	@Column(name = "label_id")
	private Integer labelId;

	// JPAがリフレクション経由でインスタンス化する際に必要なデフォルトコンストラクタ
	public CardLabelId() {
	}

	public CardLabelId(Integer cardId, Integer labelId) {
		this.cardId = cardId;
		this.labelId = labelId;
	}

	// ...
}
```

同じ`CardLabelId`という名前でも、引数の型・個数が異なる複数のコンストラクタを定義できます。これを**オーバーロード**（多重定義）と呼びます。`new CardLabelId()`と書けば無引数版が、`new CardLabelId(1, 2)`と書けば2引数版が、コンパイラによって自動的に選ばれます。

無引数のコンストラクタは通常であれば自動的に用意されますが（[6章](#6-クラスの構成要素)）、`CardLabelId`のように**1つでも明示的にコンストラクタを書くと、自動生成は行われなくなります**。JPAがインスタンスを作る際にこの無引数コンストラクタを必要とするため、ここでは意図的に空の`CardLabelId()`を残しています。

### `this`キーワード

2引数コンストラクタの中の`this.cardId = cardId;`に登場する`this`は、「今まさに作られようとしているインスタンス自身」を指す参照です。引数名`cardId`とフィールド名`cardId`が同じ名前のため、`this.cardId`（フィールドの方）と書くことで、ただの`cardId`（引数の方）と区別しています。`this`にはもう1つ、「自分自身」という値そのものとして使われる用法もあります（[16章](./03-type-system.md#16-objectequalsとhashcode)の`this == o`）。

---

## 9. `static`

> **`static`とは？**
> フィールドやメソッドに付けると、「特定のインスタンスに属さない」ものになります。インスタンスを1つも作らなくても、`クラス名.メソッド名()`の形でそのまま呼び出せます。

最も身近な`static`は、アプリケーションの起動地点です。

```java
@SpringBootApplication
public class TaskManagementApplication {

	public static void main(String[] args) {
		SpringApplication.run(TaskManagementApplication.class, args);
	}

}
```

`main`メソッドが`static`なのは、プログラムの実行開始時点ではまだ`TaskManagementApplication`のインスタンスが1つも存在しないためです。JVMは`new`でインスタンスを作ることなく、`TaskManagementApplication.main(...)`という形でこのメソッドを直接呼び出します。

`CardService`・`BoardService`のエンティティ→DTO変換メソッドも`private static`です。

```java
private static CardResponse toCardResponse(Card card, List<LabelResponse> labels) {
	// card.getBoard() は join fetch 済みのため、ここで呼んでも追加SQLは発生しない
	return new CardResponse(
			card.getId(),
			card.getBoard().getId(),
			card.getBoard().getName(),
			card.getTitle(),
			card.getDescription(),
			card.getDueDate(),
			card.getStatus(),
			card.getIsArchived(),
			card.getPosition(),
			labels);
}
```

このメソッドは、引数として渡された`card`・`labels`だけを使って結果を組み立てており、`CardService`自身が持つフィールド（`cardRepository`など）には一切アクセスしていません。「そのインスタンス固有の状態を必要としない処理である」ことが`static`にできる条件であり、逆に言えば`static`メソッドの中では、`static`でないフィールドやメソッドを（インスタンスを明示せずに）使うことはできません。

---

## 10. `final`

> **`final`とは？**
> 変数・フィールドに付けると、一度代入した値を**以後変更できなく**します。「不変にする」というより「再代入を禁止する」という理解が正確です。

`BoardService`のフィールドは`final`で宣言されています。

```java
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

`boardRepository`・`labelRepository`は、コンストラクタの中で一度だけ値を代入され、以後どのメソッドからも再代入されません。IoCコンテナが起動時に依存先のBeanを渡すコンストラクタインジェクション（[3章](../spring-boot/01-architecture.md#3-di依存性注入とiocコンテナ)）は、「一度組み立てたら差し替わらない」という性質と相性がよく、依存先を`final`で宣言するのが定石になっています。

`final`が「値の変更を禁止する」のはあくまで**フィールド自身への再代入**であり、参照先のオブジェクトの中身まで変更不可にするわけではない点に注意してください。仮に`boardRepository`が指す先のオブジェクトが内部状態を持ち、それを書き換えるメソッドを持っていたとしても、`final`はそれを妨げません。`final`が禁止しているのは、あくまで`boardRepository = 別のインスタンス;`のような**フィールドの差し替え**です。

---

## 11. メソッドのオーバーロード

[8章](#8-コンストラクタとオーバーロード)ではコンストラクタのオーバーロードを扱いましたが、通常のメソッドも同様に、同じ名前で引数の型が異なる複数のバージョンを定義できます。`BoardService`には、同名の`toResponse`が2つ存在します。

```java
private static BoardResponse toResponse(Board board) {
	return new BoardResponse(board.getId(), board.getName(), board.getPosition(), board.getCreatedAt());
}

private static LabelResponse toResponse(Label label) {
	return new LabelResponse(label.getId(), label.getName(), label.getColor());
}
```

引数の型が`Board`か`Label`かによって、コンパイラがどちらの`toResponse`を呼び出すかを**コンパイル時に**決定します（戻り値の型だけが異なるオーバーロードは認められません。あくまで引数の型・個数の違いで区別します）。呼び出す側は`toResponse(board)`・`toResponse(label)`のように書き分けるだけで、まるで1つの名前が「相手に応じて振る舞いを変える」ように見えます。

📄 この2つの`toResponse`は、[05-lambda-stream.md](./05-lambda-stream.md)の[22章](./05-lambda-stream.md#22-メソッド参照)で、メソッド参照`BoardService::toResponse`が呼び出し文脈ごとに異なるオーバーロードへ解決される例として再び登場します。
