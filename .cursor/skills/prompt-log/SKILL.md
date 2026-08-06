---
name: prompt-log
description: >-
  Cursor Agent とのプロンプトのやり取りを Markdown 化する。
  「プロンプトログ作って」「講師に送るプロンプトまとめ」「今回のやり取りをPRで送りたい」
  と言われたら使う。現在セッションのプロンプト全文と回答（冒頭プレビュー＋details 折りたたみ）を
  prompt-logs/ へ出力する。出力ファイル名は実行時に任意指定可能。
---

# Prompt Log Skill — Cursor プロンプトログ生成

## 目的

現在のセッションでのプロンプトのやり取り（ユーザー入力全文 + アシスタントの回答）を 1 枚の Markdown にまとめる。講師へのプルリクエストに添付し、プロンプトの書き方についてフィードバックをもらうために使う。

Claude Code 用の同等スキルは `.claude/skills/prompt-log/` にある。こちらは Cursor の `agent-transcripts` を読む。

## 実行手順

### 1. 出力ファイル名を決める

- ユーザーがファイル名を指定していればそれを使う（`.md` が無ければ付与）
- 無い場合は一言確認する:「出力ファイル名を指定しますか？（未指定なら日時で自動命名します）」

### 2. スクリプトを実行する

リポジトリルート（task-management）で実行する。cwd から対象セッションと出力先（`./prompt-logs/`）を自動判定する。

```bash
# ファイル名を指定する場合
python3 .cursor/skills/prompt-log/scripts/generate_prompt_log.py --name "<ファイル名>"

# 指定しない場合（日時で自動命名）
python3 .cursor/skills/prompt-log/scripts/generate_prompt_log.py
```

過去のセッションを対象にする場合:

```bash
python3 .cursor/skills/prompt-log/scripts/generate_prompt_log.py --list
python3 .cursor/skills/prompt-log/scripts/generate_prompt_log.py --session <id先頭> --name "<ファイル名>"
```

複数セッションを 1 本にまとめる場合（開始日時の昇順で自動整列）:

```bash
python3 .cursor/skills/prompt-log/scripts/generate_prompt_log.py \
  --session <1つ目のid先頭> --session <2つ目のid先頭> --name "<ファイル名>"
```

### 3. 結果を報告する

スクリプトの標準出力（生成ファイルの相対パスとやり取り件数）をそのままユーザーに伝える。

**このスキルは commit / push / PR 作成を自動では行わない。** ユーザーが望んだ場合のみ案内する:

```bash
git switch -c prompt-log/<日付など>
git add prompt-logs/<生成したファイル>
git commit -m "Add prompt log for review"
git push -u origin <ブランチ名>
gh pr create --fill
```

## 仕様メモ

- ユーザー入力は全文を引用ブロック（`>`）で掲載する
- アシスタント回答は冒頭数行プレビューのあと `<details>` で全文を折りたたむ
- ツール実行内容はログに含めない（テキスト回答のみ）
- 生成先は `prompt-logs/`（初回はスクリプトが作成）。同名は `-2` など連番で回避
- 読み取り元は `~/.cursor/projects/<encoded-cwd>/agent-transcripts/`。書き込みは `prompt-logs/` のみ
