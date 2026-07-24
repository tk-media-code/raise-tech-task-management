# CLAUDE.md

このファイルは、Claude Code がこのリポジトリで作業する際のガイドです。

## プロジェクト概要

個人利用向けのタスク管理アプリ（Trelloライクなボード管理）。詳細は [docs/requirements.md](./docs/requirements.md) を参照してください。

- フロントエンド: React + TypeScript
- バックエンド: Java + Spring Boot
- データベース: PostgreSQL

## 開発フロー（必読）

このプロジェクトでは、Issue駆動の開発フローを厳守してください。詳細な手順・コマンド例は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照。

1. **開発に着手する前に、必ずIssueを立てる。** ユーザーから実装依頼を受けたら、着手前にIssueがあるか確認し、なければ先に `gh issue create` で作成する
2. **Issue番号を含むブランチを作成する。** 形式は `feature/<issue番号>-<内容>`。`main` を最新化してから切る
3. **`main` へ直接コミット・push しない。** GitHub側で保護されており拒否される。変更は必ずPR経由
4. **コミットメッセージ規約に従う。** `初級編<回> 【<カテゴリ>】<テーマ>: <詳細>` 形式（例: `初級編9 【実装】DB構築と接続: JPAエンティティを追加`）
5. **コミット → push → PR作成。** PR本文に `Closes #<issue番号>` を必ず含める
6. **マージはマージコミット方式で行う。** `gh pr merge --merge` を使う。Squash・Rebaseは使わない（GitHub側でもマージコミット以外は選択できないよう設定済み）
7. **マージ後は後片付けをする。** リモート・ローカル両方の作業ブランチを削除する（`gh pr merge --delete-branch` ならリモートは同時に削除される）。Issueは `Closes` キーワードによりマージと同時に自動closeされる

## 参考ドキュメント

- [CONTRIBUTING.md](./CONTRIBUTING.md) — 開発運用ルール全般（ブランチ命名・コミット規約・PR/マージ手順）
- [docs/requirements.md](./docs/requirements.md) — 要件定義書（ハブ）
