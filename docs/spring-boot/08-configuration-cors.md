# `@Configuration`とCORS設定

[← 学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **26〜27章** をまとめています。

---

## 26. `@Configuration`とBean定義

> **`@Configuration`とは？**
> クラス自身が「フレームワークの設定情報である」ことを示すアノテーションです。`@RestController`・`@Service`・`@RestControllerAdvice`と同じく、付いたクラスはコンポーネントスキャン（[4章](./01-architecture.md#4-アプリケーションの起動の仕組み)）でBeanとして登録されますが、役割が違います。前者3つが「業務処理・リクエストの受け口」を担うのに対し、`@Configuration`は「フレームワーク自体の振る舞いをどう組み立てるか」を担います。

本プロジェクトで最初に登場する`@Configuration`クラスが、CORSを設定する`CorsConfig`です（[27章](#27-corsとフロントエンドとの接続)）。

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
	// ...
}
```

### すでに登場したBean定義用アノテーションとの違い

| アノテーション | 役割 | 本プロジェクトでの例 |
| --- | --- | --- |
| `@RestController` | HTTPリクエストの受け口。URLとメソッドに応じて処理を振り分ける | `BoardController`・`CardController`（[21章](./06-service-controller.md#21-controller層とrest-api)） |
| `@Service` | ビジネスロジックを担う | `BoardService`・`CardService`（[20章](./06-service-controller.md#20-service層とtransactional)） |
| `@RestControllerAdvice` | 例外処理を一元化する | `GlobalExceptionHandler`（[23章](./06-service-controller.md#23-例外処理とrestcontrolleradvice)） |
| `@Configuration` | フレームワークの構成（設定）を担う | `CorsConfig` |

どれも最終的には[3章](./01-architecture.md#3-di依存性注入とiocコンテナ)のIoCコンテナに登録されるBeanという点は同じです。違うのは「何のためのクラスか」という意図であり、`@Configuration`は「このアプリケーションはこう構成されている（動く）」という宣言を担うクラスに使います。

### `@Bean`メソッドとコンポーネントスキャンの使い分け

`@Configuration`クラスの主な使い道はもう1つあり、クラス内に`@Bean`を付けたメソッドを書くことで、そのメソッドの戻り値をBeanとして登録する方法があります。

```java
@Configuration
public class SomeConfig {
	@Bean
	public SomeClass someBean() {
		return new SomeClass(...); // newで組み立てた結果をBeanとして登録する
	}
}
```

これは、`@Service`や`@Repository`のように**自分で書いたクラス**にアノテーションを付けてスキャンさせる方式が使えない場面――例えば、外部ライブラリが提供する既存のクラス（`RestTemplate`やライブラリのクライアントなど、ソースを直接編集できないクラス）をBeanにしたいときに使います。`CorsConfig`は自分で書いたクラスに`@Configuration`を付けているだけで`@Bean`メソッドは使っていませんが、両者とも最終的には「IoCコンテナにBeanとして登録する」という同じ目的の別の手段です。

### `WebMvcConfigurer`と`@EnableWebMvc`

`CorsConfig`は`WebMvcConfigurer`というインターフェースを実装しています。

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
	@Override
	public void addCorsMappings(CorsRegistry registry) {
		// ...
	}
}
```

`WebMvcConfigurer`はSpring MVCの様々な設定ポイント（CORS・静的リソースの扱い・フォーマッタなど）に対応するメソッドを持つインターフェースで、必要なメソッドだけを`@Override`すれば、そこだけに「差分」を追加できます。実装しなかったメソッドには既定の空実装（Javaの`default`メソッド）が使われるため、Spring Bootが自動構成した設定はそのまま生きています。

似て非なるものに`@EnableWebMvc`というアノテーションがありますが、こちらは**Spring Bootの自動構成をまるごと無効化して、Web MVCの設定を全て自分で持つ**という宣言になります。`@EnableWebMvc`を付けてしまうと、Jacksonのシリアライズ設定や`spring.mvc.problemdetails.enabled=true`（[23章](./06-service-controller.md#23-例外処理とrestcontrolleradvice)）の効果まで自分で再設定する羽目になるため、`CorsConfig`では**付けていません**。「差分を足す」`WebMvcConfigurer`実装と、「全部を自分で持つ」`@EnableWebMvc`は明確に別の手段だと覚えておいてください。

### `@Value`によるプロパティの注入

```java
public CorsConfig(@Value("${app.cors.allowed-origins}") String[] allowedOrigins) {
	this.allowedOrigins = allowedOrigins;
}
```

`@Value("${プロパティ名}")`は、`application.properties`（[8章](./02-build-config.md#8-applicationproperties-の読み方)）に書いた値を1つだけ注入するアノテーションです。カンマ区切りの文字列（`http://localhost:5173,http://127.0.0.1:5173`）から`String[]`への変換は、Springの`ConversionService`が自動で行います。

注入の方法はここでもコンストラクタインジェクション（[3章](./01-architecture.md#3-di依存性注入とiocコンテナ)）を使い、受け取った値は`final`フィールドに入れています。既存の`BoardController`・`CardService`などと同じ流儀に揃えることで、「Beanは生成後に依存を差し替えない」という設計方針を型で保証しています。

> **Laravelとの対比**
> Laravelの`config/*.php`（例：`config/cors.php`）とサービスプロバイダ（`AppServiceProvider`など）を合わせたものが、Spring Bootの`@Configuration`クラスに近い立ち位置です。Laravelでは設定ファイルと登録処理が分かれていることが多いですが、Spring Bootでは「設定値を読み込む」ことと「その値を使ってフレームワークに登録する」ことを1つの`@Configuration`クラスの中で完結させます。

---

## 27. CORSとフロントエンドとの接続

> **CORS（Cross-Origin Resource Sharing）とは？**
> ブラウザが標準で備えている「同一オリジンポリシー」――表示中のページとは異なるオリジンへの通信結果を、サーバーが明示的に許可しない限りJavaScriptに渡さない制限――を、安全に緩和するための仕組みです。

### オリジンとは何か

オリジンは「スキーム（`http`/`https`）＋ホスト＋**ポート**」の組み合わせで決まります。本プロジェクトの開発環境では、画面が`http://localhost:5173`（Viteの開発サーバー）、APIが`http://localhost:8080`（Spring Boot）で、ホストは同じ`localhost`でもポートが異なるため、ブラウザから見ると**別オリジン**になります。

### CORSはAPIを守るセキュリティ機構ではない

`curl`や`Postman`でこのAPIを叩いてもCORSは一切問題になりません（[検証](#curlによる動作確認)参照）。これは、同一オリジンポリシーが**ブラウザが自主的に課している制限**であって、サーバー側の認可（authorization）の仕組みではないためです。サーバーは求められればどんな相手にもレスポンスを返しており、CORSの設定（`Access-Control-Allow-Origin`ヘッダー）は「このレスポンスをどのオリジンのJavaScriptに渡してよいか」をブラウザに伝えるための宣言に過ぎません。したがって、**CORSを設定してもAPI自体への不正アクセスを防げるわけではない**という点を誤解しないようにしてください（認証・認可が必要なら別の仕組みが要ります。本プロジェクトの認証方針は[要件定義8.2](../requirements/02-requirements.md#82-認証セキュリティ)を参照）。

### 単純リクエストとプリフライトリクエスト

ブラウザは、クロスオリジンのリクエストを2種類に分けて扱います。

- **単純リクエスト（simple request）**：`GET`/`HEAD`/`POST`のいずれかで、かつリクエストヘッダーが`Accept`・`Accept-Language`・`Content-Language`・`Content-Type`（一部の値に限る）などの「安全とみなされた種類」に限られる場合。ブラウザは実際のリクエストをそのまま送り、レスポンスの`Access-Control-Allow-Origin`を見てJavaScriptに渡すかどうかを判断します。
- **プリフライトリクエスト（preflight request）**：それ以外（例：`Content-Type: application/json`を付けた`POST`、独自ヘッダーを付けたリクエストなど）の場合。ブラウザは本番のリクエストを送る前に`OPTIONS`メソッドで「この種類のリクエストを送ってよいか」を問い合わせ、許可が返ってきて初めて本番のリクエストを送ります。

GET系のAPIは`Content-Type`を送らない単純リクエストに該当するため、プリフライトは発生しません。一方、カード・ボードの新規作成で追加した`POST`は`Content-Type: application/json`を伴うため、これらのエンドポイントを叩くたびに実際にプリフライトが発生するようになりました（[下記](#curlによる動作確認)で確認します）。

**重要な補足**：単純リクエストは「プリフライトが発生しない」だけであり、「CORSの設定が要らない」わけではありません。実際のレスポンスに`Access-Control-Allow-Origin`が無ければ、ブラウザはリクエストを送り届けた後でもレスポンス本文をJavaScriptに渡しません（[下記の挙動](#設定を誤ったときにブラウザで何が起きるか)参照）。

### 実装：`CorsConfig`

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {

	private final String[] allowedOrigins;

	public CorsConfig(@Value("${app.cors.allowed-origins}") String[] allowedOrigins) {
		this.allowedOrigins = allowedOrigins;
	}

	@Override
	public void addCorsMappings(CorsRegistry registry) {
		registry.addMapping("/api/**")
				.allowedOrigins(allowedOrigins)
				.allowedMethods("GET", "POST")
				.allowCredentials(false);
	}
}
```

`addMapping("/api/**")`で「どのURLパターンにこのCORS設定を適用するか」を、`allowedOrigins(...)`で「どのオリジンからのリクエストを許可するか」を指定します。

**`allowedMethods`は今できることの正直な写し**：このAPIが参照専用（GETのみ）だった間、`allowedMethods("GET")`はPOSTを先回りして許可していませんでした。理由は、`allowedMethods`がブラウザに対する宣言でありサーバー側の認可ではない以上、先に許可しておいても安全性は1ミリも上がらず、むしろ「今のAPIには何ができるか」という正直さが失われるためです。カード・ボードの新規作成（[28章](./09-write-api-validation.md#28-登録系apipostの作り方)）でPOSTを実装した今、`allowedMethods("GET", "POST")`へ引き上げました。これは「先回りして許可していた設定を後から使い始めた」のではなく、「実装した機能ぶんだけ許可を広げた」という順序です。この時点ではまだ実装していなかったPUT/DELETEは、引き続きここに含めていませんでした（その後カードの編集・ステータス変更でPUT/PATCHを実装した際に、同じ方針のまま`allowedMethods("GET", "POST", "PUT", "PATCH")`へ引き上げています。[37章](./10-update-api.md#37-corsへの追記)参照）。この方針を裏付けたのが、実装直後に実際に体験した次の失敗です。

> 書き込みAPI追加時に出るブラウザのCORSエラーは初回の手動テストで必ず出る「うるさい失敗」で、静かに見逃されることがありません（[25章](./07-jpa-performance.md#25-open-in-viewと遅延読み込みの境界)の`open-in-view=false`と同じ「静かな見落としより騒がしい失敗を選ぶ」という設計態度です）。実際、`CorsConfig`の更新を1テンポ忘れたままフロントエンドから`POST /api/cards`を叩くと、ブラウザの開発者ツールには`Access to fetch at 'http://localhost:8080/api/cards' from origin 'http://localhost:5173' has been blocked by CORS policy`という、原因のはっきりしたエラーが出ます。これは[下記](#設定を誤ったときにブラウザで何が起きるか)で見る`TypeError: Failed to fetch`と対になる、CORS設定漏れ特有の症状です。

**`allowedHeaders`・`maxAge`を書いていない理由**：Spring の`CorsRegistration`は生成時に内部で`applyPermitDefaultValues()`を呼び、`allowedHeaders`を`"*"`、`maxAge`（プリフライト結果のブラウザ側キャッシュ期間）を1800秒に設定済みです。現状のリクエストはカスタムヘッダーを送らないため、明示しても効果は変わりません（実測は[下記](#curlによる動作確認)のとおり）。

**`allowCredentials(false)`にしている理由**：Cookieや`Authorization`ヘッダーを使った認証をこのAPIは行っていないため、意図的に`false`にしています。なお、CORS仕様では`allowCredentials(true)`と`allowedOrigins("*")`の併用が禁止されており、組み合わせるとSpringは起動時に例外を投げます。

### 設定値の切り替え：Secure by Default

許可オリジンはコードに直接書かず、`app.cors.allowed-origins`というプロパティにしています。[16章](./04-profiles.md#16-環境ごとの設定切り替えプロファイル)のプロファイルの仕組みで、health詳細表示・SQLログ出力に続く3例目として同じパターンを踏襲しています。

```properties
# application.properties（全環境共通の既定値）
app.cors.allowed-origins=
```

```properties
# application-dev.properties（開発時のみの上書き）
app.cors.allowed-origins=http://localhost:5173,http://127.0.0.1:5173
```

全環境共通の既定値を「空＝どのオリジンも許可しない」にしているのは、本番はリバースプロキシ配下で画面とAPIを同一オリジンに揃える想定（[要件定義9.1](../requirements/05-tech-stack-and-roadmap.md#91-採用する技術スタック)）のため、そもそもCORSでの許可自体が不要だからです。万一プロファイル指定を本番で忘れても、任意のサイトのJavaScriptからAPIレスポンスを読み取られる状態にはなりません。

`http://127.0.0.1:5173`も併記しているのは、オリジンの同一性がホスト名の**文字列一致**で判定されるためです。`http://127.0.0.1:5173`で開発サーバーを開くと、`http://localhost:5173`とは別オリジン扱いになり、許可が効きません。

### 採用しなかった選択肢

- **`@CrossOrigin`をControllerに付ける**：Controllerクラスやメソッドに直接付与する方式もありますが、許可ポリシーがコードのあちこちに散り、プロパティによる環境ごとの切り替え（Secure by Default）もできません。API全体に一貫したポリシーを適用したい今回には不向きです。
- **`CorsFilter`Bean**：サーブレットのフィルタとして実装する、より低レベルな方法です。Spring Securityを導入する場合はそちらの仕組みと噛み合わせる必要が出てきますが、本プロジェクトは現時点でSpring Securityを使っていないため、`WebMvcConfigurer`で十分です。
- **Viteの開発サーバーのプロキシ機能**：フロントエンド側でリクエストを中継し、ブラウザからは同一オリジンに見せる方法です。開発中はCORS自体を回避できますが、本番でも画面とAPIが別ホストになる構成（要件定義9.1で想定していない構成）を選んだ場合に必要な対応が先送りになります。今回はバックエンド側の設定を選びました。

### `curl`による動作確認

`curl`はブラウザではないため、そもそもCORSの制限を受けません（[上記](#corsはapiを守るセキュリティ機構ではない)参照）。ここでは`-H "Origin: ..."`でブラウザが送るヘッダーを模倣し、サーバーが返すCORS関連のレスポンスヘッダーを確認します。

```bash
# ① 許可されたオリジンからのGET
curl -i -s -H "Origin: http://localhost:5173" http://localhost:8080/api/boards
```
```
HTTP/1.1 200
Vary: Origin
Vary: Access-Control-Request-Method
Vary: Access-Control-Request-Headers
Access-Control-Allow-Origin: http://localhost:5173
```

```bash
# ② 許可されていないオリジン
curl -i -s -H "Origin: http://evil.example" http://localhost:8080/api/boards
```
```
HTTP/1.1 403

Invalid CORS request
```
空配列（＝どのオリジンにも一致しない）の場合、Springは「200を返すがヘッダーが無く、ブラウザ側で黙って握り潰される」のではなく、**403「Invalid CORS request」を明示的に返します**。これにより、設定漏れがあれば`curl`の段階で気づけます。

```bash
# ③ Originヘッダーなし（curl/Postmanの通常利用）
curl -s http://localhost:8080/api/boards
```
```
[{"id":1,"name":"仕事", ...}]
```
Originヘッダーが無いリクエスト（＝ブラウザ以外のクライアント）は、CORSの判定自体が働かず素通りします。これが「CORSはブラウザの制限であり、サーバー側の認可ではない」ことの実証です。

```bash
# ④ プリフライトを手動で送る（今のGETでは本来発生しない）
curl -i -s -X OPTIONS -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" http://localhost:8080/api/boards
```
```
HTTP/1.1 200
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET,POST
Access-Control-Max-Age: 1800
```
`allowedHeaders`・`maxAge`を明示していなくても、`Access-Control-Max-Age: 1800`が返っています。これが前述の`applyPermitDefaultValues()`の効果です。`Access-Control-Allow-Methods`に`POST`が含まれるようになったのは、[28章](./09-write-api-validation.md#28-登録系apipostの作り方)でカード・ボードの新規作成を実装し、`allowedMethods`へ追加したためです。

```bash
# ⑤ カード新規作成POSTの、実際に発生するプリフライト
curl -i -s -X OPTIONS -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" http://localhost:8080/api/cards
```
```
HTTP/1.1 200
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET,POST
Access-Control-Allow-Headers: Content-Type
Access-Control-Max-Age: 1800
```
`POST /api/cards`は`Content-Type: application/json`を伴うため単純リクエストに該当せず（[上記](#単純リクエストとプリフライトリクエスト)）、フロントエンドから実際にカードを作成するたびに、ブラウザはこの`OPTIONS`リクエストをまず送ってから本番の`POST`を送っています。もし`allowedMethods`に`POST`を追加し忘れていれば、ここが`403 Invalid CORS request`になり、[28章](./09-write-api-validation.md#28-登録系apipostの作り方)の実装より先にこの検証で気づけます。

### 設定を誤ったときにブラウザで何が起きるか

CORSの許可が無い状態でフロントエンドから`fetch`を実行すると、開発者ツールのコンソールには次のようなメッセージだけが表示されます。

```
TypeError: Failed to fetch
```

これは「サーバーに到達できなかった」のか「サーバーからは応答があったがCORSでブラウザに破棄された」のかを区別しない、意図的に情報量を絞ったエラーです（ブラウザが攻撃者に手がかりを与えないための設計）。実際の理由（`Access-Control-Allow-Origin`が無かった、など）は、開発者ツールのConsole/Networkタブに個別に表示されます。フロントエンドの`api/client.ts`（`fetchJson`）は、この`TypeError: Failed to fetch`を捕まえて「APIサーバーに接続できませんでした。バックエンドが起動しているか、CORSの設定が正しいかを確認してください。」という、両方の可能性に触れたメッセージに変換しています。

---

*本ドキュメントは開発と並行して育てていく学習ノートです。実装で分からない概念が出てきたら、まずここに解説がないか確認し、無ければ追記してください。*
