# 継承・インターフェース・record

[← Java学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **12〜17章** をまとめています。

---

## 12. 継承（extends）

> **継承とは？**
> あるクラス（親クラス）が持つフィールド・メソッドを、別のクラス（子クラス）がそのまま引き継ぐ仕組みです。子クラスは親クラスの機能に加えて、独自のフィールド・メソッドを追加したり、親のメソッドを上書き（[14章](#14-オーバーライドとoverride)）したりできます。

本プロジェクトで唯一`extends`を使っているのが、独自の例外クラスです。

```java
public class ResourceNotFoundException extends RuntimeException {

	public ResourceNotFoundException(String message) {
		super(message);
	}
}
```

`ResourceNotFoundException`は`RuntimeException`を継承しているため、`RuntimeException`（さらにその親をたどると`Exception`・`Throwable`）が持つ機能——メッセージの保持、スタックトレースの記録など——をそのまま使えます。コンストラクタの中の`super(message)`は「親クラスのコンストラクタを呼び出す」という意味で、受け取った`message`を`RuntimeException`側の処理（メッセージとして保持する処理）に渡しています。独自のフィールドを追加していないため、`ResourceNotFoundException`自身のクラス本体はコンストラクタ1つだけの、ごく小さな定義で済んでいます。

> **PHPとの対比**
> PHPの`extends`もほぼ同じ考え方です。`class ResourceNotFoundException extends \RuntimeException`のように書け、親のコンストラクタを呼ぶ`parent::__construct($message)`が、Javaの`super(message)`に対応します。

---

## 13. インターフェースと`implements`

> **インターフェースとは？**
> メソッドの名前・引数・戻り値の型（シグネチャ）だけを定めた「型の契約」です。実装（処理の中身）を持たず、あるクラスが「この操作ができる」ことを型として保証するために使います。クラスが`implements`でインターフェースを実装すると、そのインターフェースが定めた全メソッドを実装する義務を負います。

本プロジェクトでの`implements`の使用例は、複合主キークラスの`Serializable`です。

```java
public class CardLabelId implements Serializable {
	// ...
}
```

`Serializable`は少し特殊な**マーカーインターフェース**で、実装すべきメソッドを1つも持ちません。「このクラスは直列化（インスタンスをバイト列に変換する処理）に対応している」という目印を型に付けるためだけに存在します。JPAの仕様上、複合主キーを表すクラスは`Serializable`を実装することが要求されているため、`CardLabelId`はこれをそのまま満たしています。

インターフェース同士でも`extends`で継承関係を持てます。本プロジェクトのRepositoryは、いずれもこの形です。

```java
public interface CardRepository extends JpaRepository<Card, Integer> {
	// ...
}
```

`CardRepository`は`interface`であり、`JpaRepository`という別のインターフェースを`extends`しています（クラスの継承と違い、インターフェースは複数同時に継承することもできます）。中身の実装を1行も書いていないのに、Spring Data JPAが起動時にこのインターフェースを実装したクラスを自動生成してくれる仕組みは、[Repository層とSpring Data JPA（17章）](../spring-boot/05-repository.md#17-repository層とspring-data-jpa)で扱っています。

> **PHPとの対比**
> PHPの`interface`・`implements`も同じ考え方です。ただしPHPのインターフェースは`extends`でしか継承できずクラスのように`implements`はできない、逆にクラスは複数のインターフェースを`implements`できる、という関係はJavaと共通しています。

---

## 14. オーバーライドと`@Override`

> **オーバーライドとは？**
> 親クラス（または実装するインターフェース）が持つメソッドと同じシグネチャのメソッドを子クラス側で定義し、処理の中身を独自のものに置き換えることです。

`CardLabelId`は、すべてのクラスの祖先である`Object`クラス（[16章](#16-objectequalsとhashcode)）が持つ`equals`・`hashCode`をオーバーライドしています。

```java
@Override
public boolean equals(Object o) {
	// ...
}

@Override
public int hashCode() {
	// ...
}
```

`@Override`は付けなくてもオーバーライド自体は成立しますが、付けておくと**コンパイラが「本当に親のメソッドを上書きできているか」を検査してくれます**。例えば`equals`のつもりで引数の型や名前を`equals(CardLabelId o)`のように誤って書いてしまうと、それは`Object.equals(Object o)`のオーバーライドにはならず「別のメソッドを新しく定義しただけ」になってしまいますが、`@Override`が付いていればこの種のミスをコンパイル時のエラーとして検出できます。書かなくても動くコードに対して安全網を追加する、実用上ほぼ必須のアノテーションです。

---

## 15. `record`

> **`record`とは？**
> フィールド・コンストラクタ・各フィールドの値を返すアクセサメソッド・`equals()`/`hashCode()`/`toString()`を、1行の宣言だけで自動生成してくれる、Java 16以降の「不変の入れ物」専用の構文です。

本プロジェクトのDTO（`dto/`パッケージ）は、すべて`record`で定義されています。

```java
public record BoardResponse(Integer id, String name, Integer position, OffsetDateTime createdAt) {
}
```

この1行だけで、次のものがすべて自動生成されます。

| 生成されるもの | 内容 |
| --- | --- |
| フィールド | `id`・`name`・`position`・`createdAt`（すべて`private final`。[10章](./02-class-and-object.md#10-final)の`final`と同様、一度組み立てたら再代入できない） |
| コンストラクタ | `BoardResponse(Integer id, String name, Integer position, OffsetDateTime createdAt)`（**カノニカルコンストラクタ**と呼ばれる） |
| アクセサ | `id()`・`name()`・`position()`・`createdAt()`（`getId()`ではなく`id()`という名前になる点に注意） |
| `equals()` / `hashCode()` | 全フィールドの値が一致するかどうかで判定（[16章](#16-objectequalsとhashcode)の定石を自動で実装してくれる） |
| `toString()` | `BoardResponse[id=1, name=..., ...]`のような、全フィールドを含む文字列 |

`record`のフィールド（**コンポーネント**と呼びます）は、宣言した順序がそのまま意味を持ちます。JSON変換時のキーの出力順も、この宣言順に一致します。DTOは「値を運ぶだけ」の役割であり、後から値を書き換える必要が無いため、手書きのgetter/setterクラス（[6〜7章](./02-class-and-object.md#6-クラスの構成要素)）よりも`record`の方が本質的に合っています。

📄 `record`をDTOとして採用している設計上の理由（なぜエンティティを直接returnしないか）は、[06-service-controller.md](../spring-boot/06-service-controller.md#22-dtoレコードでエンティティを外に出さない)の22章で解説しています。ここでは「`record`という言語構文が何を自動生成するか」に絞って説明しました。

---

## 16. `Object`（equalsとhashCode）

> **`Object`クラスとは？**
> Javaのすべてのクラスが暗黙のうちに継承している、階層の頂点に位置するクラスです。`equals`・`hashCode`・`toString`は、実は`Object`クラスがもともと持っているメソッドで、明示的に`extends`を書かなくても、どのクラスもこれらを呼び出せます。

`Object`が最初から用意している`equals`の既定の動作は、`==`と同じ「同一性」の比較——つまり「同じインスタンスかどうか」——です。異なるインスタンスであれば、たとえ全フィールドの値が一致していても`equals`は`false`を返します。この既定の動作を「値が同じなら等しいとみなす」という**同値性**の比較に変えたい場合、オーバーライドが必要です。`CardLabelId`はその典型例です。

```java
@Override
public boolean equals(Object o) {
	if (this == o) {
		return true;
	}
	if (!(o instanceof CardLabelId that)) {
		return false;
	}
	return Objects.equals(cardId, that.cardId) && Objects.equals(labelId, that.labelId);
}

@Override
public int hashCode() {
	return Objects.hash(cardId, labelId);
}
```

| 行 | やっていること |
| --- | --- |
| `if (this == o)` | 同一インスタンスなら、フィールド比較を待たずに`true`を返す（早期リターンによる最適化） |
| `if (!(o instanceof CardLabelId that))` | 比較対象が`null`か、そもそも型が違う場合に`false`を返す（[17章](#17-instanceofパターンマッチング)） |
| `Objects.equals(cardId, that.cardId)` | 両フィールドの値を比較する。`cardId.equals(that.cardId)`と書かず`java.util.Objects`のユーティリティを使うのは、フィールドが`null`のときに`NullPointerException`を起こさず安全に比較できるため |
| `Objects.hash(cardId, labelId)` | 複数フィールドの値から1つの`int`のハッシュ値を計算する |

**`equals`をオーバーライドしたら`hashCode`も必ずセットでオーバーライドする**のがJavaの規約です。「`equals`で等しいと判定される2つのインスタンスは、必ず同じ`hashCode`を返さなければならない」という規約があり、これを破ると`HashMap`・`HashSet`のようなハッシュ値に基づくコレクション（[19章](./04-generics-collections.md#19-コレクション)）に格納したときに、正しく検索・重複排除ができなくなります。

📄 `CardLabelId`でこのオーバーライドが必須になっている理由（JPAの複合主キーとしての要件）は、[03-entity-jpa.md](../spring-boot/03-entity-jpa.md#13-複合主キー)の13章で解説しています。

---

## 17. `instanceof`パターンマッチング

> **`instanceof`パターンマッチングとは？**
> `instanceof`で型を確認すると同時に、その型にキャストした変数をその場で受け取れる、Java 16以降の構文です。

[16章](#16-objectequalsとhashcode)の`equals`に登場した一行です。

```java
if (!(o instanceof CardLabelId that)) {
	return false;
}
// この行以降、o は CardLabelId として that という名前で扱える
```

`o instanceof CardLabelId that`は、「`o`が`CardLabelId`型（またはそのサブクラス）であれば`true`を返し、同時に`CardLabelId`型にキャストした値を`that`という変数に代入する」という意味です。この構文が登場する以前は、型チェックとキャストを2行に分けて書く必要がありました。

```java
// 以前の書き方（本プロジェクトでは使っていない）
if (!(o instanceof CardLabelId)) {
	return false;
}
CardLabelId that = (CardLabelId) o;
```

このコードが`!(...)`で否定したうえで早期リターン（`return false;`）しているため、`if`ブロックを抜けた**後**のコードでも`that`という変数がそのまま使えます。これは「型が一致しなかった場合にすぐ関数を抜ける」ことをコンパイラが理解し、それ以降は`o`が確実に`CardLabelId`型であると判断できるためです。
