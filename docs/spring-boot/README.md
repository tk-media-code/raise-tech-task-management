# Spring Boot 学習ドキュメント

> このドキュメントは、本プロジェクトのバックエンド（Java + Spring Boot）を学びながら開発を進めるための学習ノートです。
> Claude Codeが生成したコードをそのまま使うのではなく、「何を」「なぜ」そう実装しているかを理解できるようにすることを目的としています。
> HTML/CSS/JavaScriptの知識、PHPの基礎文法・オブジェクト指向の学習経験、Laravelアプリのフロントエンド保守経験がある方を読者として想定し、必要に応じてLaravel（PHP）との対比を添えています。
> Spring Bootというフレームワークの使い方に焦点を当てており、Java**言語**自体の文法（ジェネリクス・ラムダ式・record・例外処理など）は扱いません。そちらは [docs/java/](../java/README.md) にまとめています。
> フロントエンド（React + TypeScript）の学習ドキュメントは [docs/react/](../react/README.md)・[docs/typescript/](../typescript/README.md) に整備しています。

### 本書の構成

要件定義書（[docs/requirements.md](../requirements.md)）と同じく、全体像をつかむための**ハブ（このファイル）**と、章ごとの詳細をまとめた**詳細ファイル**（このディレクトリ内）に分かれています。

- このファイルには、各章の**見出しと概要**のみを載せています。まずはここを上から読めば全体像がつかめます。
- 詳しい解説（コード引用・図解・Laravelとの対比）が必要なときは、各章末尾の「📄 詳細」リンクから詳細ファイルを開いてください。

**ファイル構成**

| 章 | 内容 | 詳細ファイル |
| --- | --- | --- |
| 1〜5章 | Spring Bootの全体アーキテクチャ・DI・起動の仕組み | [01-architecture.md](./01-architecture.md) |
| 6〜9章 | ビルド（Gradle）とアプリケーション設定 | [02-build-config.md](./02-build-config.md) |
| 10〜15章 | JPAエンティティ（データの永続化） | [03-entity-jpa.md](./03-entity-jpa.md) |
| 16章 | 環境ごとの設定切り替え（プロファイル） | [04-profiles.md](./04-profiles.md) |
| 17〜19章 | Repository層 | [05-repository.md](./05-repository.md) |
| 20〜23章 | Service層・Controller層・DTO・例外処理 | [06-service-controller.md](./06-service-controller.md) |
| 24〜25章 | N+1問題とパフォーマンス | [07-jpa-performance.md](./07-jpa-performance.md) |
| 26〜27章 | `@Configuration`によるBean定義とCORS設定 | [08-configuration-cors.md](./08-configuration-cors.md) |
| 28〜31章 | 登録系API（POST）とバリデーション | [09-write-api-validation.md](./09-write-api-validation.md) |

## 目次

1. [Spring Bootとは](./01-architecture.md#1-spring-bootとは)
2. [レイヤードアーキテクチャ](./01-architecture.md#2-レイヤードアーキテクチャ)
3. [DI（依存性注入）とIoCコンテナ](./01-architecture.md#3-di依存性注入とiocコンテナ)
4. [アプリケーションの起動の仕組み](./01-architecture.md#4-アプリケーションの起動の仕組み)
5. [現状の実装と今後の見取り図](./01-architecture.md#5-現状の実装と今後の見取り図)
6. [Gradleとは](./02-build-config.md#6-gradleとは)
7. [build.gradle の読み方](./02-build-config.md#7-buildgradle-の読み方)
8. [application.properties の読み方](./02-build-config.md#8-applicationproperties-の読み方)
9. [起動から動作確認までの流れ](./02-build-config.md#9-起動から動作確認までの流れ)
10. [JPA・Hibernate・ORMとは](./03-entity-jpa.md#10-jpahibernateormとは)
11. [エンティティの基本アノテーション](./03-entity-jpa.md#11-エンティティの基本アノテーション)
12. [リレーション（関連）の書き方](./03-entity-jpa.md#12-リレーション関連の書き方)
13. [複合主キー](./03-entity-jpa.md#13-複合主キー)
14. [DBレベルの制約（@Check）](./03-entity-jpa.md#14-dbレベルの制約check)
15. [データモデルとの対応](./03-entity-jpa.md#15-データモデルとの対応)
16. [環境ごとの設定切り替え（プロファイル）](./04-profiles.md#16-環境ごとの設定切り替えプロファイル)
17. [Repository層とSpring Data JPA](./05-repository.md#17-repository層とspring-data-jpa)
18. [クエリメソッド（メソッド名からのクエリ自動生成）](./05-repository.md#18-クエリメソッドメソッド名からのクエリ自動生成)
19. [@QueryとJPQL（動的な絞り込み）](./05-repository.md#19-queryとjpql動的な絞り込み)
20. [Service層と@Transactional](./06-service-controller.md#20-service層とtransactional)
21. [Controller層とREST API](./06-service-controller.md#21-controller層とrest-api)
22. [DTO（レコード）でエンティティを外に出さない](./06-service-controller.md#22-dtoレコードでエンティティを外に出さない)
23. [例外処理と@RestControllerAdvice](./06-service-controller.md#23-例外処理とrestcontrolleradvice)
24. [N+1問題とその回避](./07-jpa-performance.md#24-n1問題とその回避)
25. [open-in-viewと遅延読み込みの境界](./07-jpa-performance.md#25-open-in-viewと遅延読み込みの境界)
26. [`@Configuration`とBean定義](./08-configuration-cors.md#26-configurationとbean定義)
27. [CORSとフロントエンドとの接続](./08-configuration-cors.md#27-corsとフロントエンドとの接続)
28. [登録系API（POST）の作り方](./09-write-api-validation.md#28-登録系apipostの作り方)
29. [リクエストDTOとBean Validation](./09-write-api-validation.md#29-リクエストdtoとbean-validation)
30. [バリデーションエラーを400で返す](./09-write-api-validation.md#30-バリデーションエラーを400で返す)
31. [登録処理の中身](./09-write-api-validation.md#31-登録処理の中身)

---

## 1. Spring Bootとは

Spring Frameworkを土台に、面倒な初期設定を自動化してくれるフレームワークです。「設定より規約（Convention over Configuration）」の考え方により、最小限の記述でREST APIサーバーを組み立てられます。

📄 詳細：[01-architecture.md](./01-architecture.md#1-spring-bootとは)

---

## 2. レイヤードアーキテクチャ

Controller → Service → Repository → Entity という役割ごとの層に分けて実装するのが基本形です。現状はEntity層のみが実装済みで、今後どの層をどう追加していくかの見取り図を示します。

📄 詳細：[01-architecture.md](./01-architecture.md#2-レイヤードアーキテクチャ)

---

## 3. DI（依存性注入）とIoCコンテナ

オブジェクトを自分で`new`するのではなく、フレームワーク（IoCコンテナ）が必要な部品を組み立てて注入してくれる仕組みです。`@Service`や`@Repository`などのアノテーションと合わせて解説します。

📄 詳細：[01-architecture.md](./01-architecture.md#3-di依存性注入とiocコンテナ)

---

## 4. アプリケーションの起動の仕組み

`@SpringBootApplication`が付いたクラスの`main()`メソッドを実行すると、コンポーネントスキャン・自動構成・組み込みサーバーの起動が行われます。実際の起動クラス`TaskManagementApplication.java`を教材に解説します。

📄 詳細：[01-architecture.md](./01-architecture.md#4-アプリケーションの起動の仕組み)

---

## 5. 現状の実装と今後の見取り図

現時点で実装済みなのはエンティティ（データの型）のみで、Repository・Service・Controllerはまだ存在しません。今後の実装でどこに何が追加されるかを表で整理します。

📄 詳細：[01-architecture.md](./01-architecture.md#5-現状の実装と今後の見取り図)

---

## 6. Gradleとは

このプロジェクトのビルドツールはGradleです。依存ライブラリの解決・コンパイル・パッケージングを自動化する仕組みと、Gradle Wrapper（`gradlew`）の役割を解説します。

📄 詳細：[02-build-config.md](./02-build-config.md#6-gradleとは)

---

## 7. build.gradle の読み方

依存関係やJavaのバージョンなど、ビルド設定を記述する`build.gradle`を1ブロックずつ解説します。

📄 詳細：[02-build-config.md](./02-build-config.md#7-buildgradle-の読み方)

---

## 8. application.properties の読み方

DB接続情報やHibernateの挙動など、アプリケーションの設定を記述する`application.properties`を1行ずつ解説します。

📄 詳細：[02-build-config.md](./02-build-config.md#8-applicationproperties-の読み方)

---

## 9. 起動から動作確認までの流れ

`./gradlew bootRun`や`docker compose`での起動で実際に何が起きているかを解説します。

📄 詳細：[02-build-config.md](./02-build-config.md#9-起動から動作確認までの流れ)

---

## 10. JPA・Hibernate・ORMとは

テーブルの行をJavaのオブジェクトとして扱えるようにするORM（Object-Relational Mapping）の考え方と、その標準仕様であるJPA、実装であるHibernateの関係を解説します。

📄 詳細：[03-entity-jpa.md](./03-entity-jpa.md#10-jpahibernateormとは)

---

## 11. エンティティの基本アノテーション

`@Entity`・`@Id`・`@GeneratedValue`・`@Column`など、テーブルの1行に対応するクラス（エンティティ）を定義するための基本アノテーションを、実際の`Board`エンティティを教材に解説します。

📄 詳細：[03-entity-jpa.md](./03-entity-jpa.md#11-エンティティの基本アノテーション)

---

## 12. リレーション（関連）の書き方

テーブル同士の関連（外部キー）をJavaのコード上でどう表現するかを、`@ManyToOne`や`@OnDelete`を中心に、実際の`Card`・`Label`エンティティを教材に解説します。

📄 詳細：[03-entity-jpa.md](./03-entity-jpa.md#12-リレーション関連の書き方)

---

## 13. 複合主キー

1つのカラムだけでは一意にならない中間テーブル（`CardLabel`）で使われる複合主キーの仕組みを、`@Embeddable`・`@EmbeddedId`・`@MapsId`を中心に解説します。

📄 詳細：[03-entity-jpa.md](./03-entity-jpa.md#13-複合主キー)

---

## 14. DBレベルの制約（@Check）

アプリ側の入力チェックとは別に、データベース自体にも不正な値を防ぐ制約をかける「多重防御」の考え方を、`Card`エンティティの`@Check`を例に解説します。

📄 詳細：[03-entity-jpa.md](./03-entity-jpa.md#14-dbレベルの制約check)

---

## 15. データモデルとの対応

ここまでのエンティティが、要件定義書のデータモデル（ER図）とどう対応しているかを整理します。

📄 詳細：[03-entity-jpa.md](./03-entity-jpa.md#15-データモデルとの対応)

---

## 16. 環境ごとの設定切り替え（プロファイル）

`application.properties`（全環境共通の既定値）に、`application-{プロファイル名}.properties`（差分だけを書いたファイル）を重ね合わせることで、開発・本番など環境ごとに設定を切り替える仕組みです。「デフォルトは安全側（本番相当）にし、開発時だけ緩める」という考え方（Secure by Default）を、実際のActuator設定を例に解説します。

📄 詳細：[04-profiles.md](./04-profiles.md#16-環境ごとの設定切り替えプロファイル)

---

## 17. Repository層とSpring Data JPA

インターフェースを宣言するだけで、データアクセスの実装クラスをSpring Data JPAが自動生成してくれる仕組みです。`JpaRepository`を継承することで得られる基本メソッドと、`@Repository`を明示しなくてよい理由を解説します。

📄 詳細：[05-repository.md](./05-repository.md#17-repository層とspring-data-jpa)

---

## 18. クエリメソッド（メソッド名からのクエリ自動生成）

`findByBoardIdOrderByIdAsc`のような、メソッド名そのものからSpring Data JPAがクエリを組み立てる仕組みです。命名規則と、条件が複雑になったときの限界を解説します。

📄 詳細：[05-repository.md](./05-repository.md#18-クエリメソッドメソッド名からのクエリ自動生成)

---

## 19. `@Query`とJPQL（動的な絞り込み）

`CardRepository.search`を教材に、SQLに似た問い合わせ言語JPQLで動的な絞り込み条件を書く方法を解説します。null-guardイディオム、`in`句に空リストを渡せない問題への対処、`order by`に潜む文字列ソートの罠、Specificationを採用しなかった理由を扱います。

📄 詳細：[05-repository.md](./05-repository.md#19-queryとjpql動的な絞り込み)

---

## 20. Service層と`@Transactional`

ビジネスロジックを担うService層の役割を解説したうえで、`@Transactional`をトランザクションの基礎（ACID・分離レベル）から掘り下げます。参照専用の本プロジェクトでもなぜトランザクションが必要か、`@Transactional`がAOPプロキシとしてどう動いているか（自己呼び出しが効かない罠・伝播・`readOnly`の実体）、psqlでの2セッション実験による分離レベルの体感まで扱います。

📄 詳細：[06-service-controller.md](./06-service-controller.md#20-service層とtransactional)

---

## 21. Controller層とREST API

`@RestController`・`@GetMapping`・`@RequestParam`など、HTTPリクエストの受け口となるController層の書き方と、本プロジェクトのエンドポイント一覧を解説します。

📄 詳細：[06-service-controller.md](./06-service-controller.md#21-controller層とrest-api)

---

## 22. DTO（レコード）でエンティティを外に出さない

Java の`record`を使ったDTOの書き方と、エンティティをAPIレスポンスとして直接返さない理由（遅延読み込みの罠・DBとAPI契約の分離）を解説します。

📄 詳細：[06-service-controller.md](./06-service-controller.md#22-dtoレコードでエンティティを外に出さない)

---

## 23. 例外処理と`@RestControllerAdvice`

`@RestControllerAdvice`による例外処理の一元化と、RFC 9457に沿った`ProblemDetail`でのエラーレスポンスの返し方を解説します。

📄 詳細：[06-service-controller.md](./06-service-controller.md#23-例外処理とrestcontrolleradvice)

---

## 24. N+1問題とその回避

一覧取得後に要素ごとの追加SQLが発行されてしまうN+1問題について、なぜJPAだと`fetch = LAZY`とプロキシの組み合わせで「うっかり」起きてしまうのかという発生原理から解説します。回避策のカタログ（`join fetch`・IN句・`@EntityGraph`・`@BatchSize`）と本プロジェクトの選択、`join fetch`を1箇所外してN+1を実際に発生させSQL本数を数える実験まで、実測結果とあわせて扱います。

📄 詳細：[07-jpa-performance.md](./07-jpa-performance.md#24-n1問題とその回避)

---

## 25. `open-in-view`と遅延読み込みの境界

Spring Bootが既定で有効にしているOSIV（Open Session In View）の挙動と、それを無効化する`spring.jpa.open-in-view=false`の意図を解説します。

📄 詳細：[07-jpa-performance.md](./07-jpa-performance.md#25-open-in-viewと遅延読み込みの境界)

---

## 26. `@Configuration`とBean定義

`@RestController`・`@Service`・`@RestControllerAdvice`と同じくコンポーネントスキャンでBeanとして登録されますが、役割が「業務処理」ではなく「フレームワークの構成」である点が異なります。本プロジェクト初の`@Configuration`クラスであるCORS設定（`CorsConfig`）を教材に、`@Bean`メソッドとの使い分けや`WebMvcConfigurer`の位置づけを解説します。

📄 詳細：[08-configuration-cors.md](./08-configuration-cors.md#26-configurationとbean定義)

---

## 27. CORSとフロントエンドとの接続

フロントエンド（`http://localhost:5173`）とバックエンド（`http://localhost:8080`）が別オリジンになるため必要になる、CORS（Cross-Origin Resource Sharing）の設定を解説します。同一オリジンポリシーの仕組み、単純リクエストとプリフライトの違い、`CorsConfig`の実装、そして`curl`による動作確認までを扱います。

📄 詳細：[08-configuration-cors.md](./08-configuration-cors.md#27-corsとフロントエンドとの接続)

---

## 28. 登録系API（POST）の作り方

本プロジェクト初の`@PostMapping`・`@RequestBody`を、カード・ボードそれぞれの新規作成APIを教材に解説します。GET系メソッドが素の型を返すのに対し、POSTは`ResponseEntity`でステータスコード（201 Created）と`Location`ヘッダーをまとめて返す理由を扱います。

📄 詳細：[09-write-api-validation.md](./09-write-api-validation.md#28-登録系apipostの作り方)

---

## 29. リクエストDTOとBean Validation

`spring-boot-starter-validation`の導入と、`@NotNull`・`@NotBlank`・`@Size`によるリクエストDTOの検証を解説します。レスポンスDTO（22章）との性格の違い、フォームの`disabled`→Bean Validation→DBの制約という3層の多重防御の考え方も扱います。

📄 詳細：[09-write-api-validation.md](./09-write-api-validation.md#29-リクエストdtoとbean-validation)

---

## 30. バリデーションエラーを400で返す

`MethodArgumentNotValidException`を400のProblemDetailに変換する自前のハンドラを解説します。Spring Boot既定の`ProblemDetailsExceptionHandler`と自前のハンドラが同じ優先度で競合し、`@Order`を明示するまで自前のハンドラが呼ばれなかった実際の落とし穴も扱います。

📄 詳細：[09-write-api-validation.md](./09-write-api-validation.md#30-バリデーションエラーを400で返す)

---

## 31. 登録処理の中身

書き込み側の`@Transactional`によるクラス既定`readOnly=true`の上書き、`@CreationTimestamp`/`@UpdateTimestamp`と`@ColumnDefault`の役割分担（`@ColumnDefault`だけではNOT NULL制約違反になる実例）、positionの採番方法、`findById`と`getReferenceById`の使い分け、複合主キーエンティティの`save()`が`persist`か`merge`かを決める`isNew()`の仕組みを解説します。

📄 詳細：[09-write-api-validation.md](./09-write-api-validation.md#31-登録処理の中身)

---

## コメントについて（ビルド成果物への影響）

Javaのソースコードに書いたコメント（`//`や`/* */`、Javadocの`/** */`）は、`javac`によるコンパイル時にすべて破棄されます。ビルド成果物である`.class`ファイルや、そこから作られるJARファイル（`./gradlew bootJar`の生成物）には一切含まれません。したがって、コメントを書くこと自体がビルド後の成果物のサイズやセキュリティに影響することはなく、**削除のための特別な設定も不要**です。

> 確認したい場合は、`./gradlew bootJar`でJARを作成した後、`javap -c -p <クラス名>`でクラスファイルの中身（バイトコード）を見てみてください。コメントの文字列がどこにも出てこないことがわかります。

このプロジェクトにおけるコメントの書き方のルールは [CLAUDE.mdのコーディング規約](../../CLAUDE.md#コーディング規約コメント) を参照してください。

## このドキュメントの更新ルール

- 開発を進める中で新しい概念・技術要素（例：Repository、Service、DTO、バリデーション、例外処理、認証など）が登場したら、**都度このドキュメント群を更新すること**を本プロジェクトのルールとします。
- 既存ファイルへの追記で収まる内容はそのファイルに追記し、独立したまとまりを持つ新しいトピックは`04-xxx.md`のように連番でファイルを追加してください。章番号もこのREADMEの続き（16章、17章…）として振ってください。
- 新しいファイルを追加した場合は、このREADMEの「ファイル構成」表と「目次」の両方を更新し、ハブと詳細ファイルの対応が常に成立している状態を保ってください。

---

*本ドキュメントは開発と並行して育てていく学習ノートです。実装で分からない概念が出てきたら、まずここに解説がないか確認し、無ければ追記してください。*
