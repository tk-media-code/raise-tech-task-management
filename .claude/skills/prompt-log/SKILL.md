---
name: prompt-log
description: Claude Codeとのプロンプトのやり取りをマークダウン化する時に使用。「プロンプトログ作って」「講師に送るプロンプトまとめ」「今回のやり取りをPRで送りたい」と言われたら発動。現在のセッションのプロンプト全文とClaudeの回答（冒頭プレビュー＋details折りたたみ）をprompt-logs/へ出力する。出力ファイル名は実行時に任意指定可能。
argument-hint: "[出力ファイル名]"
---

# Prompt Log Skill — Claude Codeとのプロンプトログ生成

## 目的
現在のセッションでのプロンプトのやり取り（自分の入力全文 + Claude の回答）を 1 枚の Markdown にまとめる。講師へのプルリクエストに添付し、プロンプトの書き方についてフィードバックをもらうために使う。

## 実行手順

### 1. 出力ファイル名を決める
- `/prompt-log <ファイル名>` のように引数が渡されていれば、それをそのまま出力ファイル名として使う（`.md` 拡張子は無ければ自動補完される）。
- 引数が無い場合は、ユーザーに一言だけ確認する:「出力ファイル名を指定しますか？（未指定なら日時で自動命名します）」
  - 指定があればそれを使う。不要と言われれば何も指定せず自動命名に任せる。

### 2. スクリプトを実行する
このスキルが置かれているリポジトリ（task-management）のルートで実行する。cwd から対象セッションと出力先（`./prompt-logs/`）を自動判定する。

```bash
# ファイル名を指定する場合
python3 .claude/skills/prompt-log/scripts/generate_prompt_log.py --name "<ファイル名>"

# 指定しない場合（日時で自動命名）
python3 .claude/skills/prompt-log/scripts/generate_prompt_log.py
```

過去のセッションを対象にしたい場合:

```bash
# セッション一覧（更新日時・typedプロンプト数）を確認
python3 .claude/skills/prompt-log/scripts/generate_prompt_log.py --list

# セッションIDの先頭一致で指定
python3 .claude/skills/prompt-log/scripts/generate_prompt_log.py --session <id先頭> --name "<ファイル名>"
```

### 3. 結果を報告する
スクリプトの標準出力（生成ファイルの相対パスとやり取り件数）をそのままユーザーに伝える。生成された Markdown を開き、やり取り数とメタ情報を簡潔に要約する。

**このスキルは commit / push / PR 作成を自動では行わない。** ユーザーが望んだ場合のみ、次の手順を案内する:

```bash
git switch -c prompt-log/<日付など>
git add prompt-logs/<生成したファイル>
git commit -m "Add prompt log for review"
git push -u origin <ブランチ名>
gh pr create --fill
```

## 仕様メモ
- 自分が入力した生プロンプトは全文を引用ブロック（`>`）で掲載する。
- Claude の回答は冒頭数行のプレビューを表示したあと、`<details>` タグで全文を折りたたむ（GitHub の PR 画面でクリックして展開できる）。
- ツールの実行内容（Bash 実行やファイル編集など）はログに含めない。プロンプトと回答のテキストのみが対象。
- 生成先は `prompt-logs/` ディレクトリ（初回実行時にスクリプトが自動作成）。同名ファイルが既にある場合は上書きせず `-2` などの連番を付けて保存する。
- スクリプトは `~/.claude/projects/` 配下のセッションログを読むだけで、書き込みは `prompt-logs/` にしか行わない。
