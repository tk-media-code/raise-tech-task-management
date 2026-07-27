# ジェネリクスとコレクション

[← Java学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **18〜20章** をまとめています。

---

## 18. ジェネリクス

> **ジェネリクスとは？**
> クラスやインターフェースが扱うデータ型を、`<>`の中に書く**型引数**として後から指定できるようにする仕組みです。「同じ実装を、色々な型に対して使い回す」ことと、「コンパイル時に正しい型が使われているかチェックする」ことを両立させます。

本プロジェクトのRepositoryは、いずれもジェネリクスを使う`JpaRepository<T, ID>`を継承しています。

```java
public interface BoardRepository extends JpaRepository<Board, Integer> {
```

`JpaRepository`は「どのエンティティを、どの型の主キーで扱うか」をあらかじめ決め打ちせず、`T`（対象エンティティ型）と`ID`（主キー型）という2つの**型引数**として宣言しているインターフェースです。`JpaRepository<Board, Integer>`と書くことで「`T`は`Board`、`ID`は`Integer`」に具体化され、`findById(Integer id)`が`Optional<Board>`を返す、というように、このインターフェースの中の型が一括で置き換わります。同じ`JpaRepository`の仕組みを、`CardRepository`では`JpaRepository<Card, Integer>`、`CardLabelRepository`では`JpaRepository<CardLabel, CardLabelId>`（[13章](./03-type-system.md#13-インターフェースとimplements)の複合主キー）として、それぞれ異なる型の組み合わせで再利用しています。

型引数は入れ子にすることもできます。`CardService`には次のような宣言があります。

```java
Map<Integer, List<LabelResponse>> labelsByCardId = cardLabels.stream()
		.collect(/* 中身は23章のCollectors.groupingBy */);
```

`Map<Integer, List<LabelResponse>>`は、「キーが`Integer`、値が`List<LabelResponse>`であるMap」という意味です。値の型として指定した`List<LabelResponse>`自身も、さらに`LabelResponse`という型引数を持つジェネリックな型になっています。

ジェネリクスの型引数には、`int`や`boolean`のようなプリミティブ型（[5章](./01-basics.md#5-プリミティブ型とラッパークラス)）を直接書けません。`List<Integer>`とは書けても`List<int>`とは書けないのはこのためで、コレクションに数値を入れたい場合は必ずラッパークラスを使います。

本プロジェクトのコードは、`JpaRepository<Board, Integer>`や`List<Card>`のように**既存のジェネリッククラス・インターフェースを利用する側**としてのみジェネリクスに触れており、`class Box<T> { ... }`のような独自の型パラメータを持つクラスを自分で定義している箇所はありません。そのため、ここではジェネリクスの構文を「読めるようになる」ことを目標とし、境界（`<T extends Xxx>`）やワイルドカード（`<? extends Xxx>`）といった発展的な話題は扱いません。

---

## 19. コレクション

> **コレクションとは？**
> 複数の要素をまとめて扱うためのオブジェクト群の総称です。`List`・`Set`・`Map`はいずれも**インターフェース**であり、`ArrayList`や`HashMap`のような具体的な実装クラスがそれを実装しています。

本プロジェクトのコードは、変数の型やメソッドの戻り値の型として`List`・`Map`・`Collection`を使いますが、`new ArrayList<>()`のように自分でコレクションのインスタンスを組み立てている箇所はありません。代わりに、次のような不変・既製のコレクションを返す書き方が使われています。

```java
// labelIds: 未指定または空リストなら絞り込みを行わない。
// id は 1 から採番されるため、0 はどのラベルにも一致しない安全な番兵値。
List<Integer> labelIds = filterByLabels ? condition.labelIds() : List.of(0);
```

```java
if (cards.isEmpty()) {
	return List.of();
}
```

`List.of(...)`は、Java 9以降で追加された**不変リスト**を作るファクトリメソッドです。`List.of(0)`は要素が1つだけの、`List.of()`は要素が0個の不変リストを返します。「不変」とは、生成した後に`add`や`remove`で要素を変更しようとすると`UnsupportedOperationException`が発生するという意味です。呼び出し側に「このリストを書き換えないでほしい」という意図を、コメントではなく型のレベルで伝えられます。

`CardService`にはもう1箇所、既製のコレクションを使う場面があります。

```java
return cards.stream()
		.map(card -> toCardResponse(card, labelsByCardId.getOrDefault(card.getId(), Collections.emptyList())))
		.toList();
```

`Map.getOrDefault(key, デフォルト値)`は、指定したキーが`Map`に存在すればその値を、存在しなければ第2引数で渡したデフォルト値を返すメソッドです。ここでは「そのカードにラベルが1つも無い」場合に、`null`ではなく`Collections.emptyList()`（要素0個の不変リスト）を使うことで、呼び出し側が「ラベルが無いこと」と「取得に失敗したこと」を区別せずに、そのまま空のリストとして扱えるようにしています。

最後に、`Collectors.groupingBy`（[23章](./05-lambda-stream.md#23-stream-api)で詳しく扱います）の中で使われている`LinkedHashMap::new`にも触れておきます。

```java
Map<Integer, List<LabelResponse>> labelsByCardId = cardLabels.stream()
		.collect(Collectors.groupingBy(
				cl -> cl.getId().getCardId(),
				LinkedHashMap::new,
				Collectors.mapping(CardService::toLabelResponse, Collectors.toList())));
```

`Map`の代表的な実装クラスである`HashMap`は、キーを走査した際の順序を保証しません。`LinkedHashMap`は`HashMap`と同じ機能を持ちながら、**挿入した順序を保って**走査できる実装クラスです。ここでグルーピング結果の`Map`実装として`LinkedHashMap`を明示的に指定しているのは、SQLの`order by`で並べた順序（[19章](../spring-boot/05-repository.md#19-queryとjpql動的な絞り込み)）を、Java側での加工後も崩さずに保つためです。

---

## 20. `Optional`

> **`Optional`とは？**
> 「値が存在するかもしれないし、存在しないかもしれない」ことを、`null`を直接返すのではなく型として表現するためのクラスです。`Optional<Card>`は「`Card`が入っているか、空である」ことを表します。

本プロジェクトでは、1件取得系のRepositoryメソッドの戻り値として使われています。

```java
@Query("select c from Card c join fetch c.board where c.id = :id")
Optional<Card> findByIdWithBoard(@Param("id") Integer id);
```

該当する`Card`が見つかれば値の入った`Optional`が、見つからなければ空の`Optional`が返ります。呼び出す側は、`Optional`のメソッドを使って「値がある場合／無い場合」の処理を書きます。本プロジェクトで使われているのは`orElseThrow`です。

```java
Card card = cardRepository.findByIdWithBoard(id)
		.orElseThrow(() -> new ResourceNotFoundException("カードが見つかりません（id=" + id + "）"));
```

`orElseThrow(供給元)`は、値があればその値を取り出して返し、無ければ引数に渡した処理（ここでは`() -> new ResourceNotFoundException(...)`という**ラムダ式**）を実行して、その結果の例外を投げます。ラムダ式そのものの読み方は[21章](./05-lambda-stream.md#21-ラムダ式と関数型インターフェース)で扱いますが、ここでは「`Optional`が空だった場合の代替処理を、その場で書ける」という`Optional`側の使い方として押さえてください。

`Optional`を使う最大の利点は、戻り値の型を見ただけで「これは無い場合があり得るので、呼び出し側は必ず対処を書く必要がある」ということが伝わる点です。ただの`Card`を返すメソッドであれば、呼び出し側は「常に値が返ってくる」と誤解して`null`チェックを省いてしまうかもしれませんが、`Optional<Card>`という戻り値の型自体が、その可能性をコード上に明示しています。
