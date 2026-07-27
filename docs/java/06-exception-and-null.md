# 例外とnull

[← Java学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **24〜25章** をまとめています。

---

## 24. 例外の仕組み

> **例外とは？**
> プログラムの実行中に発生した異常events（想定外の入力、存在しないリソースへのアクセスなど）を、通常の戻り値とは別の経路で呼び出し元に伝える仕組みです。`throw`で例外を投げると、それを受け止める`catch`（または本プロジェクトのように専用のハンドラ）が見つかるまで、途中のメソッド呼び出しをすべて遡って処理が中断されます。

Javaの例外には、**検査例外**（checked exception）と**非検査例外**（unchecked exception）の2種類があります。本プロジェクトの独自例外クラスには、この違いがそのままコメントとして書かれています。

```java
// RuntimeException（非検査例外）を継承しているのは、呼び出し元のControllerに
// throws宣言やtry-catchを強制せずに済ませるため。Serviceで投げたこの例外は
// Controllerを素通りして @RestControllerAdvice（GlobalExceptionHandler）まで届く。
public class ResourceNotFoundException extends RuntimeException {

	public ResourceNotFoundException(String message) {
		super(message);
	}
}
```

| 種類 | 継承元 | コンパイラの扱い |
| --- | --- | --- |
| 検査例外 | `Exception`（`RuntimeException`を除く） | このメソッドを呼び出す側は、`try`/`catch`で捕まえるか、自分自身の`throws`宣言に含めるかのどちらかを**コンパイラに強制される** |
| 非検査例外 | `RuntimeException` | 呼び出す側に何の強制もない。`try`/`catch`を書かなくてもコンパイルは通る |

`ResourceNotFoundException`が`RuntimeException`（非検査例外）を継承しているのは、「ボードが見つからない」という事態が起きるたびに、呼び出し元の`Controller`すべてに`try`/`catch`や`throws`宣言を書かせたくないからです。実際に例外を投げている箇所は、本プロジェクト全体で次の1箇所だけです。

```java
if (!boardRepository.existsById(boardId)) {
	throw new ResourceNotFoundException("ボードが見つかりません（id=" + boardId + "）");
}
```

`throw`されたこの例外は、`BoardService`のメソッドを中断させ、それを呼び出した`BoardController`も素通りして、`GlobalExceptionHandler`（[23章](../spring-boot/06-service-controller.md#23-例外処理とrestcontrolleradvice)）まで届きます。

### `try`/`catch`が1つも無い理由

本プロジェクトのソースコードには、`try`・`catch`・`finally`のいずれも1つも登場しません。これは書き忘れではなく、意図的な設計です。非検査例外として投げているため、途中のController層で個別に受け止める**義務が無く**、代わりに`@RestControllerAdvice`が付いた`GlobalExceptionHandler`にすべての`ResourceNotFoundException`の処理を一元化しています。「各所に散らばった`try`/`catch`」ではなく「1箇所に集約されたハンドラ」という設計判断そのものは、Spring Bootの機能（[23章](../spring-boot/06-service-controller.md#23-例外処理とrestcontrolleradvice)）に依るところが大きいため、詳しくはそちらを参照してください。ここでは「非検査例外は`try`/`catch`を書かなくてもコンパイルが通る」という言語仕様のレベルの理由を押さえておいてください。

---

## 25. nullと`NullPointerException`

> **`NullPointerException`とは？**
> `null`（値が存在しないことを表す特別な値）に対して、メソッド呼び出しやフィールドアクセスをしようとしたときに発生する実行時例外です。頻出することから、Java開発者の間ではしばしば「NPE」と略されます。

`CardService.search()`の冒頭には、`null`に対する防御的なチェックが3つ並んでいます。

```java
// keyword: 空文字・空白のみの指定は「絞り込み条件なし」として扱う
String keyword = (condition.keyword() == null || condition.keyword().isBlank())
		? null
		: condition.keyword().trim();
// archived: 未指定(null)は「非アーカイブのみを対象にする」という仕様上の既定値に倒す。
boolean archived = condition.archived() != null && condition.archived();
// labelIds: 未指定または空リストなら絞り込みを行わない。
boolean filterByLabels = condition.labelIds() != null && !condition.labelIds().isEmpty();
```

1行目の三項演算子（[28章](./07-syntax-reference.md#28-演算子の要点)）では、`condition.keyword() == null`を**先に**チェックしています。仮にこの順序を逆にして`condition.keyword().isBlank() || condition.keyword() == null`のように書いてしまうと、`keyword`が実際に`null`だった場合に`condition.keyword().isBlank()`（`null`に対する`isBlank()`呼び出し）で`NullPointerException`が発生してしまいます。

### 短絡評価（short-circuit evaluation）

2行目・3行目の`&&`にも同じ考え方が使われています。

```java
boolean archived = condition.archived() != null && condition.archived();
```

`&&`は左辺から評価し、**左辺が`false`であることが確定した時点で、右辺を評価せずに`false`を返します**。`condition.archived()`が`null`であれば、左辺の`!= null`は`false`になり、右辺の`condition.archived()`（[5章](./01-basics.md#5-プリミティブ型とラッパークラス)で見たオートアンボクシングが発生する箇所）は評価されないまま処理が終わります。もし右辺が先に評価されてしまうと、`null`を`boolean`にアンボクシングしようとして`NullPointerException`になります。`!= null`のチェックを`&&`の左に置くことで、「`null`でないことが確認できた場合のみ、右辺で安全に中身を使う」というnullガードのパターンが成立しています（`||`にも同様の短絡評価があり、左辺が`true`ならば右辺は評価されません）。

> **JavaScriptとの対比**
> JavaScriptには`condition?.keyword`（Optional Chaining）や`value ?? デフォルト値`（Nullish Coalescing）のように、`null`／`undefined`を安全に扱うための専用の演算子があります。Javaの言語仕様にはこれに相当する演算子が無く、本プロジェクトのように`!= null`による明示的なチェックと`&&`/`||`の短絡評価を組み合わせて同じ効果を得るか、[20章](./04-generics-collections.md#20-optional)の`Optional`を使うことになります。
