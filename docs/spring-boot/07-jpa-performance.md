# N+1問題とパフォーマンス

[← 学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **24〜25章** をまとめています。

---

## 24. N+1問題とその回避

> **N+1問題とは？**
> 一覧（N件）を取得したあと、各要素に関連する別の情報を取得するために、要素の件数ぶん（N回）追加のSQLを発行してしまう問題です。「1回の一覧取得」＋「N回の追加取得」＝「N+1回のSQL」になることからこう呼ばれます。件数が増えるほどSQLの発行回数が線形に増え、パフォーマンスが大きく劣化します。

カード一覧API（`GET /api/cards`）は、各カードに付与されたラベルの一覧（`labels`）をレスポンスにネストします（[22章](./06-service-controller.md#22-dtoレコードでエンティティを外に出さない)）。素朴に実装すると「カードN件を取得したあと、各カードごとに`SELECT * FROM card_label WHERE card_id = ?`を発行する」という、まさにN+1のパターンに陥ります。

### 本プロジェクトの回避方針：2クエリで完結させる

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

型を分けて整理すると、この実装は2つの異なるN+1回避パターンを使い分けています。

| 関連の種類 | 回避パターン | 使用箇所 |
| --- | --- | --- |
| `@ManyToOne`（多対一。カードは必ず1つのボードに属する） | `join fetch`で最初から一緒に取得する | `CardRepository.search`の`join fetch c.board b` |
| 1対多相当（1枚のカードに複数のラベル） | 対象の主キーをまとめて`IN`句で問い合わせ、Java側でグルーピングする | `CardLabelRepository.findAllWithLabelByCardIdIn` |

### なぜ`Card`に`@OneToMany`のコレクションを追加しなかったか

「`Card`に`List<CardLabel> cardLabels`のような`@OneToMany`フィールドを追加し、それをfetch joinで取得する」という設計も考えられますが、本プロジェクトでは採用していません。理由は3つあります。

1. **エンティティを「テーブルの1行の写像」に保てる**：コレクションを持たせると、以後どのクエリでもそれをどう取得するか（LAZY/EAGER/fetch join/バッチサイズ指定）を意識し続ける必要が生じる
2. **コレクションのfetch joinには固有の罠がある**：行が重複するため`distinct`が必要になる、ページングがメモリ上での処理になってしまう、複数のコレクションを同時にfetch joinすると`MultipleBagFetchException`が発生する、といった問題を抱える
3. **クエリ本数が「必ず2本」とコードを読むだけで分かる**：`@BatchSize`や`@EntityGraph`のような「設定次第でクエリ本数が変わる」仕組みに比べ、「クエリA→クエリBの2段階」という素朴な構造の方が、学習の初期段階では追いやすい

### 実測：SQLログでの確認

開発環境ではSQLログ（[8章](./02-build-config.md#8-applicationproperties-の読み方)、`application-dev.properties`の`logging.level.org.hibernate.SQL=debug`）が有効になっており、実際に何本のSQLが発行されているかを確認できます。

`GET /api/cards`（12件ヒット）を1回、続けて`GET /api/cards?boardId=999`（0件ヒット）を1回叩いたときのログを集計すると、`org.hibernate.SQL`のログは**合計3本**でした。

| リクエスト | 発行されたSQL本数 | 内訳 |
| --- | --- | --- |
| `GET /api/cards`（12件ヒット） | 2本 | カード本体（`card` join `board`）＋ラベル一括取得（`card_label` join `label`、`IN (?,?,...,?)`で12件分をまとめて指定） |
| `GET /api/cards?boardId=999`（0件ヒット） | 1本 | カード本体のみ（該当0件のため、`toResponses`を呼ばずに早期returnし、2本目のクエリが発行されない） |

ヒット件数が12件でも0件でもクエリ本数が変わらない（あるいはむしろ減る）ことが、「N+1になっていない」ことの実証になります。仮にN+1が起きていた場合、12件ヒット時には「カード取得1本＋ラベル取得12本」の合計13本が発行されるはずです。

📄 `GET /api/cards/{id}`（カード1件取得）も同じ`toResponses`を経由するため、同様に2本のクエリで完結します（[20章](./06-service-controller.md#20-service層とtransactional)の`CardService`参照）。

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
