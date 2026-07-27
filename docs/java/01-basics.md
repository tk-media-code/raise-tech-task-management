# Javaという言語の土台

[← Java学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **1〜5章** をまとめています。

---

## 1. Javaの実行の仕組み（javacとJVM）

> **Javaの実行の仕組みとは？**
> Javaのソースコード（`.java`ファイル）は、`javac`というコンパイラによって**バイトコード**（`.class`ファイル）に変換されたあと、**JVM（Java Virtual Machine）**というプログラムがそのバイトコードを読み込んで実行します。ソースコードを直接実行するPHPやJavaScriptとは異なり、実行の前に必ず「コンパイル」という変換の工程を挟む言語です。

本プロジェクトの`backend/build.gradle`（[7章](../spring-boot/02-build-config.md#7-buildgradle-の読み方)）には、Javaのバージョンを指定する記述があります。

```groovy
java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(25)
	}
}
```

これは「このプロジェクトのソースコードをJava 25の言語仕様でコンパイルし、Java 25のJVMで実行する」という指定です。普段の開発では`./gradlew bootRun`（[9章](../spring-boot/02-build-config.md#9-起動から動作確認までの流れ)）を実行すると、Gradleが裏側で「`javac`によるコンパイル → JVMでの実行」を自動的に行ってくれるため、`javac`コマンドを直接意識する場面はほとんどありません。

コンパイルという工程を挟む最大のメリットは、**プログラムを実行する前に、型に関する多くの間違いを検出できる**ことです。「メソッドに渡す引数の型が合っていない」「存在しないメソッドを呼び出している」といった誤りは、`javac`の時点でエラーになりビルド自体が失敗します。実行してからでないと誤りに気づけないPHPやJavaScriptに比べて、「動かしてみるまでわからない」バグの一部を早い段階で機械的に締め出せる点が、Javaのような静的型付け言語（[4章](#4-静的型付け変数に型を書くということ)）の大きな特徴です。

> **PHPとの対比**
> PHPも`php`コマンドで直接ソースコードを実行できる言語で、事前のコンパイルという工程を開発者が意識することはまずありません。Javaで`javac`によるコンパイルが独立した工程として存在するのは対照的です。

---

## 2. パッケージとimport

> **パッケージとは？**
> クラスを分類・整理するための名前空間です。ディレクトリ構造と対応しており、`com.tkmedia.taskmanagement.service`パッケージに属するクラスは、`src/main/java/com/tkmedia/taskmanagement/service/`ディレクトリに置かれます。

本プロジェクトの各ファイルは、先頭で必ず自身の所属パッケージを宣言しています。

```java
package com.tkmedia.taskmanagement.service;
```

他のパッケージに属するクラスを使うには、ファイル先頭で`import`を使ってそのクラスを明示します。`CardService.java`の冒頭を見ると、importの並び方に一定の秩序があることがわかります。

```java
import com.tkmedia.taskmanagement.dto.CardResponse;
import com.tkmedia.taskmanagement.dto.CardSearchCondition;
import com.tkmedia.taskmanagement.dto.LabelResponse;
import com.tkmedia.taskmanagement.entity.Card;
import com.tkmedia.taskmanagement.entity.CardLabel;
import com.tkmedia.taskmanagement.exception.ResourceNotFoundException;
import com.tkmedia.taskmanagement.repository.CardLabelRepository;
import com.tkmedia.taskmanagement.repository.CardRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
```

本プロジェクト自身のクラス（`com.tkmedia.taskmanagement.*`）→ 外部ライブラリ（`org.springframework.*`など）→ Java標準ライブラリ（`java.*`）という順に、グループごとに並んでいます。強制されたルールではなく本プロジェクトが統一している書き方ですが、「このクラスがどこから来た型に依存しているか」がimport文だけを見て追える利点があります。

### ワイルドカードimportを使わない理由

`import java.util.*;`のように末尾を`*`にすると、そのパッケージ内の全クラスを1行でimportできます（ワイルドカードimport）。本プロジェクトでは使っていません。1つ1つのクラスを個別にimportすることで、「このファイルがどの型に依存しているか」がimport文のリストだけで正確にわかり、異なるパッケージに同名のクラスが存在する場合の衝突にも気づきやすくなるためです。

> **PHPとの対比**
> PHPの`namespace`・`use`もほぼ同じ役割です。`use App\Services\BoardService;`のように書く点はJavaの`import`と対応します。Laravelでは名前空間がディレクトリ構造と対応する規約（PSR-4）になっている点も、Javaのパッケージとよく似ています。

---

## 3. クラス宣言とファイル名の対応

Javaには、`public`が付いたクラスは**1つのファイルに1つだけ**しか置けず、さらに**クラス名とファイル名を完全に一致させる**というルールがあります。

```java
public class CardService {
	// ...
}
```

`CardService`クラスは、必ず`CardService.java`というファイルに、1つだけ定義されます。このルールにより、「あるクラスがどこに定義されているか」を、クラス名からファイルパスへ機械的に変換して特定できます。本プロジェクトでも、`com.tkmedia.taskmanagement.service.CardService`というクラスは、パッケージ名がそのままディレクトリ階層になる（[2章](#2-パッケージとimport)）というルールとあわせて、`src/main/java/com/tkmedia/taskmanagement/service/CardService.java`に置かれています。

---

## 4. 静的型付け（変数に型を書くということ）

> **静的型付けとは？**
> 変数・引数・戻り値の「型」をソースコード上に明示し、コンパイル時にその型が正しく使われているかをチェックする方式です。Javaはこの方式を採用しています。

本プロジェクトのコードでは、変数を宣言するたびに必ず型を書いています。

```java
List<Card> cards = cardRepository.search(condition.boardId(), archived, keyword, filterByLabels, labelIds);
```

`List<Card> cards`の`List<Card>`が型です。`cards`という変数には今後ずっと「`Card`を要素とする`List`」しか代入できず、例えば誤って`String`を代入しようとすると、実行する前の段階（コンパイル時）でエラーになります。

> **JavaScriptとの対比**
> JavaScriptは変数の型を宣言せず、`let cards = ...;`のように書きます（動的型付け）。同じ変数に文字列を入れたり配列を入れたりすることも実行時には可能で、型の不整合は多くの場合、実行してみて初めて（テストが無ければ本番で）表面化します。Javaは型をコード上の情報として持たせることで、コンパイラが事前に多くの不整合を検出できるようにしている、という違いがあります。

> **PHPとの対比**
> PHPも基本的には動的型付け言語ですが、`function foo(int $x): string`のように引数・戻り値に型宣言を付けることもできます（Laravelのコードでもよく使われます）。ただしPHPの型宣言は主に実行時にチェックされる（実行してみるまでエラーにならない）のに対し、Javaの型チェックはコンパイル時に行われる点が異なります。

---

## 5. プリミティブ型とラッパークラス

> **プリミティブ型とラッパークラスとは？**
> Javaの数値・真偽値には、`int`・`boolean`のような**プリミティブ型**（基本型）と、`Integer`・`Boolean`のような**ラッパークラス**（プリミティブ型をオブジェクトとして扱うためのクラス）の2種類があります。プリミティブ型は常に値を持ちますが、ラッパークラスは他のクラスの変数と同じように「値が無い状態」＝`null`を取ることができます。

この違いが実際の設計判断に現れている例が`CardController`です。

```java
@GetMapping
public List<CardResponse> list(
		@RequestParam(required = false) Integer boardId,
		@RequestParam(required = false) Boolean archived,
		@RequestParam(required = false) String keyword,
		@RequestParam(required = false) List<Integer> labelIds) {
	// @RequestParam(required = false) は Integer/Boolean のラッパー型で受ける。
	// int/booleanのようなプリミティブ型だと、パラメータ未指定時に代入すべきnullが無く
	// 例外になってしまうため、ここでは必ずラッパー型を使う。
	return cardService.search(new CardSearchCondition(boardId, archived, keyword, labelIds));
}
```

`boardId`は`int`ではなく`Integer`です。クエリパラメータ`?boardId=1`が指定されなかった場合、Spring MVCは「値が無い」ことを表すために`null`を代入しようとしますが、`int`は必ず何らかの数値を持たなければならないプリミティブ型なので`null`を受け付けられません。`Integer`はオブジェクトなので`null`を保持でき、「指定されていない」という状態をそのまま表現できます。

### オートボクシングとアンボクシング

`CardService.search()`には、ラッパークラスとプリミティブ型が1行で混在する箇所があります。

```java
boolean archived = condition.archived() != null && condition.archived();
```

`condition.archived()`は`Boolean`（ラッパークラス）を返しますが、代入先の`archived`は`boolean`（プリミティブ型）です。`Boolean`を`boolean`が必要な場面でそのまま使うと、コンパイラが自動的に中身を取り出して変換してくれます。これを**オートアンボクシング**と呼びます（逆にプリミティブ型からラッパークラスへ自動変換されるのは**オートボクシング**）。ただし`condition.archived()`が`null`の状態でアンボクシングしようとすると`NullPointerException`が発生するため、このコードは`!= null`のチェックを**先に**行い、`null`のときは右側の`condition.archived()`（アンボクシングが発生する箇所）を評価させないようにしています（`&&`の短絡評価。詳しくは[25章](./06-exception-and-null.md#25-nullとnullpointerexception)）。

📄 ジェネリクスの型引数にプリミティブ型を書けないこと（`List<int>`は不可で`List<Integer>`になること）は、[04-generics-collections.md](./04-generics-collections.md)の[18章](./04-generics-collections.md#18-ジェネリクス)で扱います。
