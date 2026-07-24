# ビルドとアプリケーション設定

[← 学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **6〜9章** をまとめています。

---

## 6. Gradleとは

> **ビルドツールとは？**
> ソースコードのコンパイル、依存ライブラリのダウンロード、テストの実行、実行可能な成果物（JARファイル）の作成といった一連の作業を、コマンド1つで自動化してくれる仕組みです。

本プロジェクトのバックエンドは**Gradle**（Groovy DSLで記述する方式）をビルドツールとして採用しています。JavaのビルドツールにはGradleのほかにMaven（`pom.xml`というXMLで設定を書く方式）もありますが、Gradleは設定をよりプログラムに近い形（DSL）で簡潔に書けることが特徴です。

プロジェクト内には`gradlew` / `gradlew.bat`というファイルがあります。これは**Gradle Wrapper**と呼ばれる仕組みで、開発者のPCにGradle本体がインストールされていなくても、プロジェクトが指定するバージョンのGradle（`gradle/wrapper/gradle-wrapper.properties`で指定。本プロジェクトは9.5.1）を自動でダウンロードして実行してくれます。これにより「自分の環境ではビルドできるが、他の人の環境ではGradleのバージョン違いで失敗する」という事態を防げます。

> **Laravelとの対比**
> 役割としてはComposer（PHPの依存管理ツール）に近い部分がありますが、GradleはJavaソースの**コンパイル**・**テスト実行**・**パッケージング（JAR化）**まで含めた「ビルド」全体を担う点で、守備範囲がより広いツールです。またGradle Wrapperの「バージョンをプロジェクトに固定する」という考え方は、`composer.lock`がインストールするパッケージのバージョンを固定するのと似た発想です。

---

## 7. build.gradle の読み方

`backend/build.gradle`の全文と、各ブロックの意味は以下のとおりです。

```groovy
plugins {
	id 'java'
	id 'org.springframework.boot' version '4.1.0'
	id 'io.spring.dependency-management' version '1.1.7'
}

group = 'com.raisetech'
version = '0.0.1-SNAPSHOT'

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(25)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	developmentOnly 'org.springframework.boot:spring-boot-devtools'
	implementation 'org.springframework.boot:spring-boot-starter-actuator'
	implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
	implementation 'org.springframework.boot:spring-boot-starter-webmvc'
	runtimeOnly 'org.postgresql:postgresql'
	testImplementation 'org.springframework.boot:spring-boot-starter-actuator-test'
	testImplementation 'org.springframework.boot:spring-boot-starter-webmvc-test'
	testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}

tasks.named('test') {
	useJUnitPlatform()
}
```

| ブロック | 意味 |
| --- | --- |
| `plugins { }` | このビルドに適用する機能拡張（プラグイン）。`java`はJavaのコンパイル機能そのもの、`org.springframework.boot`はSpring Boot用のタスク（`bootRun`・`bootJar`等）を追加し依存バージョンの管理も担う、`io.spring.dependency-management`はSpring Boot対応ライブラリのバージョンを一括管理する機能を追加する |
| `group` / `version` | このプロジェクトの識別名とバージョン。Mavenのartifact座標に相当する |
| `java { toolchain { ... } }` | ビルド・実行に使うJavaのバージョンをプロジェクト単位で固定する設定。ここでは25を指定しているため、開発者のPCにインストールされているJavaのバージョンによらず、Gradleが指定バージョンのJDKを解決して使う |
| `repositories { mavenCentral() }` | 依存ライブラリをダウンロードしてくる先。`mavenCentral()`は最も標準的な公開リポジトリ |
| `dependencies { }` | このプロジェクトが使うライブラリの一覧（詳細は下表） |
| `tasks.named('test') { useJUnitPlatform() }` | `test`タスク（`./gradlew test`）がJUnit 5（JUnit Platform）でテストを実行するように設定する |

**`dependencies`の各行の記法**

| 記法 | 意味 |
| --- | --- |
| `developmentOnly` | 開発時のみクラスパスに含まれる依存。本番のJARには含まれない |
| `implementation` | コンパイル時にも実行時にも必要な依存。最も基本的な指定 |
| `runtimeOnly` | 実行時にのみ必要（コンパイル時にはコードから直接参照しない）依存 |
| `testImplementation` / `testRuntimeOnly` | テストコードのコンパイル・実行時にのみ必要な依存 |

**依存ライブラリ一覧**

| ライブラリ | 役割 |
| --- | --- |
| `spring-boot-devtools` | ソース変更時の自動再起動やLiveReloadなど、開発を効率化する機能一式（[9章](#9-起動から動作確認までの流れ)で解説） |
| `spring-boot-starter-actuator` | アプリケーションの稼働状況を確認するための監視用エンドポイント（`/actuator/health`等）を追加する |
| `spring-boot-starter-data-jpa` | Spring Data JPA（＋Hibernate）を追加し、JPAエンティティ（[10〜15章](./03-entity-jpa.md)）を使えるようにする |
| `spring-boot-starter-webmvc` | REST APIを作るためのWeb MVC機能一式（組み込みTomcat・`@RestController`等）を追加する。Spring Boot 4系での名称で、3系までの`spring-boot-starter-web`に相当する |
| `postgresql` | PostgreSQLに接続するためのJDBCドライバ |
| `spring-boot-starter-actuator-test` / `spring-boot-starter-webmvc-test` | Actuator・Web MVCそれぞれのテスト支援機能 |
| `junit-platform-launcher` | JUnit 5のテストを実行するためのランチャー |

> **補足（Spring Boot 4系特有の点）**：Spring Boot 4 / Hibernate 6では、JDBC接続情報からPostgreSQL用の方言（Dialect）が自動的に判定されるため、以前のバージョンで必要だった`spring.jpa.properties.hibernate.dialect`の明示的な設定は不要になっています。

---

## 8. application.properties の読み方

`backend/src/main/resources/application.properties`は以下のとおりです（このファイル自体にすでに詳しい日本語コメントが付いています）。

```properties
spring.application.name=task-management

# --- データベース接続 ---
# DB認証情報は docker compose 経由で .env から注入される環境変数を参照する。
# ${VAR} は環境変数 VAR を展開するプレースホルダ。compose の environment で
# DB_URL / DB_USERNAME / DB_PASSWORD をコンテナに渡している（値の実体は .env）。
spring.datasource.url=${DB_URL}
spring.datasource.username=${DB_USERNAME}
spring.datasource.password=${DB_PASSWORD}

# エンティティ定義とDBスキーマの差分を起動時にHibernateが自動反映する（開発用）。
# 既存テーブルは破壊せず不足分のみ追加するため、postgres-data ボリュームのデータは保持される。
# 本番でこの値(update)を使うのは非推奨（意図せぬスキーマ変更の危険があるため）。
# 将来的にはFlywayでスキーマをSQLとしてバージョン管理する方式に置き換える想定（要件定義9.4）。
spring.jpa.hibernate.ddl-auto=update

# 補足: Spring Boot 4 / Hibernate 6 は JDBC接続から方言(PostgreSQLDialect)を自動判定するため
# spring.jpa.properties.hibernate.dialect の明示は不要。

# /actuator/health の詳細表示レベル。ここ(全環境共通の既定値)は本番を基準に安全側の
# never（{"status":"UP"} のみ）にしておく。always にするとDB接続状況等の詳細が無認証で
# 見えてしまい、攻撃者に内部構成のヒントを与えるため（Secure by Default）。
# こうしておけば、本番デプロイ時にプロファイル指定を忘れても安全側に倒れる。
# 開発中の疎通確認用に always へ上書きする設定は application-dev.properties 側に置く。
management.endpoint.health.show-details=never
```

ここでは、ファイル内のコメントで触れられている用語を補足します。

- **`${DB_URL}`のようなプレースホルダ**：`application.properties`は、OSの環境変数を`${変数名}`の形で埋め込めます。本プロジェクトでは、ルートの`docker-compose.yml`が`.env`の値を読み取り、`backend`コンテナに環境変数として渡し、それをこのファイルが参照する、という流れになっています。
- **`spring.jpa.hibernate.ddl-auto=update`**：Hibernateに「エンティティクラスの定義を正としてDBスキーマを自動的に作る／更新する」よう指示する設定です。開発中は手軽ですが、本番運用では意図しないカラム変更が起きうるため非推奨とされ、将来的にはFlyway（SQLファイルでスキーマ変更を管理するマイグレーションツール）に置き換える計画です（[要件定義9.4](../requirements/05-tech-stack-and-roadmap.md#94-必要に応じて導入する補助ツール発展)）。
- **`management.endpoint.health.show-details=never`**：`spring-boot-starter-actuator`が提供する`/actuator/health`エンドポイントの詳細表示レベルの設定です。`never`は`{"status":"UP"}`のみを返す最も安全な既定値で、全環境共通の設定としてあえてこれを明示しています。開発中にDB接続状況などの詳細を見たい場合は、環境ごとにプロファイルを分けて上書きします（[16章](./04-profiles.md#16-環境ごとの設定切り替えプロファイル)で解説）。

`application.properties`にはこのように「なぜこの設定にしたか」までコメントを残す文化がすでにあります。Javaのソースコードにコメントを書く際も、このトーン（何を、だけでなく、なぜ）を踏襲します（[CLAUDE.mdのコーディング規約](../../CLAUDE.md#コーディング規約コメント)）。

---

## 9. 起動から動作確認までの流れ

ローカルでの起動方法は主に2通りあります。

1. **Gradle単体で起動**：`backend`ディレクトリで`./gradlew bootRun`を実行すると、コンパイル後にアプリケーションが起動し、`http://localhost:8080`で待ち受けを開始します。
2. **docker composeで起動**：プロジェクトルートで`docker compose up --build`を実行すると、`backend`・`db`・`cloudbeaver`の3コンテナが起動します。開発用の`Dockerfile.dev`では、`spring-boot-devtools`（[7章](#7-buildgradle-の読み方)）を活かすため、`./gradlew -t classes`（ソース変更を監視し続けて自動コンパイルする継続ビルド）と`./gradlew bootRun`を同時に動かし、ソースを保存するとアプリが自動的に再起動される仕組みになっています。

いずれの方法でも、起動後に`curl http://localhost:8080/actuator/health`を叩くと、[8章](#8-applicationproperties-の読み方)で解説したActuatorの設定により、DB接続を含めた稼働状況をJSONで確認できます。

なお、DockerやDocker Composeそのものの仕組み（コンテナ・イメージ・volumeなど）は本ドキュメントの対象外です。ここでは「Spring Bootアプリケーションがどう起動するか」に絞って解説しています。

---

## 環境情報まとめ

| 項目 | バージョン |
| --- | --- |
| Java | 25 |
| Spring Boot | 4.1.0 |
| Gradle | 9.5.1 |

*上記は2026年7月時点の本プロジェクトの構成です。[要件定義9.2](../requirements/05-tech-stack-and-roadmap.md#92-バージョン方針)のとおり、バージョンは今後更新される可能性があります。*
