# TypeScript言語 学習ドキュメント

> このドキュメントは、本プロジェクトのフロントエンド（React + TypeScript）のコードを読み解けるようになるための、TypeScript**言語**そのものの学習ノートです。
> Reactというライブラリの使い方は[docs/react/](../react/README.md)で扱っており、こちらはその土台となるTypeScript言語自体の文法・型システムを対象にします。TypeScriptはJavaScriptに型を追加した言語（スーパーセット）のため、本プロジェクトの実装理解に必要な範囲では、TypeScript固有の機能だけでなくJavaScript自体の構文・ブラウザAPIも扱います。
> あくまで**本プロジェクトの実装を理解するために必要な範囲**に絞っており、実装に登場しない言語機能は扱いません。
> Java・Spring Bootを本プロジェクトで並行学習中の方を読者として想定し（[docs/java/](../java/README.md)を読了済みの前提）、随所でJavaとの対比を添えています。HTML/CSS/JavaScriptの基礎知識、PHP（Laravelアプリのフロントエンド保守）の経験も前提とします。

### 本書の構成

[docs/java/](../java/README.md)と同じく、全体像をつかむための**ハブ（このファイル）**と、章ごとの詳細をまとめた**詳細ファイル**（このディレクトリ内）に分かれています。

- このファイルには、各章の**見出しと概要**のみを載せています。まずはここを上から読めば全体像がつかめます。
- 詳しい解説（コード引用・対比言語との比較）が必要なときは、各章末尾の「📄 詳細」リンクから詳細ファイルを開いてください。
- 章番号は[docs/java/](../java/README.md)・[docs/react/](../react/README.md)とは別に、このドキュメント内で1から振り直しています。

**ファイル構成**

| 章 | 内容 | 詳細ファイル |
| --- | --- | --- |
| 1〜2章 | TypeScriptという言語の土台（型消去・型注釈と型推論） | [01-basics.md](./01-basics.md) |
| 3〜6章 | オブジェクトの型とnull安全性（`type`・`interface`・ユニオン型・`strictNullChecks`） | [02-object-types.md](./02-object-types.md) |
| 7〜8章 | ジェネリクスとユーティリティ型 | [03-generics.md](./03-generics.md) |
| 9〜10章 | 型の絞り込みとアサーション | [04-narrowing.md](./04-narrowing.md) |
| 11〜12章 | クラスとモジュール | [05-class-module.md](./05-class-module.md) |
| 13〜14章 | 非同期処理（`Promise`・`fetch`・`AbortController`） | [06-async.md](./06-async.md) |

## 目次

1. [TypeScriptとは](./01-basics.md#1-typescriptとは)
2. [型注釈と型推論](./01-basics.md#2-型注釈と型推論)
3. [オブジェクトの型（`type`エイリアス）](./02-object-types.md#3-オブジェクトの型typeエイリアス)
4. [`interface`と宣言のマージ](./02-object-types.md#4-interfaceと宣言のマージ)
5. [ユニオン型とリテラル型](./02-object-types.md#5-ユニオン型とリテラル型)
6. [`null`・`undefined`と`strictNullChecks`](./02-object-types.md#6-nullundefinedとstrictnullchecks)
7. [ジェネリクス](./03-generics.md#7-ジェネリクス)
8. [`Record`と`readonly`と`as const`](./03-generics.md#8-recordとreadonlyとas-const)
9. [型ガードと絞り込み](./04-narrowing.md#9-型ガードと絞り込み)
10. [型アサーション（`as`・`!`・`satisfies`）](./04-narrowing.md#10-型アサーションassatisfies)
11. [クラスと継承](./05-class-module.md#11-クラスと継承)
12. [モジュールと`import type`](./05-class-module.md#12-モジュールとimport-type)
13. [`Promise`と`async`・`await`](./06-async.md#13-promiseとasyncawait)
14. [`fetch`と`AbortController`](./06-async.md#14-fetchとabortcontroller)

---

## 1. TypeScriptとは

JavaScriptに静的型付けを追加した言語で、型注釈は最終的に取り除かれ、ただのJavaScriptとして実行されます。`package.json`の`tsc -b && vite build`が「型チェック」と「型を消してバンドルする」処理に分かれている理由と、`erasableSyntaxOnly`設定の意図を解説します。

📄 詳細：[01-basics.md](./01-basics.md#1-typescriptとは)

---

## 2. 型注釈と型推論

型を明示する「型注釈」と、初期値から自動的に型が決まる「型推論」の使い分けを、`lib/color.ts`を教材に解説します。Javaがローカル変数にも型を書き切るスタイルなのに対し、TypeScriptは関数の境界にだけ注釈し内部は推論に任せるという、密度の違いを扱います。

📄 詳細：[01-basics.md](./01-basics.md#2-型注釈と型推論)

---

## 3. オブジェクトの型（`type`エイリアス）

`types/api.ts`を教材に、オブジェクトの形に名前を付ける`type`エイリアスを解説します。Javaの名前的型付け（`implements`が必須）とは異なる、TypeScriptの構造的部分型（形が合っていれば型が合う）という最大の違いを扱います。

📄 詳細：[02-object-types.md](./02-object-types.md#3-オブジェクトの型typeエイリアス)

---

## 4. `interface`と宣言のマージ

本プロジェクトで唯一`interface`が使われている`vite-env.d.ts`を教材に、`type`との使い分けと、既存の型を拡張できる宣言のマージという固有機能を解説します。

📄 詳細：[02-object-types.md](./02-object-types.md#4-interfaceと宣言のマージ)

---

## 5. ユニオン型とリテラル型

`CardStatus`（`'todo' | 'doing' | 'done'`）を教材に、文字列リテラルの合併でJavaの`enum`に近い安全性を実現する仕組みと、`T | null`という頻出パターンを解説します。

📄 詳細：[02-object-types.md](./02-object-types.md#5-ユニオン型とリテラル型)

---

## 6. `null`・`undefined`と`strictNullChecks`

`tsconfig.app.json`の`strict: true`が前提にしている`strictNullChecks`と、`??`（Nullish合体演算子）・`?.`（オプショナルチェーン）というnull安全な構文を解説します。

📄 詳細：[02-object-types.md](./02-object-types.md#6-nullundefinedとstrictnullchecks)

---

## 7. ジェネリクス

`fetchJson<T>`・`useApi<T>`を教材に、型そのものを引数として受け取るジェネリクスの仕組みを解説します。Javaの`List<Card>`と同じ考え方が、API通信の型安全性をどう支えているかを扱います。

📄 詳細：[03-generics.md](./03-generics.md#7-ジェネリクス)

---

## 8. `Record`と`readonly`と`as const`

`Record<CardStatus, string>`によるキーの網羅性チェック、`readonly`による再代入・ミューテーションの禁止、`as const`によるリテラル型としての固定を、`lib/status.ts`・`lib/grouping.ts`・`DueDateBadge.tsx`を教材に解説します。

📄 詳細：[03-generics.md](./03-generics.md#8-recordとreadonlyとas-const)

---

## 9. 型ガードと絞り込み

`if (card.dueDate !== null)`のような条件分岐が型を狭める「絞り込み」の仕組みと、`isCardStatus`のような自作の型ガード関数（`value is CardStatus`）を解説します。Javaの`instanceof`パターンマッチングとの対比も扱います。

📄 詳細：[04-narrowing.md](./04-narrowing.md#9-型ガードと絞り込み)

---

## 10. 型アサーション（`as`・`!`・`satisfies`）

`api/client.ts`の`as T`が持つ「実行時には検証されない」という最重要の注意点、`main.tsx`の`!`（非null断定）、`satisfies`が`as`と違い実際に型を検査する仕組みを解説します。

📄 詳細：[04-narrowing.md](./04-narrowing.md#10-型アサーションassatisfies)

---

## 11. クラスと継承

`ApiError`が`Error`を継承する実装を教材に、TypeScriptのクラス構文とJavaのクラスの類似点、そして`readonly`フィールドが実行時には強制されない（型消去の対象になる）という違いを解説します。

📄 詳細：[05-class-module.md](./05-class-module.md#11-クラスと継承)

---

## 12. モジュールと`import type`

ファイルパスをそのままimportするTypeScriptのモジュールの仕組みと、`verbatimModuleSyntax`が要求する`import type`の書き分け、コンポーネントは`export default`・それ以外は名前付き`export`という本プロジェクトの一貫した使い分けを解説します。

📄 詳細：[05-class-module.md](./05-class-module.md#12-モジュールとimport-type)

---

## 13. `Promise`と`async`・`await`

`readProblemDetail`の`async`/`await`と、`useApi`の`.then`/`.catch`/`.finally`チェーンという2つの書き方が使い分けられている理由（`useEffect`は`Promise`を返せない制約）、`Promise.all`による並列待機を解説します。

📄 詳細：[06-async.md](./06-async.md#13-promiseとasyncawait)

---

## 14. `fetch`と`AbortController`

`fetch`が404・500でも失敗（reject）しないという最大の落とし穴と、`response.ok`による手動チェック、進行中の通信を中断する`AbortController`・`AbortSignal`を解説します。

📄 詳細：[06-async.md](./06-async.md#14-fetchとabortcontroller)

---

## 付録：このドキュメントで扱っていないTypeScriptの機能

TypeScriptの入門書には載っているのに、本プロジェクトのコードには一度も登場しない機能があります。「知らないのは自分だけでは」と迷わないよう、意図的に扱っていない機能と、その理由をまとめておきます。

| 機能 | 本プロジェクトに登場しない理由 |
| --- | --- |
| `enum` | `erasableSyntaxOnly`（[1章](#1-typescriptとは)）により意図的に使用を禁止。ステータスはリテラル型のユニオンで表現（[5章](#5-ユニオン型とリテラル型)） |
| `namespace` | 同上（[1章](#1-typescriptとは)）。モジュールの分割はファイル単位の`import`/`export`（[12章](#12-モジュールとimport-type)）で行う |
| コンストラクタのパラメータプロパティ（`constructor(private x: string)`） | 同上（[1章](#1-typescriptとは)）。`ApiError`はフィールド宣言とコンストラクタ内の代入を分けて書いている（[11章](#11-クラスと継承)） |
| `private`・`protected`修飾子 | `ApiError`のフィールドは意図的に公開（`readonly`のみ）。アクセス制御が必要な設計はまだ登場していない |
| 関数のオーバーロード宣言 | 引数の型による分岐が必要な場面はまだなく、必要になってもユニオン型（[5章](#5-ユニオン型とリテラル型)）で足りている |
| `Partial`・`Pick`・`Omit`などのユーティリティ型 | `Record`（[8章](#8-recordとreadonlyとas-const)）のみで現状のニーズを満たしている |
| 判別可能なユニオン（discriminated union） | 現状のユニオン型はリテラル1種類のみの単純な形（[5章](#5-ユニオン型とリテラル型)）。複数のプロパティを持つバリアントを`type`や`status`フィールドで判別する場面はまだ登場していない |
| デコレータ（`@`構文） | Angular等で使われる機能で、本プロジェクトが採用するライブラリ（React・Vite）は使用しない |

これらの機能は、Write系API（POST/PUT/DELETE）の実装が進むにつれて登場する可能性があります（例：エラー応答の種類が増えれば判別可能なユニオンが有用になります）。実装に登場した時点で、下記の更新ルールに従ってこのドキュメント群に章を追加してください。

## このドキュメントの更新ルール

- 開発を進める中で新しいTypeScriptの言語機能（例：`enum`、判別可能なユニオン、`Partial`などのユーティリティ型、デコレータなど）が登場したら、**都度このドキュメント群を更新すること**を本プロジェクトのルールとします。
- 既存ファイルへの追記で収まる内容はそのファイルに追記し、独立したまとまりを持つ新しいトピックは`07-xxx.md`のように連番でファイルを追加してください。章番号もこのREADMEの続き（15章、16章…）として振ってください。
- 新しいファイルを追加した場合は、このREADMEの「ファイル構成」表と「目次」の両方を更新し、ハブと詳細ファイルの対応が常に成立している状態を保ってください。
- Reactというライブラリの機能（フックの挙動など）は[docs/react/](../react/README.md)側の更新ルールに従い、そちらに追記してください。両方にまたがる概念（例：ジェネリクスをカスタムフックの型引数として使う設計判断）は、言語機能としての説明をこちら、使い所の説明をReact側に置き、相互リンクしてください。

---

*本ドキュメントは開発と並行して育てていく学習ノートです。実装で分からないTypeScriptの構文が出てきたら、まずここに解説がないか確認し、無ければ追記してください。*
