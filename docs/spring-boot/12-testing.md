# 自動テスト（JUnit 5・Mockito・MockMvc）

[← 学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **44章** をまとめています。

---

## 44. 自動テスト：業務ルールをコードで守る

### なぜ今テストを書くのか

ここまでの実装で、Service層には要件定義に由来する判断がいくつも積み上がりました。

- 完了ステータスのカードのみアーカイブできる（[38章](./10-update-api.md#38-アーカイブフラグ更新と冪等性)）
- アーカイブ済みのカードのみ完全に削除できる（[42章](./11-delete-api.md#42-削除の可否を状態で決める在るかだけでは足りないとき)）
- ラベルは同じボードのものしか付けられない（[32章](./09-write-api-validation.md#32-アプリケーション層での重複許可値チェック)）
- 移動先の列は position を1から振り直す（[36章](./10-update-api.md#36-ステータス変更と列内の並び替え)）

これらはどれも「壊れても画面はそれらしく動いてしまう」種類のルールです。例えば position の振り直しをやめても、カードは表示され続けます。順序が少しおかしくなるだけで、気づくのは何日も後かもしれません。

それまで、これらが正しく動くことを確かめる手段は `curl` による手動確認しかありませんでした。手で確かめる方法には2つの問題があります。**確かめたことが残らない**ことと、**次に誰かがコードを触ったときに再実行されない**ことです。テストコードは、この2つを同時に解決します。

### なぜ Testcontainers を使わなかったか

当初は Testcontainers（テストの実行中に本物のPostgreSQLをDockerで起動するライブラリ）を検討しました。本物のDBを相手にできるため、JPQLの記述ミスやDBの制約違反まで検出できます。

しかし本プロジェクトのbackendはDockerコンテナの中で動いており、その中から**さらにDockerを起動することはできません**。

```
$ docker exec task-management-backend ls /var/run/docker.sock
ls: cannot access '/var/run/docker.sock': No such file or directory
```

Testcontainers はホストのDockerへ接続するために、この `docker.sock` をコンテナ内から見えるようにする（マウントする）必要があります。現在の `docker-compose.yml` はそれを行っていません。

「できないから諦める」のではなく、**何なら今できるか**を考えます。検証したいことの中心は「業務ルールが正しいか」であり、それはDBを使わなくても確かめられます。Repositoryを偽物に差し替えれば、Service層の判断だけを取り出して検査できるからです。

| 層 | 手法 | DB | 何を検証するか |
| --- | --- | --- | --- |
| Service | JUnit 5 + Mockito | 不要 | 業務ルールそのもの |
| Controller | `@WebMvcTest` + MockMvc | 不要 | URL・バリデーション・ステータスコード・レスポンスの形 |
| （将来）結合 | Testcontainers | 必要 | JPQL・DBの制約 |

### Mockito：本物のRepositoryを偽物に差し替える

`CardService` は4つのRepositoryを受け取って動きます。テストではこれらを**モック**（呼び出しを記録し、指示した値を返すだけの偽物）に置き換えます。

```java
@ExtendWith(MockitoExtension.class)
class CardServiceTest {

	@Mock
	private CardRepository cardRepository;
	// ...他3つも同様

	@InjectMocks
	private CardService cardService;
```

| アノテーション | 役割 |
| --- | --- |
| `@ExtendWith(MockitoExtension.class)` | テストごとにモックを作り直す。JUnit 5にMockitoを組み込むための宣言 |
| `@Mock` | このフィールドをモックにする |
| `@InjectMocks` | `@Mock`を付けたフィールドを**コンストラクタ経由で注入**したテスト対象を作る |

`@InjectMocks` が行っているのは、[3章](./01-architecture.md#3-di依存性注入とiocコンテナ)で見たDIと同じことです。本番ではSpringのIoCコンテナが本物のRepositoryを注入しますが、テストではMockitoがモックを注入します。**コンストラクタインジェクションを採用していたおかげで、テスト時に差し替えられる**——DIの利点がここで実際に効いてきます。

テスト本体は「どんな状態のカードを相手にすると、どう振る舞うか」を書き下すだけです。

```java
@Test
@DisplayName("完了ステータス以外のカードはアーカイブできない")
void 完了以外はアーカイブできない() {
	Card doing = card(1, "doing", false);
	when(cardRepository.findByIdWithBoard(1)).thenReturn(Optional.of(doing));

	assertThatThrownBy(() -> cardService.updateArchived(1, new CardArchiveUpdateRequest(true)))
			.isInstanceOf(InvalidRequestException.class)
			.hasMessageContaining("完了ステータスのカードのみ");

	assertThat(doing.getIsArchived()).isFalse();
}
```

`when(...).thenReturn(...)` が「このメソッドが呼ばれたらこれを返せ」という指示（**スタブ**）です。DBを一切使わずに「作業中のカードが1件ある状態」を作り出せるのが、モックの効果です。

最後の1行にも意味があります。例外を投げた以上、**カードの状態は変わっていないはず**です。「エラーになること」だけでなく「エラーになったとき何も壊していないこと」まで確かめています。

#### `verify`：呼ばれなかったことを確かめる

Mockitoは「呼ばれたこと」だけでなく「**呼ばれなかったこと**」も検証できます。

```java
// 色の検証は、重複チェックのSQLを発行する前に行われる
verify(labelRepository, never()).existsByBoardIdAndName(any(), any());
```

[32章](./09-write-api-validation.md#32-アプリケーション層での重複許可値チェック)で「DBを見なくても分かる形式的な不正を先に弾く」という順序を意図的に選びました。しかしこの順序は、コードを読み替えても結果（400が返ること）は同じなので、うっかり入れ替えても誰も気づきません。`never()` で「この時点ではまだDBに問い合わせていない」ことを固定しておけば、設計判断そのものがテストで守られます。

#### strict stubs：使わないスタブは書けない

Mockitoは既定で「スタブしたのに一度も呼ばれなかった」場合にテストを失敗させます（strict stubs）。最初は煩わしく感じますが、これは**テストが実際に通る経路を、書き手に正確に理解させる**ための仕組みです。「念のため」で書いたスタブが残っていると、テストが何を検証しているのかが曖昧になります。

### `@WebMvcTest`：Spring MVCだけを起動する

Controller層のテストでは、`@SpringBootTest`（アプリ全体を起動）ではなく `@WebMvcTest` を使います。

```java
@WebMvcTest(CardController.class)
class CardControllerTest {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private CardService cardService;
```

`@WebMvcTest` は**スライステスト**と呼ばれ、Spring MVCに関わるBean（Controller・`@RestControllerAdvice`・Jacksonの設定など）だけを読み込みます。Service・Repository・DataSourceは読み込まれません。これが、DBが無くても実行できる理由です。

`@MockitoBean` は、そのスライスのApplicationContextへモックをBeanとして登録します。`@Mock` との違いは、**Springのコンテナに登録されるかどうか**です。Controllerはコンストラクタで `CardService` を受け取るため、コンテナ側にモックを置いてやる必要があります。

#### 何を検証するのか——Serviceと重複させない

Controllerのテストで業務ルールを再度検証しても意味がありません。ここで確かめるのは、Controller自身の責務です。

```java
@Test
@DisplayName("POST /api/cards は201と、作成したリソースのURLをLocationヘッダーで返す")
void 作成は201とLocationを返す() throws Exception {
	when(cardService.create(any())).thenReturn(response(18));

	mockMvc.perform(post("/api/cards")
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"boardId\":1,\"title\":\"打合せ資料\"}"))
			.andExpect(status().isCreated())
			.andExpect(header().string("Location", "/api/cards/18"));
}
```

[28章](./09-write-api-validation.md#28-登録系apipostの作り方)で「POSTは201とLocationヘッダーを返す」と決めました。その決定が実際に守られているかを、HTTPのレベルで確認しています。

もうひとつ重要なのが、**例外がHTTPへどう変換されるか**の検証です。

```java
@Test
@DisplayName("Serviceが投げたInvalidRequestExceptionは400のProblemDetailに変換される")
void 業務ルール違反は400() throws Exception {
	when(cardService.updateArchived(eq(1), any()))
			.thenThrow(new InvalidRequestException("完了ステータスのカードのみアーカイブできます"));

	mockMvc.perform(patch("/api/cards/1/archive")
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"archived\":true}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.detail").value("完了ステータスのカードのみアーカイブできます"));
}
```

[23章](./06-service-controller.md#23-例外処理とrestcontrolleradvice)の `GlobalExceptionHandler` は、Controllerのコードには一切登場しない「離れた場所にある仕掛け」です。だからこそ、壊れたことに気づきにくい。Serviceが例外を投げるところからHTTPレスポンスのJSONが組み立てられるまでを通しで確認できるのが、このスライステストの価値です。

バリデーションについても同様です。

```java
.andExpect(jsonPath("$.errors.title").value("タイトルを入力してください"))
```

[30章](./09-write-api-validation.md#30-バリデーションエラーを400で返す)で、フロントエンドが入力欄ごとにエラーを出し分けられるよう `errors` という拡張メンバーを足しました。その形が保たれていることを、`jsonPath` でピンポイントに確かめています。

### テストが「飾り」でないことを確かめる

書いたテストが常に緑になるだけでは、何も守っていないのと同じです。**わざと実装を壊して、狙ったテストが赤くなるか**を確認しました。

`CardService` の3箇所の判定を一時的に無効化（`if (false)` に置換）して実行した結果です。

```
CardServiceTest > todo/doing/done以外のステータスは拒否される FAILED
CardServiceTest > アーカイブされていないカードは削除できない FAILED
CardServiceTest > 完了ステータス以外のカードはアーカイブできない FAILED
```

壊した3箇所に対応する3件だけが、過不足なく失敗しました。テストが実装の振る舞いに本当に結びついていることの確認です。この手順は、テストを追加したときに一度やっておく価値があります（実装を戻すのを忘れないよう、`git checkout` で復元できる状態で行います）。

### テストコードも静的解析の対象にする

[43章](./02-build-config.md#43-静的解析ツールの導入)で導入したCheckstyleは、当初テストコードを対象外にしていました。

```groovy
sourceSets = [sourceSets.main]  // 導入当初
```

「空のスモークテスト1件しか無く、検査から得られる価値が薄い」という理由でしたが、テストが34件になった今、この前提は変わりました。テストコードも読んで意味が分かることが重要な資産であり、本体と同じ規約で保つべきです。

```groovy
sourceSets = [sourceSets.main, sourceSets.test]
```

### 残っている課題

- **JPQLは検証できていない**：`CardRepository.search` の絞り込み条件（[19章](./05-repository.md#19-queryとjpql動的な絞り込み)）はモックに差し替えられてしまうため、このテストでは一切実行されません。DBを相手にする結合テストが必要な領域です
- **`@SpringBootTest` はDBを要求する**：`TaskManagementApplicationTests` だけはDataSourceの構築まで行うため、Docker環境の外では失敗します
- **CIには組み込んでいない**：現在CIは `./gradlew build` のみで、テストの実行は push 前のローカルチェック（`scripts/quality-check.sh`）に委ねています

---

[← 学習ドキュメントトップへ戻る](./README.md)
