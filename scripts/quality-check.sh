#!/bin/bash
#
# push前の品質チェックをまとめて実行するスクリプト。
# .claude/hooks/pre-push-quality-check.sh（git push検知時の自動実行）と
# .claude/skills/quality-check/SKILL.md（手動実行）の両方から、このスクリプト
# 1本だけを呼ぶことで、「何をチェックするか」の定義を1箇所に保つ（DRY）。
# Cursorや素のgit運用でも、このスクリプトを直接叩けば同じチェックができる。
#
# 終了コードの意味（呼び出し側はこの3値で次に取るべき行動を変える）:
#   0: 全チェック合格。pushしてよい
#   1: 品質上の問題を検出。コードを修正する必要がある
#   3: チェックそのものを実行できない（コンテナ未起動・git worktreeからの実行など、
#      環境側の問題）。コードではなく環境を直す必要がある
#
# 使い方:
#   bash scripts/quality-check.sh            # backend・frontend両方
#   bash scripts/quality-check.sh --backend   # backendのみ
#   bash scripts/quality-check.sh --frontend  # frontendのみ

set -uo pipefail
# set -e は使わない。3つのチェックのうち1つが失敗しても残りを実行し、
# 最後にまとめて結果を報告したいため（途中で打ち切ると、1回のpush試行では
# 1つの問題しか分からず、「修正して再push」を何度も繰り返す羽目になる）。

# --- 0. 設定 ---

# 自分自身の位置からリポジトリルートを解決する。`git rev-parse` を使わないのは、
# git worktree内で実行された場合に worktree のパスを返してしまい、後段の
# workspace_matches によるガードが正しく働かなくなるため（このスクリプトの
# 置き場所＝メインチェックアウトの scripts/ を基準にする）。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BACKEND_CONTAINER="task-management-backend"
FRONTEND_CONTAINER="task-management-frontend"

# oxlintの--deny-warningsは、既知のwarning 8件（Issue #66・#67で対応予定。
# jsx-a11yのモーダル関連・promiseのthen()未返却）が解消するまで、あえて付けない。
# 今つけると常にexit 1になり、pushが恒久的にブロックされてしまうため。
# 8件が解消したら、ここを (--deny-warnings) に変えるだけで有効化できる。
OXLINT_ARGS=()

TARGET="all"
case "${1:-}" in
	--backend) TARGET="backend" ;;
	--frontend) TARGET="frontend" ;;
	"") TARGET="all" ;;
	*)
		echo "[ERROR] 不明な引数です: $1（--backend / --frontend のみ指定できます）" >&2
		exit 3
		;;
esac

# --- 1. ユーティリティ関数 ---

# コンテナが実際に起動しているかを確認する。
container_running() {
	local container="$1"
	local state
	state="$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null)" || return 1
	[ "$state" = "true" ]
}

# コンテナの/workspaceが、期待するホスト側パスをマウントしているかを確認する。
#
# なぜこのチェックが要るか: このプロジェクトはgit worktree（.claude/worktrees/配下）
# を使うことがあるが、docker-compose.ymlのbind mountは常にメインチェックアウトを
# 指している。worktree内からdocker execでチェックを走らせると、「今まさに変更した
# worktree側のコード」ではなく「メインチェックアウト側の別のコード」を検査してしまい、
# 壊れたコードのpushをうっかり通してしまう（fail-openな事故）。これを防ぐため、
# マウント元と自分の位置が一致しない場合は検査そのものを拒否する（fail-closed）。
workspace_matches() {
	local container="$1"
	local expected="$2"
	local actual
	actual="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/workspace"}}{{.Source}}{{end}}{{end}}' "$container" 2>/dev/null)"
	[ "$actual" = "$expected" ]
}

# 指定コンテナに対する事前確認（docker自体の有無・起動しているか・マウント元が
# 正しいか）。通らなければ理由をstderrに出してreturn 1する。
preflight() {
	local container="$1"
	local expected_dir="$2"

	if ! command -v docker >/dev/null 2>&1; then
		echo "[環境エラー] docker コマンドが見つかりません。" >&2
		return 1
	fi

	if ! container_running "$container"; then
		echo "[環境エラー] コンテナ '$container' が起動していません。" >&2
		echo "  docker compose up -d を実行してから、もう一度お試しください。" >&2
		return 1
	fi

	if ! workspace_matches "$container" "$expected_dir"; then
		local actual
		actual="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/workspace"}}{{.Source}}{{end}}{{end}}' "$container" 2>/dev/null)"
		echo "[環境エラー] コンテナ '$container' の /workspace は" >&2
		echo "  '$actual' をマウントしていますが、このスクリプトは" >&2
		echo "  '$expected_dir' から実行されています。" >&2
		echo "  git worktree 内から実行すると、メインチェックアウト側のコードが検査され、" >&2
		echo "  今まさに変更したコードがチェックされないまま合格してしまいます。" >&2
		echo "  メインチェックアウトで作業してください。" >&2
		return 1
	fi

	return 0
}

# --- 2. 結果の集計 ---
RESULT_NAMES=()
RESULT_STATUSES=()   # OK / NG
RESULT_SECONDS=()
HAS_FAILURE=0
HAS_ENV_ERROR=0

# 1件のチェックを実行し、結果を記録する。失敗時は出力の末尾100行をその場で表示する
# （Gradle・oxlintの全出力をそのまま流すと、hook経由でClaudeに渡る際にコンテキストを
# 浪費するため、指摘の要点が集まりやすい末尾だけに絞る）。
#
# $1: サマリ表示用の名前  $2: 実行するコマンド（このスクリプト内で組み立てた
# 固定文字列のみを渡す。外部入力をそのままevalに渡すことはしない）
run_check() {
	local name="$1"
	local cmd="$2"
	local start end elapsed output status

	start="$(date +%s)"
	output="$(eval "$cmd" 2>&1)"
	status=$?
	end="$(date +%s)"
	elapsed=$((end - start))

	RESULT_NAMES+=("$name")
	RESULT_SECONDS+=("$elapsed")

	if [ "$status" -eq 0 ]; then
		RESULT_STATUSES+=("OK")
	else
		RESULT_STATUSES+=("NG")
		HAS_FAILURE=1
		echo "----- $name の出力（末尾100行） -----"
		echo "$output" | tail -n 100
		echo "----- ここまで -----"
		echo
	fi
}

# --- 3. backend ---
if [ "$TARGET" = "all" ] || [ "$TARGET" = "backend" ]; then
	if preflight "$BACKEND_CONTAINER" "$REPO_ROOT/backend"; then
		# checkはcompileJava・compileTestJava・checkstyleMain・spotbugsMain・test
		# すべてに依存するタスク。bootJarの生成（=CI側の担当）は含まないため、
		# ローカルのpush前チェックとしてはこれで速度と網羅性のバランスが取れる。
		run_check "backend (gradlew check)" \
			"docker exec -w /workspace '$BACKEND_CONTAINER' ./gradlew check --console=plain"

		# 失敗時、SpotBugsの指摘内容を出力に含める。
		# build/reports/spotbugs/main.txt はコンテナ内の名前付きボリューム
		#（build-output）にあり、ホスト側の backend/build/ からは見えないため、
		# ここでコンテナ内から直接catする（無ければ何もしない＝黙って無視する。
		# main.txtが生成されるのはbackend/build.gradleにtextレポート出力を
		# 追加した場合のみで、追加前の一時的な状態でもエラーにしないため）。
		if [ "${RESULT_STATUSES[-1]}" = "NG" ]; then
			spotbugs_text="$(docker exec -w /workspace "$BACKEND_CONTAINER" \
				cat build/reports/spotbugs/main.txt 2>/dev/null || true)"
			if [ -n "$spotbugs_text" ]; then
				echo "----- SpotBugsの指摘（build/reports/spotbugs/main.txt） -----"
				echo "$spotbugs_text"
				echo "----- ここまで -----"
				echo
			fi
		fi
	else
		HAS_ENV_ERROR=1
	fi
fi

# --- 4. frontend ---
if [ "$TARGET" = "all" ] || [ "$TARGET" = "frontend" ]; then
	if preflight "$FRONTEND_CONTAINER" "$REPO_ROOT/frontend"; then
		run_check "frontend (oxlint)" \
			"docker exec -w /workspace '$FRONTEND_CONTAINER' npx oxlint ${OXLINT_ARGS[*]}"
		# npm run build は tsc -b（型チェック）と vite build の両方を行う。
		# テストより先に実行するのは、Vitestが型を検査しない（esbuildで型注釈を落として
		# 実行する）ため。型エラーはこちらでしか検出できず、先に走らせた方が原因に早く辿り着ける。
		run_check "frontend (npm run build)" \
			"docker exec -w /workspace '$FRONTEND_CONTAINER' npm run build"
		# npm test は vitest run（1回だけ実行して終了するモード）。
		# backendの gradlew check がテストまで含むのと対をなす位置づけ。
		run_check "frontend (npm test)" \
			"docker exec -w /workspace '$FRONTEND_CONTAINER' npm test"
	else
		HAS_ENV_ERROR=1
	fi
fi

# --- 5. サマリ表示と終了コードの決定 ---
echo
echo "=== 品質チェック結果 ==="
for i in "${!RESULT_NAMES[@]}"; do
	printf '[%s] %-28s %ss\n' "${RESULT_STATUSES[$i]}" "${RESULT_NAMES[$i]}" "${RESULT_SECONDS[$i]}"
done

# 環境エラーを品質問題より優先して報告する。「コードを直しても解決しない」問題を
# 「コードが悪い」と誤解させないため（preflightで弾かれたチェックはRESULT_NAMESに
# 記録されないので、サマリ表にはそもそも現れない）。
if [ "$HAS_ENV_ERROR" -eq 1 ]; then
	echo
	echo "環境の問題によりチェックを実行できませんでした（上記の[環境エラー]を参照）。"
	exit 3
fi

if [ "$HAS_FAILURE" -eq 1 ]; then
	echo
	echo "品質チェックで問題が見つかりました。上記の指摘を修正してください。"
	exit 1
fi

echo
echo "すべてのチェックに合格しました。"
exit 0
