# 構文リファレンス

[← Java学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **26〜30章** をまとめています。

---

## 26. 文字列とテキストブロック

> **`String`の不変性とは？**
> Javaの`String`は一度作られると内容を変更できません。「文字列を変換するメソッド」に見える`trim()`や`toUpperCase()`なども、実際には元の文字列を書き換えているのではなく、変換後の内容を持つ**新しい`String`インスタンス**を返しています。

もっとも頻繁に使われる文字列操作は`+`による連結です。

```java
throw new ResourceNotFoundException("ボードが見つかりません（id=" + boardId + "）");
```

`"..." + id + "..."`は、`id`（`Integer`）を文字列表現に変換しながら、3つの文字列を連結した新しい`String`を作ります。

`CardService`には、文字列の状態を調べる・整形するメソッドの例もあります。

```java
String keyword = (condition.keyword() == null || condition.keyword().isBlank())
		? null
		: condition.keyword().trim();
```

`isBlank()`は「空文字列、または空白文字だけで構成されているか」を`boolean`で返します（Java 11以降）。`trim()`は前後の空白を取り除いた新しい`String`を返すメソッドで、`condition.keyword()`自身の中身が書き換わるわけではありません（`String`が不変であることの実例です）。

### テキストブロック（`"""`）

複数行にわたる長い文字列を扱う場面では、**テキストブロック**（Java 15以降）が使われています。

`CardRepository.search`の`@Query`（[19章](../spring-boot/05-repository.md#19-queryとjpql動的な絞り込み)で全文を解説）は、次のようにテキストブロックで書かれています（`keyword`・`labelIds`による絞り込みや`order by`など、後半の行は省略して先頭部分だけを引用しています）。

```java
@Query("""
		select c
		  from Card c
		  join fetch c.board b
		 where (:boardId is null or b.id = :boardId)
		   and c.isArchived = :archived
		""")
```

`"""`で始まり`"""`で終わる範囲が、1つの文字列リテラルです。通常の`"..."`では改行を`\n`とエスケープして1行に詰め込む必要がありますが、テキストブロックはソースコード上の改行やインデントをそのまま保った、複数行のJPQLを読みやすく書けるようにしています。テキストブロックは、終了の`"""`の位置を基準にして、全行に共通する余分なインデント（**偶発的な空白**と呼ばれます）を自動的に取り除いてから1つの文字列にする、という規則を持っています。

---

## 27. 日付・時刻（`java.time`）

> **`java.time`パッケージとは？**
> Java 8以降の標準的な日付・時刻APIです。本プロジェクトでは、扱う対象によって`OffsetDateTime`と`LocalDate`という2つの型を使い分けています。

| 型 | 保持する情報 | 本プロジェクトでの使用箇所 |
| --- | --- | --- |
| `OffsetDateTime` | 日付＋時刻＋UTCからのオフセット（タイムゾーン情報） | `Board.createdAt`、`Card.createdAt`・`Card.updatedAt` |
| `LocalDate` | 日付のみ（時刻・タイムゾーンを持たない） | `Card.dueDate` |

「作成日時」「更新日時」は、それが**いつ発生した出来事か**を一意に特定する必要がある値です。同じ「15時」でも、日本標準時（UTC+9）とグリニッジ標準時（UTC+0）では指している瞬間が異なるため、`OffsetDateTime`でオフセット情報まで保持しています。

```java
@Column(name = "created_at", nullable = false)
@ColumnDefault("now()")
private OffsetDateTime createdAt;
```

一方、「期日（`dueDate`）」はカレンダー上の特定の1日を表す値で、時刻やタイムゾーンには意味がありません。「7月27日が期日」であることに時刻の情報は不要なため、`LocalDate`を使っています。

```java
@Column(name = "due_date")
private LocalDate dueDate;
```

この使い分けの基準は、「その値がタイムゾーンに左右される**瞬間**を表すか、タイムゾーンに関係のない**日付**を表すか」です。本プロジェクトのコードには、日付の加算・減算やフォーマット変換の処理は登場せず、いずれの型もエンティティとDTOの間で受け渡しされる、純粋なデータの入れ物として使われています。

---

## 28. 演算子の要点

### 三項演算子

`条件 ? 真の場合の値 : 偽の場合の値`という形の演算子で、`if`/`else`で変数に値を代入する処理を1行で書けます。

```java
String keyword = (condition.keyword() == null || condition.keyword().isBlank())
		? null
		: condition.keyword().trim();
```

条件（`condition.keyword()`が`null`または空白のみ）が真であれば`null`を、そうでなければ`.trim()`した結果を`keyword`に代入します。`&&`・`||`による条件の組み立てと短絡評価については、[25章](./06-exception-and-null.md#25-nullとnullpointerexception)で扱いました。

### `==`と`equals()`の使い分け

> **`==`と`equals()`の違いとは？**
> `==`は、プリミティブ型（[5章](./01-basics.md#5-プリミティブ型とラッパークラス)）に対しては「値そのものが等しいか」を、参照型（クラスのインスタンス）に対しては既定で「**同一のインスタンスかどうか**」（[16章](./03-type-system.md#16-objectequalsとhashcode)の同一性）を比較します。一方`equals()`は、クラスがオーバーライドしていれば「意味のある値として等しいか」（同値性）を比較できます。

これは初学者が誤りやすい代表的な落とし穴です。`Integer`や`String`のようなクラスのインスタンスを`==`で比較すると、たとえ中身の値が同じでも、生成された経緯によっては別々のインスタンスとして扱われ、`false`になることがあります。値として等しいかどうかを比較したいときは、常に`equals()`を使う必要があります。

本プロジェクトのコードで`==`が使われているのは、次の2つのパターンだけです。1つは[25章](./06-exception-and-null.md#25-nullとnullpointerexception)で見た`CardService.search`の三項演算子の一部、`condition.keyword() == null`のような、`null`そのものとの比較です。

もう1つは`CardLabelId.equals`（[16章](./03-type-system.md#16-objectequalsとhashcode)）の、自分自身と同一インスタンスかどうかの比較です。

```java
if (this == o) {
	return true;
}
```

`null`との比較は、参照先が本当に存在しないかどうかを調べているだけなので、インスタンスの中身が同じかどうかという問題は生じません。`this == o`も「同一インスタンスであれば、その先のフィールド比較を省略してよい」という最適化のための同一性判定であり、意図的に`==`を使っています。値同士の比較（`CardLabelId`の`cardId`・`labelId`など）には、`==`ではなく`Objects.equals(...)`（[16章](./03-type-system.md#16-objectequalsとhashcode)）が一貫して使われています。

---

## 29. アノテーションの読み方（構文として）

> **アノテーションとは？**
> `@`で始まる、クラス・メソッド・フィールド・引数などに付与できる「メタデータ（付加情報）」です。アノテーション自体は処理を実行しません。Spring BootやJPAといったフレームワークが、実行時またはコンパイル時にこのメタデータを読み取り、それに応じた動作をする、という形で機能します。

本プロジェクトのコードには多数のアノテーションが登場しますが、書き方のパターンは限られています。それぞれの**意味**（何をしてくれるか）は[docs/spring-boot/](../spring-boot/README.md)側で個別に解説しているため、ここでは構文としての読み方だけを整理します。

| パターン | 例 | 読み方 |
| --- | --- | --- |
| 要素なし（マーカー） | `@Entity`、`@Id` | 括弧が無い。存在そのものが目印になる |
| 単一要素（`value`の省略） | `@Column("board")`のような書き方は本プロジェクトには無いが、`@ExceptionHandler(ResourceNotFoundException.class)` | 要素名が`value`の場合に限り、`value = `という記述を省略できる |
| 複数要素 | `@Column(nullable = false, length = 20)` | `要素名 = 値`をカンマ区切りで並べる |
| enum定数を値に取る | `@GeneratedValue(strategy = GenerationType.IDENTITY)`、`@OnDelete(action = OnDeleteAction.CASCADE)` | 要素の値として、あらかじめ定義された定数（`GenerationType`や`OnDeleteAction`という名前の集合）を渡す |
| Classリテラルを値に取る | `@ExceptionHandler(ResourceNotFoundException.class)` | `クラス名.class`という値を渡す。詳しくは[Classリテラルの解説（4章）](../spring-boot/01-architecture.md#4-アプリケーションの起動の仕組み)を参照 |
| テキストブロックを値に取る | `@Query("""..."""）` | [26章](#26-文字列とテキストブロック)のテキストブロックを、そのままアノテーションの要素値として渡している |
| パラメータへの付与 | `@PathVariable Integer id`、`@Param("boardId") Integer boardId` | クラス・メソッドだけでなく、メソッドの引数1つ1つにも付けられる |

`@ExceptionHandler(ResourceNotFoundException.class)`は、実は2つの省略が重なった書き方です。この要素は本来「複数の例外クラスを配列で受け取れる」ように定義されていますが、渡す値が1つだけの場合は配列の`{ }`を省略して単一の値をそのまま書くことができ、さらに要素名が`value`であるためその名前自体も省略できます。省略しない場合の完全な書き方は`@ExceptionHandler(value = { ResourceNotFoundException.class })`です（ここで登場する「配列」については[30章](#30-配列と可変長引数)で扱います）。

---

## 30. 配列と可変長引数

> **配列とは？**
> 同じ型の値を、あらかじめ決めた個数だけ並べて格納する入れ物です。`String[]`は「`String`を格納する配列」という型を表し、生成時に決めた長さは後から変更できません。

本プロジェクトのコレクションは、これまで一貫して`List`・`Map`（[19章](./04-generics-collections.md#19-コレクション)）で表現されており、配列は`main(String[] args)`（Javaの規約で決まった書き方）以外には登場していませんでした。CORSの設定クラス`CorsConfig`（[docs/spring-boot/08-configuration-cors.md 26〜27章](../spring-boot/08-configuration-cors.md)）で、初めて配列と可変長引数が実際のフィールド・メソッド呼び出しとして登場します。

```java
private final String[] allowedOrigins;

public CorsConfig(@Value("${app.cors.allowed-origins}") String[] allowedOrigins) {
	this.allowedOrigins = allowedOrigins;
}
```

`String[] allowedOrigins`は「可変長の`List<String>`」ではなく「固定長の配列」です。`@Value`が読んだカンマ区切りのプロパティ値を、Springの`ConversionService`がこの配列に変換して注入します。

### なぜ`List`ではなく配列なのか

本プロジェクトは基本方針として集合を`List`で表現していますが（[19章](./04-generics-collections.md#19-コレクション)）、`CorsConfig`だけは配列を使っています。理由は呼び出す先のAPI（`CorsRegistration`）の都合です。

```java
registry.addMapping("/api/**")
		.allowedOrigins(allowedOrigins) // String... を受け取るメソッド
		.allowedMethods("GET")
		.allowCredentials(false);
```

`allowedOrigins(String... origins)`のように定義されたメソッドは、引数の個数が可変な**可変長引数（varargs）**を受け取ります。可変長引数は実体としては配列であり、呼び出す側が`List<String>`しか持っていない場合は`list.toArray(new String[0])`のような変換を挟む必要があります。`Spring`側のAPIが配列（＝可変長引数）を要求している以上、`List`で保持しても最終的に配列へ変換する手間が増えるだけなので、`CorsConfig`ではフィールド自体を配列にして、変換の手間そのものを無くしています。

### 呼び出す側から見た可変長引数

`.allowedMethods("GET")`や`.allowedOrigins(allowedOrigins)`のように、可変長引数のメソッドは「値を1つだけ渡す」「複数の値をカンマ区切りで渡す」「配列をそのまま渡す」のいずれの形でも呼び出せます。

```java
.allowedMethods("GET")                    // 1個だけ
.allowedMethods("GET", "POST")            // 複数個（可変長引数の本来の書き方）
.allowedOrigins(allowedOrigins)           // 配列をそのまま渡す（可変長引数は配列と互換）
```

呼び出される側（メソッドの定義）だけが`...`という特別な構文を使い、内部では配列として扱われます。呼び出す側は配列であることを意識せず、複数の引数を並べるだけで済みます。
