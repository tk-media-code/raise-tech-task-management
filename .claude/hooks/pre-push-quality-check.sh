#!/bin/bash
#
# PreToolUseフック（matcher: Bash）。git push を含むBashコマンドの実行前に
# push前の品質チェック（scripts/quality-check.sh）を走らせ、失敗すればpush自体を
# ブロックする。詳しい経緯・設計は CONTRIBUTING.md 5章「push前の品質チェック」参照。
#
# .claude/settings.json の matcher: "Bash" は全てのBashコマンド実行のたびに
# このスクリプトを呼ぶ。したがって「git pushではない」と分かった時点で、
# できるだけ低コストで即座に抜ける段階フィルタにしている
#（品質チェックという重い処理を毎回のBash実行のたびに走らせるわけにはいかない）。

set -uo pipefail

payload="$(cat)"

# --- Stage 0: 高速文字列フィルタ ---
# JSON全体に「push」という部分文字列すら含まれないなら、jqの起動すら惜しんで
# 即座に抜ける。ls・git status・npm run build のような大多数のコマンドは、
# ここで数ミリ秒のうちに処理が終わる。
case "$payload" in
	*push*) ;;
	*) exit 0 ;;
esac

# --- Stage 1: JSON解析 ---
# ここまで来た時点で"push"という文字列は含まれているが、tool_nameがBashでない
# （例: 他のツールのcwdやパラメータに"push"が偶然含まれる）場合もあるため、
# 念のためtool_nameも確認する（matcherで既にBashに絞られているはずだが、防御的に）。
tool_name="$(printf '%s' "$payload" | jq -r '.tool_name // ""' 2>/dev/null)"
if [ "$tool_name" != "Bash" ]; then
	exit 0
fi
cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // ""' 2>/dev/null)"
if [ -z "$cmd" ]; then
	exit 0
fi

# --- Stage 2: git push の検知 ---
# 素朴な *"git push"* だと echo "git push" のような単なる文字列表示にも誤爆し、
# 逆に git -C /path push のようなグローバルオプション付きの形を取りこぼす。
# 以下の正規表現（拡張正規表現）は:
#   - 行頭 or シェル区切り文字（; & | ( `）の直後に限定する
#    （引用符やコメントの中に現れた"git push"は対象外にするため）
#   - 先頭に環境変数代入（例: FOO=bar git push）が付いていても許容する
#   - git の直後に -C <path> のようなグローバルオプションが挟まってもよい
#   - 最後は push という単語で終わる（pushurl等の前方一致誤爆を避けるため）
# 多少の過検知（例: コミットメッセージの中の"git push"）は許容する。過検知しても
# 「チェックが通れば素通しする」だけで実害が無く、逆に見逃しはpush前チェックという
# 仕組みの趣旨に反するため、迷ったら検知する側に倒す。
GIT_PUSH_RE='(^|[;&|(`])[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*git([[:space:]]+-[^[:space:]]+([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+push([[:space:]]|$)'

if ! printf '%s' "$cmd" | grep -Eq "$GIT_PUSH_RE"; then
	exit 0
fi

# --- Stage 3: エスケープハッチ ---
# ユーザーが明示的に許可した場合にのみ使う SKIP_QUALITY_CHECK=1 が付いていれば、
# チェックをスキップする。誤検知やチェック自体の不具合で永久にpushできなくなる
# 事態を避けるための安全弁。Claude自身が自己判断でこれを付けることは
# CLAUDE.md で明示的に禁止している（フック側では「ユーザーが指示したのか
# Claudeが自己判断で付けたのか」を技術的に区別できないため、文書規約に委ねる）。
# スキップした事実は必ずここでユーザーに見える形にする（黙って素通しすると
# ガードの意味が薄れるため）。
SKIP_RE='(^|[;&|(`])[[:space:]]*SKIP_QUALITY_CHECK=1[[:space:]]'
if printf '%s' "$cmd" | grep -Eq "$SKIP_RE"; then
	printf '{"systemMessage":"[quality-check] SKIP_QUALITY_CHECK=1 の指定により、push前の品質チェックをスキップしました。"}\n'
	exit 0
fi

# --- Stage 4: 品質チェックの実行とブロック判定 ---
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
CHECKER="$PROJECT_DIR/scripts/quality-check.sh"

if [ ! -f "$CHECKER" ]; then
	{
		echo "push をブロックしました。"
		echo "品質チェックスクリプトが見つかりません: $CHECKER"
	} >&2
	exit 2
fi

output="$(bash "$CHECKER" 2>&1)"
status=$?

if [ "$status" -eq 0 ]; then
	# 合格時は何も出力しない。グローバル設定（~/.claude/settings.json）の
	# rtk hook claude（コマンド書き換え用フック）と並行実行されるため、
	# 余計な出力で解釈が競合しないよう、素通し時は完全に沈黙する。
	exit 0
fi

# exit code 2 は「ブロッキングエラー。stderrがそのままClaudeにフィードバックされる」
# という挙動をする（Claude Code hooksの仕様）。JSON形式でpermissionDecision: denyを
# 返す方式ではなくこちらを選んでいるのは、このユーザーのグローバル設定が
# permissions.defaultMode: "bypassPermissions" になっており、権限システム経由の
# 判断がbypass系モードとどう相互作用するか不確実なため。exit code 2は権限システムとは
# 別経路でツール呼び出し自体を止めるので、モードに依存せず確実に効く。
# また、stderrにquality-check.shの出力（Checkstyleのfile:line、oxlintの指摘等）を
# そのまま流すことで、JSON外皮に包まず、次の修正アクションに直結する形でClaudeに渡す。
{
	echo "push をブロックしました（push前の品質チェックに失敗）"
	echo
	echo "$output"
	echo
	echo "対応:"
	echo "1. 上記の指摘を修正し、コミットし直してから再度 push してください"
	echo "   （指摘が解消するまで、この手順を自分で繰り返してください）"
	echo "2. 修正せずに push する必要がある場合は、必ずユーザーに確認し、"
	echo "   許可を得たときだけ 'SKIP_QUALITY_CHECK=1 git push ...' を使ってください"
	echo "   （Claude が自己判断でこの変数を付けることは CLAUDE.md で禁止しています）"
} >&2
exit 2
