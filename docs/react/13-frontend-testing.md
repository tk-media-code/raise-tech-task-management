# フロントエンドの自動テスト（Vitest・Testing Library）

[← React学習ドキュメントトップへ戻る](./README.md)

> 元の学習ドキュメントにおける **35章** をまとめています。

---

## 35. フロントエンドの自動テスト：壊れても気づけない場所を守る

### 何をテストしたいのか

[docs/spring-boot 44章](../spring-boot/12-testing.md#44-自動テスト業務ルールをコードで守る)でbackendにテストを入れたのと同じ動機が、frontendにもあります。ただし守りたい対象は違います。backendが「業務ルール」だったのに対し、frontendで壊れても気づきにくいのは**状態遷移とタイミング**です。

- `useApi`：ボードを素早く切り替えたとき、古いリクエストの結果が新しい表示を上書きしないか（[11章](./04-custom-hooks.md#11-データ取得の3状態とレースコンディション)）
- `useDebouncedValue`：打鍵の途中の値が、一度もAPIへ飛んでいないか（[14章](./05-router.md#14-urlを状態の置き場所にする)）
- `CardCreateForm`：タイトルが空白だけのとき、追加ボタンが無効になっているか（要件5.2の受け入れ条件）

どれも「動かしてみれば正しく見えてしまう」種類のもので、目視での確認が難しい部類です。

### Vitestを選んだ理由

テストランナーにはVitestを採用しました。**Viteの設定をそのまま共有できる**のが決め手です。

```typescript
// vite.config.ts
import { defineConfig } from 'vitest/config'   // 'vite' ではなくこちらから取り込む

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { /* ... */ },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
  },
})
```

`defineConfig`を`vitest/config`から取り込むと、Viteの設定オブジェクトに`test`プロパティが型付きで足せます。プラグイン（React・Tailwind）やエイリアスの設定を二重に書く必要がありません。

| 設定 | 意味 |
| --- | --- |
| `environment: 'jsdom'` | 既定ではNode環境で動くため`document`も`window`も存在しない。jsdom（JavaScriptで実装されたブラウザ相当のDOM）を使うことで、コンポーネントを実際に描画できる |
| `setupFiles` | 各テストファイルの実行前に読み込むファイル。マッチャーの追加と後片付けをここで行う |
| `globals: false` | `describe`・`it`・`expect`をグローバルにせず、各テストで明示的に`import`する。どこから来た関数かがファイル単体で追える |

`globals: false`にした副作用として、Testing Libraryの自動`cleanup`が働かなくなるため、セットアップで明示的に呼びます。

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
```

これを忘れると、前のテストで描画したDOMが次のテストにも残り、`getByRole`が「同じ要素が複数見つかる」というエラーになります。

### フックだけを取り出してテストする——`renderHook`

カスタムフックはコンポーネントの中でしか呼べません（[9章](./03-state-effect.md#9-フックのルール)）。Testing Libraryの`renderHook`は、そのためだけの小さなコンポーネントを内部で作り、フックの戻り値を`result.current`から観察できるようにしてくれます。

```typescript
const { result, rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, 300), {
  initialProps: { value: '見' },
})

rerender({ value: '見積' })      // propsを変えて再描画
expect(result.current).toBe('見')  // 戻り値を観察
unmount()                          // クリーンアップを走らせる
```

### 時間を進める——偽のタイマー

`useDebouncedValue`は「300ms待つ」フックです。実時間を待つとテスト1件に300msかかり、しかも不安定になります。Vitestの偽のタイマーを使えば、テスト側から時間を進められます。

```typescript
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })   // 戻し忘れると後続のテストにまで影響する

act(() => {
  vi.advanceTimersByTime(300)   // 300ms経過したことにする
})
```

`act(...)`で囲むのは、この中で起きる状態更新をReactに「まとめて処理してよい区切り」として伝えるためです。囲まないと、更新が反映される前にアサーションが走ってしまいます。

### モックの境界をどこに置くか

テストのたびに本物のAPIを叩くわけにはいきません。どこを偽物に差し替えるかという判断が要ります。本プロジェクトでは**`api/client`の通信関数**を境界にしました。

```typescript
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,          // apiPaths や ApiError は本物のまま使う
    fetchJson: vi.fn(), // 通信する関数だけを偽物に
    postJson: vi.fn(),
  }
})
```

`importOriginal`で本物のモジュールを取り込んでから一部だけ上書きしているのがポイントです。`apiPaths`（URLの組み立て）や`ApiError`（`instanceof`判定に使われる）まで偽物にすると、テスト対象のロジックそのものが動かなくなります。**差し替えるのは「外の世界と話す部分」だけ**、という線引きです。

`globalThis.fetch`を差し替える方法もありますが、そうすると`api/client`のステータス判定やエラー変換までテストの前提に巻き込まれます。フックの状態遷移を見たいときには境界が遠すぎます。

### コンポーネントは「ユーザーに見える形」で探す

React Testing Libraryは、要素を**画面上の見え方**で探すことを勧めています。

```typescript
// 推奨：ユーザーが認識するのと同じ手がかりで探す
screen.getByRole('button', { name: '追加' })
screen.getByLabelText('カードのタイトル')

// 非推奨：実装の詳細に依存する
container.querySelector('.bg-blue-600')
```

クラス名で探すと、Tailwindのクラスを1つ変えただけでテストが壊れます。一方`getByRole('button', { name: '追加' })`は「追加と書かれたボタン」を探すので、見た目を変えても壊れません。**壊れてほしいのは振る舞いが変わったときだけ**という、テストの基本方針がここに現れています。

副次的な効果として、この書き方はアクセシビリティの検査も兼ねます。`getByLabelText`で見つからないということは、その入力欄にラベルが結び付いていない＝スクリーンリーダーからも辿れない、ということだからです。

操作の再現には`userEvent`を使います。

```typescript
const user = userEvent.setup()
await user.click(screen.getByRole('button', { name: '＋ カードを追加' }))
await user.type(screen.getByLabelText('カードのタイトル'), '打合せ資料')
```

`fireEvent.change(input, { target: { value: 'x' } })`という低レベルなAPIもありますが、`userEvent`は「クリックの前にポインタが移動し、フォーカスが当たり、キーが1つずつ押される」という実際の操作に近い一連のイベントを発生させます。`disabled`なボタンをクリックしようとすると何も起きない、といった挙動も再現されます。

### テストが「飾り」でないことを確かめる——実際に不十分だった話

[44章](../spring-boot/12-testing.md#44-自動テスト業務ルールをコードで守る)と同じく、書いたテストが本当に守っているかを、**実装をわざと壊して**確かめました。3箇所を壊してみます。

1. `CardCreateForm`の`disabled={title.trim() === '' || submitting}`から`trim()`判定を外す
2. `useDebouncedValue`のクリーンアップから`clearTimeout(timer)`を外す
3. `useApi`の`catch`から中断チェック（`if (controller.signal.aborted) return`）を外す

結果、1と3は検出されましたが、**2は5件すべて緑のまま通ってしまいました**。

原因は、テストが観察するタイミングにありました。当初のテストはこう書かれていました。

```typescript
rerender({ value: '見積' })              // t=0    タイマーAが t=300 に発火予定
act(() => vi.advanceTimersByTime(100))   // t=100
rerender({ value: '見積書' })            // t=100  タイマーBが t=400 に発火予定
act(() => vi.advanceTimersByTime(100))   // t=200
expect(result.current).toBe('見')        // ← t=200 ではA・Bどちらも未発火
act(() => vi.advanceTimersByTime(300))   // t=500  A・B両方が発火
expect(result.current).toBe('見積書')    // ← 後に発火したBの値なので、壊れていても通る
```

`clearTimeout`が無くてもタイマーAは`t=300`まで発火せず、最終的にはBが後から上書きするため、**両端だけを見ていると差が出ない**のです。中間の`t=300`〜`t=400`を観察して初めて違いが現れます。

```typescript
// 修正後：破棄されたはずのタイマーAの発火予定時刻（t=300）を超えた地点で確認する
act(() => vi.advanceTimersByTime(250))   // t=350
expect(result.current).toBe('見')        // clearTimeoutが無ければ、ここで「見積」になる
```

もう1件、「アンマウント後にタイマーが発火しても状態は更新されない」というテストも同じ理由で無力でした。アンマウント済みのフックの`result.current`はそもそも更新されないため、タイマーが残っていても検出できません。こちらは観察対象を変えて解決しました。

```typescript
expect(vi.getTimerCount()).toBe(1)   // rerender直後は発火待ちが1本
unmount()
expect(vi.getTimerCount()).toBe(0)   // クリーンアップで消えていること
```

**「テストが通ること」と「テストが守っていること」は別物**です。壊して確かめる手順を踏まなければ、この2件は「書いたつもり」のまま残っていました。テストを追加したときは一度やっておく価値があります。

### push前チェックへの組み込み

`scripts/quality-check.sh`にテストの実行を追加しました。

```bash
run_check "frontend (npm run build)" "docker exec ... npm run build"
run_check "frontend (npm test)"      "docker exec ... npm test"
```

ビルド（`tsc -b`）を先に置いているのは、**Vitestが型を検査しない**ためです。esbuildで型注釈を落として実行するだけなので、型エラーは`tsc -b`でしか検出できません。先に走らせた方が原因に早く辿り着けます。

### 残っている課題

- **`CardDetailModal`のテストが無い**：このプロジェクトで最も複雑なコンポーネント（下書きと保存の分離、PUT→PATCHの連鎖）ですが、まだ手が付いていません。かつてここには「jsdomが`showModal()`を実装していないという壁がある」と書いていましたが、[38章](./12-dialog-accessibility.md#38-共通の確認ダイアログwindowconfirmをやめてネイティブdialogに寄せる)で`src/test/setup.ts`に代替実装を置いたため、`<dialog>`を描画するコンポーネントはテストできるようになっています（`ConfirmDialog`・`ArchivedCardItem`・`SortableBoardRow`が実例）。ただしその代替で再現できるのは開閉だけで、トップレイヤー・フォーカストラップ・背景の不活性化・Escapeによる`cancel`イベント・`::backdrop`はブラウザでの手動確認に委ねる、という線引きは残ります
- **E2Eテストは無い**：ドラッグ＆ドロップ（[23〜28章](./09-editing-and-drag-and-drop.md)）のように、複数の要素の位置関係とポインタ操作が絡む機能は、jsdomでは十分に再現できません。実機に近い環境で動かすPlaywright等の導入が必要な領域です
- **CIには組み込んでいない**：backendと同じく、テストの実行はpush前のローカルチェックに委ねています

---

[← React学習ドキュメントトップへ戻る](./README.md)
