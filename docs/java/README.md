# Java言語 学習ドキュメント

> このドキュメントは、本プロジェクトのバックエンド（Java + Spring Boot）のコードを読み解けるようになるための、Java**言語**そのものの学習ノートです。
> Spring Bootというフレームワークの使い方は[docs/spring-boot/](../spring-boot/README.md)で扱っており、こちらはその土台となるJava言語自体の文法・構文を対象にします。
> あくまで**本プロジェクトの実装を理解するために必要な範囲**に絞っており、実装に登場しない言語機能（歴史的経緯や、Spring Bootでの開発に不要な文法など）は扱いません。
> プログラミング言語自体の学習経験があり、HTML/CSS/JavaScriptの基礎知識、PHP（Laravelアプリのフロントエンド保守）の経験がある方を読者として想定し、必要に応じてJavaScript・PHPとの対比を添えています。

### 本書の構成

[docs/spring-boot/](../spring-boot/README.md)と同じく、全体像をつかむための**ハブ（このファイル）**と、章ごとの詳細をまとめた**詳細ファイル**（このディレクトリ内）に分かれています。

- このファイルには、各章の**見出しと概要**のみを載せています。まずはここを上から読めば全体像がつかめます。
- 詳しい解説（コード引用・対比言語との比較）が必要なときは、各章末尾の「📄 詳細」リンクから詳細ファイルを開いてください。
- 章番号は[docs/spring-boot/](../spring-boot/README.md)とは別に、このドキュメント内で1から振り直しています（扱う対象がJava言語自体とSpring Bootとで異なるツリーのため）。

**ファイル構成**

| 章 | 内容 | 詳細ファイル |
| --- | --- | --- |
| 1〜5章 | Javaという言語の土台（実行の仕組み・パッケージ・静的型付け） | [01-basics.md](./01-basics.md) |
| 6〜11章 | クラスの構成要素（フィールド・コンストラクタ・アクセス修飾子・static・final） | [02-class-and-object.md](./02-class-and-object.md) |
| 12〜17章 | 継承・インターフェース・record | [03-type-system.md](./03-type-system.md) |
| 18〜20章 | ジェネリクスとコレクション | [04-generics-collections.md](./04-generics-collections.md) |
| 21〜23章 | ラムダ式とStream API | [05-lambda-stream.md](./05-lambda-stream.md) |
| 24〜25章 | 例外とnull | [06-exception-and-null.md](./06-exception-and-null.md) |
| 26〜30章 | 構文リファレンス（文字列・日付時刻・演算子・アノテーション・配列と可変長引数） | [07-syntax-reference.md](./07-syntax-reference.md) |

## 目次

1. [Javaの実行の仕組み（javacとJVM）](./01-basics.md#1-javaの実行の仕組みjavacとjvm)
2. [パッケージとimport](./01-basics.md#2-パッケージとimport)
3. [クラス宣言とファイル名の対応](./01-basics.md#3-クラス宣言とファイル名の対応)
4. [静的型付け（変数に型を書くということ）](./01-basics.md#4-静的型付け変数に型を書くということ)
5. [プリミティブ型とラッパークラス](./01-basics.md#5-プリミティブ型とラッパークラス)
6. [クラスの構成要素](./02-class-and-object.md#6-クラスの構成要素)
7. [アクセス修飾子](./02-class-and-object.md#7-アクセス修飾子)
8. [コンストラクタとオーバーロード](./02-class-and-object.md#8-コンストラクタとオーバーロード)
9. [static](./02-class-and-object.md#9-static)
10. [final](./02-class-and-object.md#10-final)
11. [メソッドのオーバーロード](./02-class-and-object.md#11-メソッドのオーバーロード)
12. [継承（extends）](./03-type-system.md#12-継承extends)
13. [インターフェースとimplements](./03-type-system.md#13-インターフェースとimplements)
14. [オーバーライドと@Override](./03-type-system.md#14-オーバーライドとoverride)
15. [record](./03-type-system.md#15-record)
16. [Object（equalsとhashCode）](./03-type-system.md#16-objectequalsとhashcode)
17. [instanceofパターンマッチング](./03-type-system.md#17-instanceofパターンマッチング)
18. [ジェネリクス](./04-generics-collections.md#18-ジェネリクス)
19. [コレクション](./04-generics-collections.md#19-コレクション)
20. [Optional](./04-generics-collections.md#20-optional)
21. [ラムダ式と関数型インターフェース](./05-lambda-stream.md#21-ラムダ式と関数型インターフェース)
22. [メソッド参照](./05-lambda-stream.md#22-メソッド参照)
23. [Stream API](./05-lambda-stream.md#23-stream-api)
24. [例外の仕組み](./06-exception-and-null.md#24-例外の仕組み)
25. [nullとNullPointerException](./06-exception-and-null.md#25-nullとnullpointerexception)
26. [文字列とテキストブロック](./07-syntax-reference.md#26-文字列とテキストブロック)
27. [日付・時刻（java.time）](./07-syntax-reference.md#27-日付時刻javatime)
28. [演算子の要点](./07-syntax-reference.md#28-演算子の要点)
29. [アノテーションの読み方（構文として）](./07-syntax-reference.md#29-アノテーションの読み方構文として)
30. [配列と可変長引数](./07-syntax-reference.md#30-配列と可変長引数)

---

## 1. Javaの実行の仕組み（javacとJVM）

ソースコードが`javac`でバイトコードにコンパイルされ、JVMがそれを実行するという2段階の仕組みを解説します。実行前に型の誤りを検出できることが、静的型付け言語としてのJavaの大きな特徴です。

📄 詳細：[01-basics.md](./01-basics.md#1-javaの実行の仕組みjavacとjvm)

---

## 2. パッケージとimport

パッケージがディレクトリ構造と対応する仕組みと、`import`によるクラスの参照方法を解説します。ワイルドカードimportを使わない理由にも触れます。

📄 詳細：[01-basics.md](./01-basics.md#2-パッケージとimport)

---

## 3. クラス宣言とファイル名の対応

`public`なクラスは1ファイルに1つ、クラス名とファイル名が一致するというルールを解説します。

📄 詳細：[01-basics.md](./01-basics.md#3-クラス宣言とファイル名の対応)

---

## 4. 静的型付け（変数に型を書くということ）

変数・引数・戻り値に型を明示し、コンパイル時に整合性がチェックされる静的型付けの仕組みを、動的型付けのJavaScript・PHPと対比しながら解説します。

📄 詳細：[01-basics.md](./01-basics.md#4-静的型付け変数に型を書くということ)

---

## 5. プリミティブ型とラッパークラス

`int`/`Integer`のようなプリミティブ型とラッパークラスの違い、`@RequestParam`でラッパー型を使う理由、オートボクシング／アンボクシングを解説します。

📄 詳細：[01-basics.md](./01-basics.md#5-プリミティブ型とラッパークラス)

---

## 6. クラスの構成要素

フィールド・コンストラクタ・メソッドというクラスの基本構成要素を、`Board`エンティティを教材に解説します。

📄 詳細：[02-class-and-object.md](./02-class-and-object.md#6-クラスの構成要素)

---

## 7. アクセス修飾子

`public`・`protected`・package-private・`private`の4段階と、本プロジェクトでの実際の使用状況を解説します。

📄 詳細：[02-class-and-object.md](./02-class-and-object.md#7-アクセス修飾子)

---

## 8. コンストラクタとオーバーロード

`CardLabelId`が持つ2つのコンストラクタを教材に、コンストラクタのオーバーロードと`this`キーワードを解説します。

📄 詳細：[02-class-and-object.md](./02-class-and-object.md#8-コンストラクタとオーバーロード)

---

## 9. `static`

インスタンスに属さないメンバーを表す`static`を、`main`メソッドと`private static`なマッパーメソッドを教材に解説します。

📄 詳細：[02-class-and-object.md](./02-class-and-object.md#9-static)

---

## 10. `final`

再代入を禁止する`final`を、コンストラクタインジェクションで使われる`final`フィールドを教材に解説します。

📄 詳細：[02-class-and-object.md](./02-class-and-object.md#10-final)

---

## 11. メソッドのオーバーロード

`BoardService`が持つ2つの`toResponse`メソッドを教材に、引数の型によって呼び出し先が決まるメソッドのオーバーロードを解説します。

📄 詳細：[02-class-and-object.md](./02-class-and-object.md#11-メソッドのオーバーロード)

---

## 12. 継承（extends）

`ResourceNotFoundException`が`RuntimeException`を継承する例を教材に、`extends`と`super`によるコンストラクタ呼び出しを解説します。

📄 詳細：[03-type-system.md](./03-type-system.md#12-継承extends)

---

## 13. インターフェースと`implements`

マーカーインターフェース`Serializable`の実装と、インターフェース同士の`extends`を教材に、インターフェースの基本を解説します。

📄 詳細：[03-type-system.md](./03-type-system.md#13-インターフェースとimplements)

---

## 14. オーバーライドと`@Override`

親クラスのメソッドを上書きするオーバーライドの仕組みと、コンパイラによる検査を有効にする`@Override`の役割を解説します。

📄 詳細：[03-type-system.md](./03-type-system.md#14-オーバーライドとoverride)

---

## 15. `record`

DTOとして使われている`record`が自動生成するもの（コンストラクタ・アクセサ・`equals`/`hashCode`/`toString`）を解説します。

📄 詳細：[03-type-system.md](./03-type-system.md#15-record)

---

## 16. `Object`（equalsとhashCode）

すべてのクラスの親である`Object`クラスと、`CardLabelId`での`equals`/`hashCode`のオーバーライドを教材に、同一性と同値性の違いを解説します。

📄 詳細：[03-type-system.md](./03-type-system.md#16-objectequalsとhashcode)

---

## 17. `instanceof`パターンマッチング

型チェックとキャストを同時に行う`instanceof`パターンマッチングの構文を解説します。

📄 詳細：[03-type-system.md](./03-type-system.md#17-instanceofパターンマッチング)

---

## 18. ジェネリクス

`JpaRepository<Board, Integer>`のような型引数の仕組みと、入れ子になったジェネリクス（`Map<Integer, List<LabelResponse>>`）を解説します。

📄 詳細：[04-generics-collections.md](./04-generics-collections.md#18-ジェネリクス)

---

## 19. コレクション

`List.of(...)`の不変性、`Collections.emptyList()`、`LinkedHashMap`による順序保持など、本プロジェクトで使われているコレクションの性質を解説します。

📄 詳細：[04-generics-collections.md](./04-generics-collections.md#19-コレクション)

---

## 20. `Optional`

値が無いかもしれないことを型で表現する`Optional`と、`orElseThrow`による例外への変換を解説します。

📄 詳細：[04-generics-collections.md](./04-generics-collections.md#20-optional)

---

## 21. ラムダ式と関数型インターフェース

`orElseThrow`やStream APIに渡されるラムダ式と、その受け皿となる関数型インターフェースの関係を解説します。

📄 詳細：[05-lambda-stream.md](./05-lambda-stream.md#21-ラムダ式と関数型インターフェース)

---

## 22. メソッド参照

`BoardService::toResponse`（static）・`Card::getId`（未束縛インスタンス）・`LinkedHashMap::new`（コンストラクタ）という3種類のメソッド参照を解説します。

📄 詳細：[05-lambda-stream.md](./05-lambda-stream.md#22-メソッド参照)

---

## 23. Stream API

`CardService`のカード・ラベル変換処理を教材に、`.stream().map().toList()`から`Collectors.groupingBy`まで、Stream APIの読み方を解説します。

📄 詳細：[05-lambda-stream.md](./05-lambda-stream.md#23-stream-api)

---

## 24. 例外の仕組み

検査例外と非検査例外の違い、`throw`による例外送出、本プロジェクトに`try`/`catch`が1つも無い理由を解説します。

📄 詳細：[06-exception-and-null.md](./06-exception-and-null.md#24-例外の仕組み)

---

## 25. nullと`NullPointerException`

`null`チェックと`&&`/`||`の短絡評価によるnullガードのパターンを、`CardService`の正規化処理を教材に解説します。

📄 詳細：[06-exception-and-null.md](./06-exception-and-null.md#25-nullとnullpointerexception)

---

## 26. 文字列とテキストブロック

文字列の不変性、`isBlank()`/`trim()`と、複数行のJPQLを書くためのテキストブロック（`"""`）の構文を解説します。

📄 詳細：[07-syntax-reference.md](./07-syntax-reference.md#26-文字列とテキストブロック)

---

## 27. 日付・時刻（java.time）

`OffsetDateTime`と`LocalDate`の使い分けの基準（タイムゾーン情報の要否）を解説します。

📄 詳細：[07-syntax-reference.md](./07-syntax-reference.md#27-日付時刻javatime)

---

## 28. 演算子の要点

三項演算子の読み方と、初学者が誤りやすい`==`と`equals()`の使い分けを解説します。

📄 詳細：[07-syntax-reference.md](./07-syntax-reference.md#28-演算子の要点)

---

## 29. アノテーションの読み方（構文として）

マーカー・単一要素・複数要素・enum定数・Classリテラルなど、アノテーションの構文パターンを整理します（各アノテーションの意味は[docs/spring-boot/](../spring-boot/README.md)を参照）。

📄 詳細：[07-syntax-reference.md](./07-syntax-reference.md#29-アノテーションの読み方構文として)

---

## 30. 配列と可変長引数

CORSの許可オリジン一覧（`CorsConfig`の`String[] allowedOrigins`）を教材に、本プロジェクトが集合の表現に一貫して`List`を使ってきた中で配列を選ぶ場面、そして呼び出し先のAPI（`CorsRegistration`）が要求する可変長引数（`String...`）との関係を解説します。

📄 詳細：[07-syntax-reference.md](./07-syntax-reference.md#30-配列と可変長引数)

---

## 付録：このドキュメントで扱っていないJavaの機能

Javaの入門書には載っているのに、本プロジェクトのコードには一度も登場しない機能があります。「知らないのは自分だけでは」と迷わないよう、意図的に扱っていない機能と、その理由をまとめておきます。

| 機能 | 本プロジェクトに登場しない理由 |
| --- | --- |
| `enum` | カードのステータス（todo/doing/done）は現状`String`で表現し、DB側の`@Check`制約で不正値を防いでいます（[03-entity-jpa.md 14章](../spring-boot/03-entity-jpa.md#14-dbレベルの制約check)） |
| `switch`文／`switch`式 | 状態に応じて処理を分岐させるロジック自体がまだ実装されていません（並び順の決定は[19章のJPQL](../spring-boot/05-repository.md#19-queryとjpql動的な絞り込み)側の`case`式で行っています） |
| `var`（ローカル変数型推論） | 本プロジェクトは一貫して変数の型を明示する書き方（[4章](#4-静的型付け変数に型を書くということ)）を採用しています |
| `try`/`catch`/`finally` | 例外を非検査例外にして`@RestControllerAdvice`へ一元化しているためです（[24章](#24-例外の仕組み)） |
| ループ（`for`・`while`・拡張for） | 繰り返し処理はすべてStream API（[23章](#23-stream-api)）で表現されています |
| `abstract`クラス・抽象メソッド | 共通の振る舞いを持つクラス階層を必要とする設計がまだ登場していません |
| 可変長引数（`...`）の**定義** | 自分で可変長引数を受け取るメソッドを定義した例はまだありません（**呼び出す側**としては[30章](#30-配列と可変長引数)の`CorsRegistration`で登場済み） |

これらの機能は、Write系API（POST/PUT/DELETE）の実装やバリデーションの追加が進むにつれて登場する可能性があります。実装に登場した時点で、下記の更新ルールに従ってこのドキュメント群に章を追加してください。

## このドキュメントの更新ルール

- 開発を進める中で新しいJavaの言語機能（例：`enum`、`switch`、`var`、`try`/`catch`、独自のジェネリッククラスなど）が登場したら、**都度このドキュメント群を更新すること**を本プロジェクトのルールとします。
- 既存ファイルへの追記で収まる内容はそのファイルに追記し、独立したまとまりを持つ新しいトピックは`08-xxx.md`のように連番でファイルを追加してください。章番号もこのREADMEの続き（30章、31章…）として振ってください。
- 新しいファイルを追加した場合は、このREADMEの「ファイル構成」表と「目次」の両方を更新し、ハブと詳細ファイルの対応が常に成立している状態を保ってください。
- Spring Bootのフレームワーク機能（新しいアノテーションの意味など）は[docs/spring-boot/](../spring-boot/README.md)側の更新ルールに従い、そちらに追記してください。両方にまたがる概念（例：`record`をDTOとして使う設計判断）は、言語機能としての説明をこちら、使い所の説明をSpring Boot側に置き、相互リンクしてください。

---

*本ドキュメントは開発と並行して育てていく学習ノートです。実装で分からないJavaの構文が出てきたら、まずここに解説がないか確認し、無ければ追記してください。*
