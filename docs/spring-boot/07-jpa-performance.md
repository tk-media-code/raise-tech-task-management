# N+1問題とパフォーマンス

[← 学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **24〜25章** をまとめています。

---

## 24. N+1問題とその回避

> **N+1問題とは？**
> 一覧（N件）を取得したあと、各要素に関連する別の情報を取得するために、要素の件数ぶん（N回）追加のSQLを発行してしまう問題です。「1回の一覧取得」＋「N回の追加取得」＝「N+1回のSQL」になることからこう呼ばれます。件数が増えるほどSQLの発行回数が線形に増え、パフォーマンスが大きく劣化します。

カード一覧API（`GET /api/cards`）は、各カードに付与されたラベルの一覧（`labels`）をレスポンスにネストします（[22章](./06-service-controller.md#22-dtoレコードでエンティティを外に出さない)）。素朴に実装すると「カードN件を取得したあと、各カードごとに`SELECT * FROM card_label WHERE card_id = ?`を発行する」という、まさにN+1のパターンに陥ります。

### 24.1 なぜJPAだとN+1が「うっかり」起きるのか

生のSQLを手で書いていれば、N+1問題はまず起きません。「一覧を1本のSQLで取る」か「関連するテーブルもJOINして1本で取る」かを、書いた本人がその都度意識してSQLを組み立てるからです。N+1が起きるのは、ORM（[10章](./03-entity-jpa.md#10-jpahibernateormとは)）を使い、関連の取得をJavaのメソッド呼び出しに任せているときに限られます。

原因は`fetch = LAZY`（[12章](./03-entity-jpa.md#12-リレーション関連の書き方)）と**プロキシ**の組み合わせです。本プロジェクトの`@ManyToOne`は、`Card.board`・`CardLabel.card`・`CardLabel.label`・`Label.board`のすべてが`fetch = FetchType.LAZY`に設定されています。`card.getBoard()`を呼んだ瞬間に返ってくるのは`Board`本体ではなく、Hibernateが生成した「まだ中身の入っていない身代わり（プロキシ）」です。このプロキシに対して`getName()`のようにフィールドへ実際にアクセスした瞬間、初めて`select ... from board where id = ?`が発行されます。

これが、JPAで最も注意すべき性質です。**Javaのメソッド呼び出し1回が、その裏でSQL1本に化けることがある**——しかも、コードを読むだけではそれがいつ起きるのかが分かりません。`application-dev.properties`でSQLログ（[8章](./02-build-config.md#8-applicationproperties-の読み方)）を有効にしているのは、まさにこの「見えない発行」を可視化するためです。

もし本プロジェクトが素朴に実装していたら（**以下は実際のコードではありません**）、次のようなループがN+1を引き起こします。

```java
// 実際のコードではない。N+1に陥る素朴な実装の例
List<Card> cards = cardRepository.findAll(); // 1本目：カード一覧
List<CardResponse> responses = new ArrayList<>();
for (Card card : cards) {
	// card.getBoard() はLAZYプロキシ。.getName() で初めて中身が要求され、
	// ループを回るたびに select ... from board where id = ? が飛ぶ（2本目以降）
	responses.add(new CardResponse(card.getId(), card.getBoard().getId(), card.getBoard().getName(), /* ... */ null));
}
```

**「EAGERにすれば解決するのでは？」**という疑問もよく出ますが、これは誤解です。`EAGER`は「関連を必ず取得する」という指定であって、「まとめて1本で取得する」という指定ではありません。素朴なJPQLや`findAll()`でEAGERな関連を辿ると、結局は関連ごとに追加のSELECTが飛び、一覧取得ではむしろ確実にN+1を招きます。だからこそ本プロジェクトは、**全ての`@ManyToOne`をLAZYにしたうえで、本当に必要な箇所だけ`join fetch`で明示的にまとめて取得する**という方針を徹底しています。

### 24.2 何がどれだけ遅いのかを数字で見る

「SQLが数本増えたところで大した差ではない」と思うかもしれませんが、問題の本質は**1本あたりの実行時間**ではなく、**DBとの往復（ラウンドトリップ）の回数**です。1回の往復には、SQLの実行時間そのものに加えて、ネットワーク（コンテナ間通信）の遅延や接続プールからのコネクション取得といった固定コストが乗ります。この固定コストが、カードの件数ぶん積み重なることが問題なのです。

仮に1往復あたり1msだとして、カード一覧の関連ボードがすべて異なる（＝キャッシュが一切効かない最悪ケース）と仮定した場合の比較です。

| カード件数 | N+1の場合のSQL本数 | 本プロジェクトの方式（2クエリ）でのSQL本数 | N+1の場合の往復時間（概算） |
| --- | --- | --- | --- |
| 12件 | 13本（1+12） | 2本 | 約13ms |
| 100件 | 101本（1+100） | 2本 | 約101ms |
| 1000件 | 1001本（1+1000） | 2本 | 約1001ms（1秒超） |

本プロジェクトの方式は、カードが何件になっても常に2本（ヒット0件時は1本）のままです。件数に応じて線形に増えるか、常に一定かの違いが、件数が増えるほど致命的な差になっていきます（後述の24.4節で、実際にN+1を発生させてこの差を確認します）。

### 24.3 回避策の全体像と、本プロジェクトの選択

N+1の回避策は`join fetch`だけではありません。関連の種類（`@ManyToOne`か、1対多相当か）によって向き不向きがあります。

| 手法 | 何をするか | 向いている関連 | 本プロジェクトでの採否 |
| --- | --- | --- | --- |
| `join fetch` | JPQLで1本のSQLにJOINし、関連も同時に取得する | `@ManyToOne`（子から見て親は必ず1つ） | ✅ `CardRepository.search`の`join fetch c.board b` |
| IN句でまとめ取り＋Java側でグルーピング | 対象の主キーを集め、1本の`IN`句で一括取得してからアプリ側で仕分ける | 1対多（1件の親に複数の子） | ✅ `CardLabelRepository.findAllWithLabelByCardIdIn` |
| `@EntityGraph` | fetch joinの内容を`@Query`ではなくアノテーションで宣言的に指定する | `@ManyToOne`（`join fetch`とほぼ同じ効果） | ❌（`@Query`に直接書く方が、絞り込み条件と取得内容を1箇所で見渡せるため採用せず） |
| `@BatchSize` | LAZYな関連の解決を、1件ずつではなくまとめて（例：一括`IN`句で）行うようHibernateに指示する | 1対多 | ❌（何件まとめて解決されるかが設定値次第で変わり、コードを読むだけではSQL本数が分からなくなるため採用せず） |

本プロジェクトでは、`@ManyToOne`には`join fetch`を、1対多相当の関連にはIN句でのまとめ取りを使う、という2パターンで統一しています。

#### 本プロジェクトの実装：2クエリで完結させる

`CardService.search()`は、件数によらず**常に2本**（該当0件のときは1本）のSQLで完結するように設計しています。

```java
public List<CardResponse> search(CardSearchCondition condition) {
	// ...正規化...

	// クエリ1本目：条件に合うカード本体を取得（boardはjoin fetch済み）
	List<Card> cards = cardRepository.search(condition.boardId(), archived, keyword, filterByLabels, labelIds);
	if (cards.isEmpty()) {
		return List.of();  // 0件なら2本目のクエリ自体を発行しない
	}
	return toResponses(cards);
}

private List<CardResponse> toResponses(List<Card> cards) {
	List<Integer> cardIds = cards.stream().map(Card::getId).toList();

	// クエリ2本目：対象カード全件分のラベルを1回のIN句でまとめて取得
	List<CardLabel> cardLabels = cardLabelRepository.findAllWithLabelByCardIdIn(cardIds);

	// cardIdごとにラベルをグルーピングしてDTOを組み立てる
	Map<Integer, List<LabelResponse>> labelsByCardId = cardLabels.stream()
			.collect(Collectors.groupingBy(cl -> cl.getId().getCardId(), LinkedHashMap::new,
					Collectors.mapping(CardService::toLabelResponse, Collectors.toList())));

	return cards.stream()
			.map(card -> toCardResponse(card, labelsByCardId.getOrDefault(card.getId(), Collections.emptyList())))
			.toList();
}
```

1. **1本目**：`CardRepository.search`（[19章](./05-repository.md#19-queryとjpql動的な絞り込み)）が、条件に合うカードを`join fetch c.board`付きで取得する
2. **2本目**：`CardLabelRepository.findAllWithLabelByCardIdIn`が、1本目で取れた全カードIDを`IN`句に渡し、`card_label`と`label`を`join fetch`で一括取得する
3. Java側（`Collectors.groupingBy`）でcardIdごとにラベルをグルーピングし、DTOを組み立てる

📄 `.stream().map().toList()`やメソッド参照（`Card::getId`）、`Collectors.groupingBy`の読み方といった、Java言語としてのStream APIの構文は[docs/java/05-lambda-stream.md](../java/05-lambda-stream.md#23-stream-api)の23章で解説しています。

型を分けて整理すると、この実装は2つの異なるN+1回避パターンを使い分けています。

| 関連の種類 | 回避パターン | 使用箇所 |
| --- | --- | --- |
| `@ManyToOne`（多対一。カードは必ず1つのボードに属する） | `join fetch`で最初から一緒に取得する | `CardRepository.search`の`join fetch c.board b` |
| 1対多相当（1枚のカードに複数のラベル） | 対象の主キーをまとめて`IN`句で問い合わせ、Java側でグルーピングする | `CardLabelRepository.findAllWithLabelByCardIdIn` |

#### なぜ`Card`に`@OneToMany`のコレクションを追加しなかったか

「`Card`に`List<CardLabel> cardLabels`のような`@OneToMany`フィールドを追加し、それをfetch joinで取得する」という設計も考えられますが、本プロジェクトでは採用していません。理由は3つあります。

1. **エンティティを「テーブルの1行の写像」に保てる**：コレクションを持たせると、以後どのクエリでもそれをどう取得するか（LAZY/EAGER/fetch join/バッチサイズ指定）を意識し続ける必要が生じる
2. **コレクションのfetch joinには固有の罠がある**：具体的には次の3つの問題を抱える
   - **行が重複するため`distinct`が必要になる**：JOINの結果は「親×子」の行数になる。例えば1枚のカードに3件のラベルが付いていれば、そのカードの行が3回重複して返ってくる。JPQL側で`distinct`を指定してJava側での重複除去を促す必要があり、忘れるとカードが重複した一覧になってしまう
   - **ページングがメモリ上の処理になってしまう**：コレクションをfetch joinした状態でSQLの`LIMIT`/`OFFSET`によるページングを行うと、行が水増しされているため正しい件数で区切れない。Hibernateはこれを検知すると`HHH000104`という警告を出し、**DBに全件を取得させたうえでJavaのメモリ上でページ分の件数に切り詰める**という動作に切り替える。件数が増えるほどメモリ使用量が膨らみ、本末転倒になる。本プロジェクトは現時点でページングを実装していないが、将来追加する際にまさにこの問題へ直面する
   - **複数コレクションの同時fetch joinで`MultipleBagFetchException`になる**：仮に`Card`に`cardLabels`以外のコレクション（例：将来のコメント機能）も持たせ、両方を同時にfetch joinしようとすると、Hibernateは「重複行同士のどの組み合わせが正しい行か」を一意に決められず例外を投げる
3. **クエリ本数が「必ず2本」とコードを読むだけで分かる**：`@BatchSize`や`@EntityGraph`のような「設定次第でクエリ本数が変わる」仕組みに比べ、「クエリA→クエリBの2段階」という素朴な構造の方が、学習の初期段階では追いやすい

### 24.4 手を動かして確かめる

**① 現状が2本で完結していることを確認する**

開発環境ではSQLログ（[8章](./02-build-config.md#8-applicationproperties-の読み方)、`application-dev.properties`の`logging.level.org.hibernate.SQL=debug`）が有効になっており、実際に何本のSQLが発行されているかを確認できます。

```bash
docker compose up -d
docker compose logs backend | wc -l                        # 現在のログ行数を控えておく
curl -s -o /dev/null "http://localhost:8080/api/cards"      # 12件ヒットするリクエスト
docker compose logs backend | tail -n +<控えた行数> | grep -c "org.hibernate.SQL"
```

`GET /api/cards`（12件ヒット）を1回叩いたときに発行される`org.hibernate.SQL`のログは、実際に**2本**でした（本ドキュメント執筆時に実測済み）。続けて`GET /api/cards?boardId=999`（0件ヒット）を1回叩くと、こちらは**1本**でした。

| リクエスト | 発行されたSQL本数 | 内訳 |
| --- | --- | --- |
| `GET /api/cards`（12件ヒット） | 2本 | カード本体（`card` join `board`）＋ラベル一括取得（`card_label` join `label`、`IN (?,?,...,?)`で12件分をまとめて指定） |
| `GET /api/cards?boardId=999`（0件ヒット） | 1本 | カード本体のみ（該当0件のため、`toResponses`を呼ばずに早期returnし、2本目のクエリが発行されない） |

ヒット件数が12件でも0件でもクエリ本数が変わらない（あるいはむしろ減る）ことが、「N+1になっていない」ことの実証になります。

📄 `GET /api/cards/{id}`（カード1件取得）も同じ`toResponses`を経由するため、同様に2本のクエリで完結します（[20章](./06-service-controller.md#20-service層とtransactional)の`CardService`参照）。

**② あえてN+1を発生させて本数を数える**

「2本で済んでいる」ことの裏返しとして、`join fetch`を外すと実際に何が起きるのかを見てみます。`CardRepository.search`の1行だけを変更します。

```diff
-  join fetch c.board b
+  join c.board b
```

`join fetch`から`fetch`を取り除くと、`b`（board）は絞り込み・並び替えのためだけにJOINされ、**カードと一緒には取得されなくなります**。この状態で`GET /api/cards`（12件ヒット）を叩き、SQLログを数えると、次のようになりました（本プロジェクトのシードデータで実測）。

```
①  select ... from card c1_0 join board b1_0 on ... where ...   -- カード本体（boardの列は含まれない）
②  select ... from card_label cl1_0 join label l1_0 on ...      -- ラベル一括取得（変更前と同じ、1本）
③  select ... from board b1_0 where b1_0.id = ?                 -- board取得（id=1）
④  select ... from board b1_0 where b1_0.id = ?                 -- board取得（id=2）
⑤  select ... from board b1_0 where b1_0.id = ?                 -- board取得（id=3）
```

合計**5本**です。ここで注目してほしいのは、12件のカードがあるのに追加のboard取得は12本ではなく**3本**だけだった、という点です。理由は、この12件のカードが実は3つのボード（board_id=1が6件、2が4件、3が2件）に分かれていたためです。Hibernateは1つのトランザクション内で同じIDのエンティティを2度取得しようとすると、2回目以降は永続化コンテキスト（[20章](./06-service-controller.md#20-service層とtransactional)で説明したHibernateセッション内のキャッシュ）にある1回目の結果を再利用し、SQLを発行しません。そのため、実際に発行される追加のSQL本数は「カードの件数」ではなく「**カードが参照している関連先の重複を除いた件数（ここではボードの種類数）**」になります。

これは実務的に重要な補足です。「N+1」という呼び名から「N件なら+N本」と考えがちですが、正確には「**最大でN本、実際には関連先の異なり数ぶん**」になります。もし12件のカードがすべて別々のボードに属していたら（＝関連先に重複が無ければ）、素朴な計算通り1+12=13本に達していたはずです。件数が増えるほど、また関連先の種類が増えるほど、この差は深刻になります。

確認できたら、変更を必ず元に戻してください。

```bash
git checkout -- backend/src/main/java/com/tkmedia/taskmanagement/repository/CardRepository.java
git status --short   # 何も表示されなければ元通り
```

元に戻して再度`GET /api/cards`を叩くと、SQL本数は2本に戻ります。

---

## 25. `open-in-view`と遅延読み込みの境界

Spring Bootは既定で**OSIV（Open Session In View）**という設定が有効になっています。これは、Controllerがレスポンスを返し終えるまでDB接続と永続化コンテキスト（Hibernateがエンティティの状態を管理する仕組み）を保持し続ける、という挙動です。

### OSIVが有効なままだと何が起きるか

OSIVが有効だと、Service層のトランザクションを抜けたあと（＝ビジネスロジックとしては処理が終わったあと）の、JSON変換処理の最中でも、遅延読み込み（`fetch = LAZY`、[12章](./03-entity-jpa.md#12-リレーション関連の書き方)）が「こっそり」成功してしまいます。これは一見便利に思えますが、実際には次のような問題を引き起こします。

- どのタイミングで実際にSQLが発行されているのかがコードから読み取りにくくなる
- Jacksonがエンティティを辿ってJSONに変換する過程で、意図しない追加SQL（[24章](#24-n1問題とその回避)のN+1）を静かに引き起こしやすくなる

### 本プロジェクトの対応：`open-in-view=false`

```properties
spring.jpa.open-in-view=false
```

この設定を`application.properties`（全環境共通）に追加し、OSIVを無効化しています。これにより、**トランザクションの範囲＝遅延読み込みが安全に行える範囲**になります。DTOへの詰め替え（`Card.getBoard().getName()`のような、遅延プロキシへのアクセスを含む処理）は、必ず`@Transactional`のメソッド内（[20章](./06-service-controller.md#20-service層とtransactional)のService層）で完了させる、という設計上の約束を守る限り、この設定は何も問題を起こしません。

むしろメリットの方が大きく、万が一この約束を破って「トランザクションの外側で遅延プロキシに触れるコード」を書いてしまった場合、`open-in-view=false`の下では`LazyInitializationException`という**明確な例外**が発生します。OSIVが有効なままだと、同じミスがエラーにならずに動いてしまい（ただし裏で余分なSQLが発行されており）、パフォーマンス上の問題として気づかれるまで表面化しません。「バグを分かりにくい形で動かしてしまう」よりも「バグをすぐに検出できる形にする」方が、開発・保守のしやすさにつながります。

なお、`open-in-view=false`を設定していない場合、Spring Bootは起動時に次のような警告ログを出します（本プロジェクトでは設定済みのため、この警告は出ません）。

```
spring.jpa.open-in-view is enabled by default. Therefore, database queries may be
performed during view rendering. Explicitly configure spring.jpa.open-in-view to
disable this warning
```

📄 この設定と関連する`@Transactional(readOnly = true)`の解説は [20章](./06-service-controller.md#20-service層とtransactional) を参照してください。
