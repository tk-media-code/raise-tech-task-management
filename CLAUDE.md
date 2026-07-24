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
2. **Issue番号を含むブランチを作成する。** 形式は `feature/<issue番号>-<内容>`。`main` を最新化してから切る。このとき、前回までにマージ済みで不要になったローカルブランチ（`git branch --merged main` で確認できるもの。`main` 自身は除く）があれば削除する
3. **`main` へ直接コミット・push しない。** GitHub側で保護されており拒否される。変更は必ずPR経由
4. **コミット → push → PR作成まで行う。** PR本文に `Closes #<issue番号>` を必ず含める
5. **PR作成後、`gh pr merge` は実行せず、そこで止まる。** マージはユーザーが内容を確認した上で行う。マージ方式はマージコミット固定（Squash・Rebase不可、GitHub側で強制済み）。マージされるとIssueは自動closeされ、リモートブランチも自動削除される

## 参考ドキュメント

- [CONTRIBUTING.md](./CONTRIBUTING.md) — 開発運用ルール全般（ブランチ命名・PR/マージ手順）
- [docs/requirements.md](./docs/requirements.md) — 要件定義書（ハブ）
