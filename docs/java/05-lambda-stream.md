# ラムダ式とStream API

[← Java学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **21〜23章** をまとめています。

---

## 21. ラムダ式と関数型インターフェース

> **ラムダ式とは？**
> 「引数を受け取って処理をし、値を返す」という一連の処理を、メソッドとして名前を付けずにその場で書ける構文です。`(引数) -> 処理`という形をしています。

ラムダ式は、単独では存在できません。必ず**関数型インターフェース**（抽象メソッドをただ1つだけ持つインターフェース）の代わりとして使われます。ラムダ式`(引数) -> 処理`は、「その関数型インターフェースが持つ唯一の抽象メソッドを、この引数・この処理で実装したインスタンス」として扱われます。

本プロジェクトには3つのラムダ式が登場します。1つ目は`BoardService`・`CardService`に共通する、`Optional`（[20章](./04-generics-collections.md#20-optional)）の`orElseThrow`に渡す形です。

```java
Board board = boardRepository.findById(id)
		.orElseThrow(() -> new ResourceNotFoundException("ボードが見つかりません（id=" + id + "）"));
```

`() -> new ResourceNotFoundException(...)`は「引数を受け取らず、`ResourceNotFoundException`のインスタンスを返す処理」です。`orElseThrow`は`Optional`が空だったときに初めてこのラムダ式を実行し、その結果を`throw`します。値がある間はこのラムダ式自体が呼ばれることはありません。

残る2つは`CardService`の中、Stream API（[23章](#23-stream-api)）の引数として登場します。

```java
Map<Integer, List<LabelResponse>> labelsByCardId = cardLabels.stream()
		.collect(Collectors.groupingBy(
				cl -> cl.getId().getCardId(),
				LinkedHashMap::new,
				Collectors.mapping(CardService::toLabelResponse, Collectors.toList())));

return cards.stream()
		.map(card -> toCardResponse(card, labelsByCardId.getOrDefault(card.getId(), Collections.emptyList())))
		.toList();
```

`cl -> cl.getId().getCardId()`と`card -> toCardResponse(card, ...)`は、どちらも引数が1つのラムダ式です。引数が1つだけの場合、`(cl) ->`のような丸括弧と、`(CardLabel cl) ->`のような型注釈のどちらも省略できます。引数の型は、このラムダ式が渡される先（ここでは`groupingBy`や`map`が受け取る関数型インターフェースの型引数）からコンパイラが逆算して決めており、これも[4章](./01-basics.md#4-静的型付け変数に型を書くということ)の静的型付けの一形態です。

> **JavaScriptとの対比**
> JavaScriptのアロー関数`(x) => x + 1`も見た目はよく似ていますが、JavaScriptでは関数を単なる「値」としてそのまま変数に代入したり引数として渡したりできます。Javaのラムダ式は、必ず「対応する関数型インターフェース」という受け皿の型が決まっている必要があり、その型が持つ唯一の抽象メソッドのシグネチャ（引数の個数・型、戻り値の型）に一致しないラムダ式は書けません。「関数がどんな型を持つか」を常に静的に確定させる、という点がJavaらしい制約です。

Java標準ライブラリには、`java.util.function`パッケージに`Function<T, R>`（引数を受け取り値を返す）・`Supplier<T>`（引数無しで値を返す）・`Predicate<T>`（引数を受け取り`boolean`を返す）といった汎用の関数型インターフェースが用意されており、`Optional.orElseThrow`や`Stream.map`はこれらを引数の型として受け取ります。本プロジェクトのコードでは、これらの型名が変数の宣言などに明示的に書かれることはなく、常にメソッドの引数としてその場でラムダ式を渡す形で使われています。

---

## 22. メソッド参照

> **メソッド参照とは？**
> 「渡す処理の中身が、既存のメソッドをそのまま呼び出すだけ」というときに、ラムダ式をさらに短く書ける構文です。`型名::メソッド名`、または`インスタンス::メソッド名`の形をしています。

本プロジェクトには、メソッド参照の主要な3種類がすべて登場します。

### static メソッドへの参照

```java
public List<BoardResponse> findAll() {
	return boardRepository.findAllByOrderByPositionAscIdAsc().stream()
			.map(BoardService::toResponse)
			.toList();
}

public List<LabelResponse> findLabelsByBoardId(Integer boardId) {
	// ...
	return labelRepository.findByBoardIdOrderByIdAsc(boardId).stream()
			.map(BoardService::toResponse)
			.toList();
}
```

`BoardService::toResponse`は、[11章](./02-class-and-object.md#11-メソッドのオーバーロード)で見た、オーバーロードされた2つの`private static`メソッドのどちらかを指します。同じ`BoardService::toResponse`という書き方でも、1つ目の`.map`はStreamの要素が`Board`なので`toResponse(Board board)`に、2つ目の`.map`は要素が`Label`なので`toResponse(Label label)`に、コンパイラが呼び出し文脈から**それぞれ別のオーバーロードを解決**します。`BoardService::toResponse`は、前者では`board -> BoardService.toResponse(board)`と、後者では`label -> BoardService.toResponse(label)`と書いたのとそれぞれ同じ意味になります。

### 未束縛のインスタンスメソッドへの参照

```java
List<Integer> cardIds = cards.stream().map(Card::getId).toList();
```

`Card::getId`は、`Card`クラスの`getId()`という**インスタンスメソッド**への参照です。`BoardService::toResponse`との違いは、「どのインスタンスに対して呼び出すか」がこの時点ではまだ決まっていない点です。`.map(Card::getId)`と書くと、Streamが流れてくる各要素（`card`）自身がレシーバとなり、`card -> card.getId()`と書いたのと同じ意味になります。呼び出し対象のインスタンスがまだ「束縛（結び付け）」されていないことから、**未束縛（unbound）のインスタンスメソッド参照**と呼びます。

### コンストラクタへの参照

```java
Map<Integer, List<LabelResponse>> labelsByCardId = cardLabels.stream()
		.collect(Collectors.groupingBy(
				cl -> cl.getId().getCardId(),
				LinkedHashMap::new,
				Collectors.mapping(CardService::toLabelResponse, Collectors.toList())));
```

`LinkedHashMap::new`は、`LinkedHashMap`の無引数コンストラクタ（[8章](./02-class-and-object.md#8-コンストラクタとオーバーロード)）への参照です。`() -> new LinkedHashMap<>()`と書いたのと同じ意味で、「呼ばれるたびに新しい`LinkedHashMap`を1つ作って返す処理」を表します。ここでは`Collectors.groupingBy`の第2引数（結果を格納する`Map`の実装を指定する引数）として渡されています。

---

## 23. Stream API

> **Stream APIとは？**
> `List`や`Set`などのコレクションの要素を、「変換する」「集約する」といった一連の処理をメソッドチェーンで表現するための仕組みです。`.stream()`で処理の流れ（ストリーム）を作り、`.map(...)`のような**中間操作**を経て、`.toList()`や`.collect(...)`のような**終端操作**で最終的な結果を取り出します。

最も単純な形は、`Card::getId`（[22章](#22-メソッド参照)）を使った1行です。

```java
List<Integer> cardIds = cards.stream().map(Card::getId).toList();
```

`cards`（`List<Card>`）から`.stream()`で流れを作り、`.map(Card::getId)`で各`Card`を`Integer`（そのID）に変換し、`.toList()`で新しい`List<Integer>`にまとめています。`.toList()`はJava 16以降で追加された終端操作で、**変更不可（不変）のリスト**（[19章](./04-generics-collections.md#19-コレクション)の`List.of(...)`と同じ性質）を返します。

`CardService.toResponses()`には、本プロジェクトで最も複雑なStream操作が登場します。

```java
private List<CardResponse> toResponses(List<Card> cards) {
	List<Integer> cardIds = cards.stream().map(Card::getId).toList();

	List<CardLabel> cardLabels = cardLabelRepository.findAllWithLabelByCardIdIn(cardIds);

	// cardIdごとにラベルをグルーピングする。
	// Collectors.groupingByの第2引数にLinkedHashMap::newを指定し、
	// クエリのorder by（cardId昇順→labelId昇順）の並びをそのまま保持する。
	Map<Integer, List<LabelResponse>> labelsByCardId = cardLabels.stream()
			.collect(Collectors.groupingBy(
					cl -> cl.getId().getCardId(),
					LinkedHashMap::new,
					Collectors.mapping(CardService::toLabelResponse, Collectors.toList())));

	return cards.stream()
			.map(card -> toCardResponse(card, labelsByCardId.getOrDefault(card.getId(), Collections.emptyList())))
			.toList();
}
```

`Collectors.groupingBy`は、Streamの要素を「あるキーの値ごとにグループ分けする」ための`Collector`（`.collect(...)`に渡す集約処理）です。ここでは3つの引数を渡す形が使われています。

| 引数 | 役割 | このコードでの内容 |
| --- | --- | --- |
| 第1引数（classifier） | 各要素からグルーピングキーを取り出す関数 | `cl -> cl.getId().getCardId()`（各`CardLabel`が属する`cardId`） |
| 第2引数（mapFactory） | 結果を格納する`Map`の実装を生成する処理 | `LinkedHashMap::new`（[19章](./04-generics-collections.md#19-コレクション)で見た、順序保持のため） |
| 第3引数（downstream） | 同じキーに属する要素をどう集約するかを指定する、後段の`Collector` | `Collectors.mapping(CardService::toLabelResponse, Collectors.toList())` |

第3引数の`Collectors.mapping(mapper, downstream)`はさらに入れ子になっており、「各`CardLabel`をまず`CardService::toLabelResponse`で`LabelResponse`に変換し、その結果を`Collectors.toList()`で`List`に集約する」という処理を表します。全体として、「`cardId`ごとに`CardLabel`をグルーピングしながら、各要素を`LabelResponse`に変換し、`cardId`をキー・`List<LabelResponse>`を値とする`LinkedHashMap`にまとめる」という一連の処理を、1つの`.collect(...)`呼び出しで完結させています。

### `.toList()`と`Collectors.toList()`の違い

同じコードの中に、似て非なる2つの「リスト化」が登場している点に注意してください。

- `cards.stream().map(Card::getId).toList()`——**Stream自身が持つ**`.toList()`メソッド（終端操作）。変更不可のリストを返す
- `Collectors.mapping(CardService::toLabelResponse, Collectors.toList())`——`Collectors`クラスの`toList()`（`Collector`を返す）。`groupingBy`や`mapping`の引数として渡す必要がある文脈では、`Collector`型の値が必要なため`.toList()`ではなくこちらを使う

どちらも最終的には`List`を作る点は同じですが、`.toList()`はStreamの終端操作として単独で呼び出す形、`Collectors.toList()`は他の`Collector`（`groupingBy`・`mapping`など）と組み合わせる部品として使う形、という使い分けです。

> **JavaScriptとの対比**
> `.map(...)`は配列の`Array.prototype.map`とほぼ同じ発想です。大きな違いは、Javaの`Stream`は**一度しか流せない**（終端操作を呼んだ後の同じStreamインスタンスは再利用できない）ことと、中間操作（`.map`など）は終端操作（`.toList`や`.collect`など）が呼ばれるまで実際には実行されない「遅延評価」である点です。JavaScriptの`array.map(...)`はその場で新しい配列を返しますが、Javaの`.map(...)`はまだ何も実行していない「これから行う変換の予約」を返すだけで、`.toList()`や`.collect()`が呼ばれた瞬間に、Streamの先頭から一気に処理が流れます。
