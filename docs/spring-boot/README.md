# Spring Boot 学習ドキュメント

> このドキュメントは、本プロジェクトのバックエンド（Java + Spring Boot）を学びながら開発を進めるための学習ノートです。
> Claude Codeが生成したコードをそのまま使うのではなく、「何を」「なぜ」そう実装しているかを理解できるようにすることを目的としています。
> HTML/CSS/JavaScriptの知識、PHPの基礎文法・オブジェクト指向の学習経験、Laravelアプリのフロントエンド保守経験がある方を読者として想定し、必要に応じてLaravel（PHP）との対比を添えています。

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
