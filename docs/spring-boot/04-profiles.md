# 環境ごとの設定切り替え（プロファイル）

[← 学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **16章** をまとめています。

---

## 16. 環境ごとの設定切り替え（プロファイル）

> **プロファイルとは？**
> 「開発中は詳細な情報を見たいが、本番では隠したい」というように、同じ設定項目でも環境によって値を変えたい場面があります。Spring Bootの**プロファイル**は、`application.properties`（全環境共通の設定）に環境ごとの差分ファイルを重ね合わせることで、これを実現する仕組みです。

### 読み込みの仕組み：共通設定＋差分マージ

Spring Bootは起動時に、まず`application.properties`を読み込みます。そのうえで、現在「アクティブ」なプロファイルに対応する`application-{プロファイル名}.properties`（`{プロファイル名}`は`dev`・`prod`など任意の文字列）があれば、追加で読み込みます。

重要なのは、この重ね合わせが**ファイルの置き換えではなくキー単位のマージ**だという点です。プロファイル別ファイルに書かれているキーだけが共通ファイルの値を上書きし、書かれていないキーは共通ファイルの値がそのまま使われます。そのため、プロファイル別ファイルには「その環境で変えたい差分」だけを書けば済みます。

> **Laravelとの対比**
> Laravelで`.env`や`APP_ENV`によって設定を環境ごとに切り替えるのと似た発想です。ただしLaravelの`.env`は基本的に1環境につき1ファイルで全ての値を持つのに対し、Spring Bootのプロファイル別ファイルは「共通ファイルとの差分」だけを書く点が異なります。

### プロファイルの有効化方法

ファイルを用意しただけでは自動的に使われません。「どのプロファイルをアクティブにするか」を起動時に別途指定する必要があります。代表的な指定方法は次のとおりです。

| 指定方法 | 例 |
| --- | --- |
| 環境変数 | `SPRING_PROFILES_ACTIVE=dev` |
| JVM引数 | `-Dspring.profiles.active=dev` |
| コマンドライン引数 | `java -jar app.jar --spring.profiles.active=dev` |

プロファイルが1つも指定されていない場合、Spring Bootは暗黙的に**`default`プロファイル**が有効な状態として動作します。このとき使われるのは共通ファイル（`application.properties`）の値のみです。

### このプロジェクトでの適用：Secure by Default

本プロジェクトでは、次の2つの設定でこの仕組みを使っています。

**例1：`/actuator/health`エンドポイントの詳細表示設定**（[8章](./02-build-config.md#8-applicationproperties-の読み方)）

- `application.properties`（共通・全環境の既定値）: `management.endpoint.health.show-details=never`
- `application-dev.properties`（開発時のみの上書き）: `management.endpoint.health.show-details=always`
- `docker-compose.yml`の`backend`サービスに`SPRING_PROFILES_ACTIVE=dev`を設定し、開発時（`docker compose up`実行時）のみ`dev`プロファイルを有効化

あえて「共通ファイルを本番基準の安全な値にし、開発用だけ緩める」という順序にしているのは、**Secure by Default（Fail-Safe Defaults）**という考え方によるものです。仮に本番環境でプロファイルの指定を忘れる、あるいは設定ファイルの配置を誤るといったミスがあっても、defaultプロファイル（＝共通ファイルの値のみ）で起動するため、安全側の`never`のまま動作します。逆に「共通を`always`にして本番で上書きする」設計だと、同じミスが本番でのDB接続状況の漏洩に直結してしまいます。「ミスをしたときにどちらに転ぶか」という結果の非対称性を踏まえ、危険な側ではなく安全な側をデフォルトにするのが基本方針です。

**例2：発行されるSQLのログ出力**（Repository層の実装時に追加。[19章](./05-repository.md#19-queryとjpql動的な絞り込み)・[24章](./07-jpa-performance.md#24-n1問題とその回避)参照）

- `application.properties`（共通・全環境の既定値）: 何も設定しない（＝SQLログは出ない）
- `application-dev.properties`（開発時のみの上書き）: `logging.level.org.hibernate.SQL=debug`など

SQLログにはWHERE句に渡した実データ（絞り込みキーワードなど）が載り得るため、health詳細表示と同じ理由で全環境共通側には置かず、devプロファイル限定にしています。本番相当の環境で機密性のあるログを誤って出力してしまうリスクを、プロファイルの構造自体で防いでいます。

### 実際のファイル：application-dev.properties

```properties
# --- 開発プロファイル(dev)専用の上書き設定 ---
# ここに書いた値は application.properties の同名キーを上書きする（キー単位のマージであり、
# ファイル全体が置き換わるわけではないため、ここには開発時に変えたい差分だけを書く）。
# docker-compose.yml で backend コンテナに SPRING_PROFILES_ACTIVE=dev を設定しており、
# 開発時（docker compose起動時）のみこのファイルが読み込まれる。

# 接続確認のため /actuator/health に各コンポーネント(db等)の詳細を表示する（開発用）。
# 全環境共通の既定値(application.properties)は安全側の never なので、開発時だけここで
# always に上書きする。
management.endpoint.health.show-details=always

# --- 発行されるSQLのログ出力（開発用） ---
# JPAは「Javaのメソッド呼び出し」と「実際に発行されるSQL」が1対1で見えないため、
# 意図した通りの絞り込み・件数のクエリになっているか、N+1問題（一覧のループのたびに
# 追加SQLが発行される状態）が起きていないかは、ログを見ないと気づけない。
# SQLログにはWHERE句に渡した実データが載り得るため、health詳細表示と同じ理由
# （Secure by Default）で全環境共通側には置かず、devプロファイル限定にする。
logging.level.org.hibernate.SQL=debug
# ログに出るSQL中の "?" プレースホルダに、実際にバインドされた値も出す。
logging.level.org.hibernate.orm.jdbc.bind=trace
# 1行の長いSQLを改行・インデント付きで整形し、ログを読みやすくする。
spring.jpa.properties.hibernate.format_sql=true
```

---

*補足：本番用の`backend/Dockerfile`には現時点で`SPRING_PROFILES_ACTIVE`の指定がありません。これは「プロファイル未指定＝defaultプロファイル＝共通ファイルの安全な値が使われる」ことを意味し、上記のSecure by Defaultの設計方針とちょうど噛み合っています。将来、本番固有の設定（例：ログレベルなど）が増えた場合は、`application-prod.properties`を追加し、本番のコンテナ起動時に`SPRING_PROFILES_ACTIVE=prod`を明示的に指定する運用に発展させることが考えられます。*
