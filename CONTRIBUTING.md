# 開発ガイドライン

> このドキュメントは、このリポジトリで開発を行う際の運用ルールをまとめたものです。
> `main` ブランチは保護されており、直接プッシュはできません（[GitHub側の保護設定](#4-github側の保護設定)を参照）。すべての変更は Issue → ブランチ → Pull Request（以下 PR）の流れで行ってください。

## 目次

1. [開発の流れ](#1-開発の流れ)
2. [ブランチ運用](#2-ブランチ運用)
3. [Pull Requestの作成とマージ](#3-pull-requestの作成とマージ)
4. [GitHub側の保護設定](#4-github側の保護設定)
5. [CI（自動チェック）](#5-ci自動チェック)

---

## 1. 開発の流れ

開発は必ず次の順序で進めます。

1. **Issueを立てる** — 開発に着手する前に、必ず Issue を作成します（「何を」「なぜ」やるかを明確にするため）
2. **ブランチを作成する** — 作成した Issue の番号を含むブランチを、`main` から切ります
3. **開発してコミットする** — 変更内容が分かるメッセージでコミットします
4. **プッシュする** — 作業ブランチをリモートに push します
5. **PRを作成する** — `main` へ向けて PR を作成し、本文に対応する Issue 番号を記載します
6. **マージする** — PR をマージします（`main` への直接 push はできません）
7. **後片付けする** — マージ後、リモート・ローカル両方の作業ブランチを削除します。Issue は PR のマージに連動して自動的に close されます

```mermaid
flowchart LR
    A[Issueを立てる] --> B[ブランチ作成]
    B --> C[開発・コミット]
    C --> D[プッシュ]
    D --> E[PR作成]
    E --> F[マージ]
    F --> G[ブランチ削除・Issue close]
```

---

## 2. ブランチ運用

### 2.1 ブランチ命名規則

```
feature/<issue番号>-<内容を表す短い英語>
```

**Issue番号を必ず含めてください。** ブランチと Issue の対応が一目で分かるようにするためです。

| 例 | 説明 |
| --- | --- |
| `feature/10-github-workflow` | Issue #10「GitHub運用ルールの確立」に対応するブランチ |
| `feature/12-task-read-api` | Issue #12 に対応する、タスク取得APIのブランチ |

> バグ修正など性質が異なる場合は `fix/<issue番号>-<内容>` のように接頭辞を変えても構いません。番号を含める点は変わりません。

### 2.2 `main` ブランチについて

`main` へは直接コミット・pushできません（[GitHub側の保護設定](#4-github側の保護設定)参照）。変更は必ず PR 経由で取り込みます。

---

## 3. Pull Requestの作成とマージ

- PR本文には、対応する Issue 番号を **`Closes #<issue番号>`** の形式で必ず記載してください。マージ時に Issue が自動的に close されます
- レビュー承認は必須にしていません（現状 1人開発のため）。ただし `main` への統合は必ず PR を経由します
- **PRの作成者はマージを実行しません。** 内容を確認した人（リポジトリ管理者）が手動でマージしてください。Claude Codeなどのツールを使ってPRを作成した場合も同様に、マージは行わずユーザーの確認を待ちます
- **マージ方式は「マージコミット」を使ってください。** Squash・Rebaseは使いません（コミット履歴とPR単位の対応を保つため）。GitHub側でもマージコミット以外は選択できないよう設定済みです
- マージ後は、リモートブランチが自動削除されるよう設定済みです
- マージ後、ローカルの作業ブランチも削除してください

```bash
# mainを最新化してブランチを作成
git switch main
git pull
git switch -c feature/<issue番号>-<内容>

# 開発・コミット・プッシュ
git add <ファイル>
git commit -m "<変更内容が分かるメッセージ>"
git push -u origin feature/<issue番号>-<内容>

# PR作成（本文に Closes #<issue番号> を含める）
gh pr create --fill
```

**ここでPRの内容を確認し、問題なければマージします。**

```bash
# マージ（マージコミット方式・リモートブランチも同時に削除）
gh pr merge --merge --delete-branch

# ローカルの後片付け
git switch main
git pull
git branch -d feature/<issue番号>-<内容>
```

---

## 4. GitHub側の保護設定

`main` ブランチには Repository Ruleset により、以下が設定されています。

| ルール | 内容 |
| --- | --- |
| PR必須 | `main` への変更はPR経由のみ可能（直接pushは拒否される） |
| マージ方式はマージコミットのみ | Squash・Rebaseマージは選択不可 |
| force push禁止 | 履歴の書き換えを防止 |
| ブランチ削除禁止 | `main` 自体の削除を防止 |
| マージ後の自動削除 | PRマージ時、リモートの作業ブランチを自動削除 |

管理者を含め、誰も `main` へ直接pushすることはできません。緊急時も、必ずPRを経由してください。

---

## 5. CI（自動チェック）

`main` へのPRを作成・更新すると、GitHub Actions（[`.github/workflows/ci.yml`](./.github/workflows/ci.yml)）が自動的に以下を検査します。コンパイルが通らない・型エラーがある・静的解析で問題が見つかったコードにレビュアーが気付けないままマージされることを防ぐためのものです。

| job | 内容 |
| --- | --- |
| backend | `./gradlew build`（コンパイル + Checkstyle + SpotBugs + 既存のスモークテスト）。PostgreSQLコンテナをGitHub Actions上に一時的に起動し、DB接続を要する`TaskManagementApplicationTests`を実際に走らせる |
| frontend | `npx oxlint`（Lint）+ `npm run build`（`tsc -b`による型チェック + Viteビルド） |

レビュー承認と同じく必須のステータスチェックには設定していませんが（現状1人開発のため）、マージ前に必ず結果を確認してください。失敗した場合、backendのCheckstyle/SpotBugsレポートはワークフローの実行結果からArtifactとしてダウンロードできます。

> **frontendのLintは現時点で`--deny-warnings`を付けていません。** `.oxlintrc.json`強化時の品質チェックで検出したsuspicious/jsx-a11y/promiseの指摘（8件、別Issueで管理）がwarning扱いで残っているため、それらを解消するまではerror（correctnessカテゴリ）のみでCIをゲートする段階的な運用にしています。解消後に`--deny-warnings`を付けてwarningもCI失敗の対象にする想定です。

### ローカルで事前に確認する

PRを作成する前に、ローカル（Dockerコンテナ内）で同じチェックを実行できます。backendはJava 25のtoolchainを要求するため、ホストのJavaバージョンに関わらずコンテナ内で実行してください。

```bash
# backend（コンパイル + Checkstyle + SpotBugs + テスト）
docker exec -w /workspace task-management-backend ./gradlew check

# frontend（Lint。CIと同じくwarningは失敗させない。warningも含めて確認したい場合は
# 末尾に --deny-warnings を付ける）
docker exec -w /workspace task-management-frontend npx oxlint

# frontend（型チェック + ビルド）
docker exec -w /workspace task-management-frontend npm run build
```
