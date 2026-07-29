# クラスとモジュール

[← TypeScript学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **11〜12章** をまとめています。

---

## 11. クラスと継承

> **クラスと継承とは？**
> TypeScript（JavaScript）のクラス構文は、[docs/java 6章](../java/02-class-and-object.md#6-クラスの構成要素)のJavaのクラスと見た目・役割ともによく似ています。フィールド・コンストラクタ・メソッドを持ち、`extends`で既存のクラスを拡張できます。

本プロジェクトでクラスが使われているのは`api/client.ts`の`ApiError`のみです。

```typescript
export class ApiError extends Error {
  readonly status: number | null
  readonly problem: ProblemDetail | null

  constructor(message: string, status: number | null, problem: ProblemDetail | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}
```

- `extends Error`：JavaScript標準の`Error`クラスを継承しています。`Error`は`message`プロパティとスタックトレースを持つ、例外を表す組み込みクラスです。
- `super(message)`：親クラス（`Error`）のコンストラクタを呼び出しています。[docs/java 12章](../java/03-type-system.md#12-継承extends)の`super(...)`とまったく同じ役割で、**必ず自分のコンストラクタ処理より先に**呼ぶ必要があります。
- `this.name = 'ApiError'`：`Error`のコンストラクタは`name`プロパティを既定で`'Error'`に設定します。コメントにあるとおり「console上でひと目で識別できるよう上書きする」ためにここで変更しています。
- `readonly status` / `readonly problem`：[docs/typescript 8章](./03-generics.md#8-recordとreadonlyとas-const)で扱った`readonly`フィールドです。コンストラクタで受け取った値をそのまま保持し、以後変更しません。

### なぜ素の`Error`を投げないのか

`fetchJson`は通信失敗時に`throw new Error(...)`ではなく`throw new ApiError(...)`をしています。理由はコード冒頭のコメントに書かれています。

```typescript
/**
 * APIがエラー応答を返したこと、あるいはAPIに到達できなかったことを表す例外。
 * 素のErrorではなく専用クラスにしておくと、呼び出し側が `err instanceof ApiError` で
 * 「APIのエラー」と「コードのバグ（TypeErrorなど）」を区別できる。
 */
```

`extends Error`をしているため、`ApiError`のインスタンスは`instanceof Error`にも`instanceof ApiError`にも合致します（[docs/typescript 9章](./04-narrowing.md#9-型ガードと絞り込み)の絞り込みがそのまま使えます）。仮にただの`{ message: '...', status: 500 }`のようなオブジェクトを投げていた場合、`throw`・`catch`の型は`unknown`になり、`instanceof`による絞り込みができず、`message`にアクセスするだけでも型アサーション（[10章](./04-narrowing.md#10-型アサーションassatisfies)）が必要になっていました。組み込みの`Error`を継承しておくことで、標準的な例外の扱い方に乗ったまま、独自の情報（`status`・`problem`）を追加できています。

> **Javaとの対比**
> `ResourceNotFoundException`が`RuntimeException`を継承する例（[docs/java 12章](../java/03-type-system.md#12-継承extends)）と、設計思想がそのまま対応しています。「言語が用意した例外の基底クラスを継承し、独自のフィールドを追加する」という考え方は、JavaでもTypeScriptでも共通です。

---

## 12. モジュールと`import type`

> **モジュールとは？**
> 1つのファイルを、他のファイルから`import`して使える単位にする仕組みです。TypeScript（JavaScript）では、ファイル単位が自動的にモジュールになります（Javaのように`package`宣言を書く必要はありません）。

本プロジェクトのほぼすべてのファイルは、先頭に`import`文を持っています。`components/CardItem.tsx`を見てください。

```typescript
import type { CardResponse } from '../types/api'
import DueDateBadge from './DueDateBadge'
import LabelChip from './LabelChip'
```

> **Javaとの対比**
> [docs/java 2章](../java/01-basics.md#2-パッケージとimport)のパッケージ・importと役割は同じですが、対応関係が違います。Javaは「パッケージ名」というディレクトリ構造に対応する名前空間を`import`しますが、TypeScript（JavaScript）は**ファイルパス**を直接`import`します（`'../types/api'`は`types/api.ts`を指す相対パスです）。パッケージという概念そのものが無く、ファイルシステム上の位置がそのままモジュールの識別子になります。

### `import type`：型だけをインポートする

`import type { CardResponse } from '../types/api'`の`type`キーワードに注目してください。これは「`CardResponse`は型情報としてのみ使い、実行時の値としては使わない」という宣言です。`tsconfig.app.json`の`"verbatimModuleSyntax": true`という設定が、この書き分けを要求しています。

型（`type`エイリアス・`interface`）は[docs/typescript 1章](./01-basics.md#1-typescriptとは)で説明したとおり実行時には消去され、コンパイル後のJavaScriptには存在しません。`verbatimModuleSyntax`が無い状態だと、TypeScriptは「このimportが型だけなのか、実際の値（関数・クラスなど）も含むのか」を自動判定し、型だけのimportを黙って削除してくれます。しかしその自動判定に頼らず、**開発者自身が`import type`と明示することを強制する**のが`verbatimModuleSyntax`の狙いです。これにより、「このファイルは何を実行時に必要としているか」がimport文を見ただけで正確にわかるようになります。

同じファイル内で値と型を両方importする場合は、次のように書き分けます（`components/BoardSelect.tsx`）。

```typescript
import type { ChangeEvent } from 'react'
import { useMatch, useNavigate } from 'react-router'
```

`ChangeEvent`は型（イベントオブジェクトの形を表すだけ）なので`import type`、`useMatch`・`useNavigate`は実行時に呼び出す関数なので通常の`import`です。

### `export default`と名前付き`export`の使い分け

本プロジェクトのファイルを見渡すと、exportの書き方に一貫したパターンがあります。

```typescript
// components/CardItem.tsx（コンポーネント）
export default CardItem
```

```typescript
// lib/status.ts（関数・定数）
export const STATUSES: readonly CardStatus[] = ['todo', 'doing', 'done']
export function isCardStatus(value: string): value is CardStatus { /* ... */ }
```

**画面に描画するコンポーネント（`.tsx`ファイル）は`export default`、それ以外（型・定数・関数・フック）は名前付き`export`**という使い分けが、本プロジェクト全体で徹底されています。

- `export default`は1つのファイルにつき1つだけ許される特別なexportで、importする側は`import CardItem from './CardItem'`のように**任意の名前**を付けられます（実際のファイル名`CardItem.tsx`と一致させる運用で統一されています）。
- 名前付き`export`は1つのファイルから複数exportでき、importする側は`import { STATUSES, isCardStatus } from '../lib/status'`のように**宣言時と同じ名前**でしかimportできません。

コンポーネントに`export default`を使うのは、Reactのコミュニティで広く定着した慣習です。一方、`lib/status.ts`のように1ファイルから複数の関数・定数をexportする場面では、`default`にできるものが1つしか無いため名前付き`export`が自然に選ばれます。`hooks/useApi.ts`が`UseApiResult`型と`useApi`関数の両方を名前付きでexportしているのも同じ理由です。
