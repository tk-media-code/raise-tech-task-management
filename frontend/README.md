# frontend

タスク管理アプリのフロントエンド（React + TypeScript + Vite + Tailwind CSS）です。

プロジェクト全体の概要・起動方法は[ルートの README.md](../README.md) を参照してください。

## 起動

通常は Docker Compose 経由で起動します。

```bash
docker compose up -d   # リポジトリルートで実行 → http://localhost:5173
```

dev server はコンテナ内で動いており、ソースを編集すると HMR（ホットリロード）で即座に画面へ反映されます。ホストに Node.js をインストールする必要はありません。

## ディレクトリ構成

| パス | 役割 |
| --- | --- |
| `src/pages/` | URLに対応する画面コンポーネント（`App.tsx` の `<Routes>` から参照される） |
| `src/components/` | 画面をまたいで使う部品（カード・モーダル・フォームなど） |
| `src/hooks/` | カスタムフック（`useApi`・`useMutation`・ドラッグ＆ドロップなど） |
| `src/api/` | APIのパス定義と `fetch` のラッパー |
| `src/lib/` | ステータス・ラベル色・期日判定など、UIに依存しない小さなロジック |
| `src/types/` | バックエンドのDTOに対応する型定義 |
| `src/test/` | テストのセットアップ（マッチャーの追加・テストごとの後片付け） |

## テスト

[Vitest](https://vitest.dev) + [React Testing Library](https://testing-library.com/react) を使っています。テストは対象ファイルの隣に `*.test.ts` / `*.test.tsx` として置きます。

```bash
docker exec -w /workspace task-management-frontend npm test        # 1回だけ実行
docker exec -w /workspace task-management-frontend npm run test:watch  # 変更を監視して再実行
```

`scripts/quality-check.sh` にも組み込まれているため、push前チェックで自動的に実行されます。

Vitestを選んだのは、`vite.config.ts` の設定（React・Tailwindのプラグイン）をそのまま共有できるためです。テスト用の設定は同ファイルの `test` プロパティにまとめています（`environment: 'jsdom'`・`setupFiles`・`globals: false`）。

**Vitestは型を検査しません。** esbuildで型注釈を落として実行するだけなので、型エラーは `npm run build`（`tsc -b`）でしか検出できません。`quality-check.sh` がビルドをテストより先に実行しているのはこのためです。

設計判断の詳細は [docs/react/13-frontend-testing.md](../docs/react/13-frontend-testing.md) を参照してください。

## 静的解析

[oxlint](https://oxc.rs) を使っています（ESLintは導入していません）。設定は `.oxlintrc.json` です。

```bash
npx oxlint src/          # このディレクトリ単体で確認する場合
bash scripts/quality-check.sh   # 通常はこちら（リポジトリルートで実行）
```

push前には `scripts/quality-check.sh` の実行が必要です。backend/frontend 両方のチェックがこのスクリプト1本に集約されているため、個別のコマンドを直接叩くのではなくこちらを使ってください（詳細は [CONTRIBUTING.md 5章](../CONTRIBUTING.md#5-push前の品質チェック)）。

### まだ有効化していないもの

- **type-aware ルール**：`oxlint-tsgolint` を追加して `.oxlintrc.json` に `"options": { "typeAware": true }` を書くと、型情報を使った検査（未使用のPromiseの検出など）が有効になります。実行時間とのトレードオフがあるため、現時点では見送っています。
- **React Compiler**：ビルド性能への影響があるため未導入です。導入する場合は[公式ドキュメント](https://react.dev/learn/react-compiler/installation)を参照してください。

## 学習ドキュメント

実装の設計判断や、登場する概念の解説は以下にまとめています。

- [docs/react/](../docs/react/README.md) — React・React Router・Vite・Tailwind CSS の使い方と、本プロジェクトでの設計判断
- [docs/typescript/](../docs/typescript/README.md) — TypeScript言語の文法（ジェネリクス・ユニオン型・非同期処理など）
