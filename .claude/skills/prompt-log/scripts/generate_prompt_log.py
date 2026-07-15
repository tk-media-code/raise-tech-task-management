#!/usr/bin/env python3
"""Claude Code とのプロンプトのやり取りを Markdown 化するスクリプト。

Claude Code はセッションの会話ログを ~/.claude/projects/<cwd をエンコードした名前>/
<sessionId>.jsonl に JSONL 形式で保存している。このスクリプトはそのログから

  - ユーザーが実際にタイプした生プロンプト（全文）
  - それに続く Claude のテキスト回答（ツール実行のログは含めない）

を取り出し、講師へのプルリクエストに添付できる 1 枚の Markdown にまとめる。
標準ライブラリのみで動作し、外部依存は無い。
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys
from datetime import datetime

# スラッシュコマンド展開やローカルコマンドなど、"typed" だが人間の生入力ではない
# ものを弾くための接頭辞。
COMMAND_PREFIXES = ("<command-name>", "<command-message>", "<local-command")


# ---------------------------------------------------------------------------
# セッションログの特定
# ---------------------------------------------------------------------------

def encode_cwd_to_project_dirname(cwd: str) -> str:
    """Claude Code が使うプロジェクトディレクトリ名のエンコード規則を再現する。

    実測では絶対パスの "/" が "-" に置換される（既存のハイフンはそのまま）。
    英数字とハイフン以外の文字も "-" に寄せておくことで、将来の差異にもある程度
    耐性を持たせる。
    """
    abspath = os.path.abspath(cwd)
    return re.sub(r"[^A-Za-z0-9-]", "-", abspath)


def projects_root() -> str:
    return os.path.expanduser("~/.claude/projects")


def _peek_cwd(jsonl_path: str, max_lines: int = 5) -> str | None:
    """jsonl の先頭数行から cwd フィールドを覗き見る（フォールバック用）。"""
    try:
        with open(jsonl_path, encoding="utf-8") as f:
            for _, line in zip(range(max_lines), f):
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                cwd = obj.get("cwd")
                if cwd:
                    return cwd
    except OSError:
        return None
    return None


def find_session_dir(cwd: str) -> str | None:
    """cwd に対応するセッションログディレクトリを特定する。"""
    root = projects_root()
    encoded = encode_cwd_to_project_dirname(cwd)
    candidate = os.path.join(root, encoded)
    if os.path.isdir(candidate):
        return candidate

    # フォールバック: 各プロジェクトディレクトリの jsonl 先頭行の cwd を見て
    # 実際の cwd と一致するものを探す（エンコード規則の差異に強くするため）。
    if not os.path.isdir(root):
        return None
    abscwd = os.path.abspath(cwd)
    for entry in sorted(os.listdir(root)):
        d = os.path.join(root, entry)
        if not os.path.isdir(d):
            continue
        for jsonl_path in glob.glob(os.path.join(d, "*.jsonl")):
            first_cwd = _peek_cwd(jsonl_path)
            if first_cwd and os.path.abspath(first_cwd) == abscwd:
                return d
    return None


# ---------------------------------------------------------------------------
# JSONL の判定・抽出ロジック
# ---------------------------------------------------------------------------

def _is_typed_prompt(obj: dict) -> bool:
    """この行が「人間が実際にタイプした生プロンプト」かどうかを判定する。"""
    if obj.get("type") != "user":
        return False
    if obj.get("promptSource") != "typed":
        return False
    if obj.get("isMeta"):
        return False
    message = obj.get("message") or {}
    content = message.get("content")
    if not isinstance(content, str):
        return False
    if content.lstrip().startswith(COMMAND_PREFIXES):
        return False
    return True


def _extract_text_blocks(obj: dict) -> list[str]:
    """assistant 行から type=="text" のテキストだけを取り出す（thinking/tool_use は除外）。"""
    message = obj.get("message") or {}
    content = message.get("content")
    if not isinstance(content, list):
        return []
    texts = []
    for block in content:
        if isinstance(block, dict) and block.get("type") == "text":
            text = block.get("text")
            if text:
                texts.append(text)
    return texts


def list_sessions(session_dir: str) -> list[tuple[str, float, int]]:
    """セッション一覧を (path, mtime, typed_count) のリストで返す（mtime 降順）。"""
    results = []
    for path in glob.glob(os.path.join(session_dir, "*.jsonl")):
        mtime = os.path.getmtime(path)
        typed_count = 0
        try:
            with open(path, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if _is_typed_prompt(obj):
                        typed_count += 1
        except OSError:
            pass
        results.append((path, mtime, typed_count))
    results.sort(key=lambda r: r[1], reverse=True)
    return results


def parse_turns(jsonl_path: str) -> list[dict]:
    """JSONL を読み、[{prompt, response, timestamp}] のやり取りリストを返す。

    「1 やり取り」= 生プロンプト 1 件 + それに続く（次の生プロンプトが現れるまでの）
    Claude のテキスト回答、として組み立てる。
    """
    turns: list[dict] = []
    current: dict | None = None

    with open(jsonl_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue

            obj_type = obj.get("type")

            if obj_type == "user" and _is_typed_prompt(obj):
                content = obj["message"]["content"]
                # 直前のプロンプトにまだ Claude の応答が付いておらず、かつ今回の内容が
                # 直前と同一、またはどちらかがもう一方の接頭辞になっている場合は、
                # 「打ち切り・送信ミスによる再送」とみなして直前を破棄し、今回の内容を採用する。
                # （実例: 途中まで打った文章が誤って送信され応答の付かないまま、
                # 　数分後にその文章を含む完全な内容が改めて送信されるケースがあった）
                if current is not None and not current["response_parts"]:
                    prev = current["prompt"]
                    if (
                        content == prev
                        or content.startswith(prev)
                        or prev.startswith(content)
                    ):
                        current = {
                            "prompt": content,
                            "response_parts": [],
                            "timestamp": obj.get("timestamp"),
                        }
                        continue
                if current is not None:
                    turns.append(current)
                current = {
                    "prompt": content,
                    "response_parts": [],
                    "timestamp": obj.get("timestamp"),
                }
                continue

            if obj_type == "assistant" and current is not None:
                current["response_parts"].extend(_extract_text_blocks(obj))

        if current is not None:
            turns.append(current)

    for turn in turns:
        turn["response"] = "\n\n".join(turn["response_parts"]).strip()
        del turn["response_parts"]

    return turns


def extract_meta(jsonl_path: str) -> dict:
    """ヘッダに載せるメタ情報（セッションID・ブランチ等）を拾う。"""
    session_id = os.path.splitext(os.path.basename(jsonl_path))[0]
    git_branch = None
    with open(jsonl_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not git_branch and obj.get("gitBranch"):
                git_branch = obj["gitBranch"]
            if git_branch:
                break
    return {
        "session_id": session_id,
        "git_branch": git_branch or "(不明)",
    }


# ---------------------------------------------------------------------------
# Markdown 整形
# ---------------------------------------------------------------------------

def to_blockquote(text: str) -> str:
    """テキストを Markdown の引用ブロック（> ...）に変換する。

    空行は "> "（末尾空白）ではなく ">" のみにして、ブロッククォートが
    途中で途切れないようにする。
    """
    lines = text.split("\n")
    out = []
    for ln in lines:
        out.append(">" if ln == "" else f"> {ln}")
    return "\n".join(out)


def build_preview(response: str, n: int) -> str:
    """回答の冒頭プレビュー（非空の先頭 n 行）を作る。"""
    lines = [ln for ln in response.splitlines() if ln.strip()]
    return "\n".join(lines[:n])


def build_markdown(turns: list[dict], meta: dict, preview_lines: int) -> str:
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    short_id = meta["session_id"][:8]

    lines: list[str] = []
    lines.append(f"# プロンプトログ — {short_id}")
    lines.append("")
    lines.append("| 項目 | 値 |")
    lines.append("|------|-----|")
    lines.append(f"| 生成日時 | {now_str} |")
    lines.append("| プロジェクト | raise-tech / task-management |")
    lines.append(f"| ブランチ | {meta['git_branch']} |")
    lines.append(f"| セッション | {meta['session_id']} |")
    lines.append(f"| やり取り数 | {len(turns)} |")
    lines.append("")
    lines.append("> 各回答は「回答の全文を表示」をクリックすると展開されます（GitHub で表示時）。")
    lines.append("")
    lines.append("---")
    lines.append("")

    for i, turn in enumerate(turns, start=1):
        lines.append(f"## {i}. プロンプト")
        lines.append("")
        lines.append(to_blockquote(turn["prompt"]))
        lines.append("")
        lines.append("**Claude の回答:**")
        lines.append("")

        response = turn["response"]
        if not response:
            lines.append("（テキスト回答なし）")
        else:
            preview = build_preview(response, preview_lines)
            if preview:
                lines.append(preview)
                lines.append("")
            lines.append("<details>")
            lines.append("<summary>回答の全文を表示</summary>")
            lines.append("")
            lines.append(response)
            lines.append("")
            lines.append("</details>")

        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


# ---------------------------------------------------------------------------
# ファイル名の決定
# ---------------------------------------------------------------------------

def sanitize_filename(name: str) -> str:
    """ユーザー指定のファイル名を、out_dir 内に安全に書けるよう整形する。"""
    name = os.path.basename(name.strip())
    name = re.sub(r'[\\/:*?"<>|]', "-", name)
    name = name.strip(" .")
    if not name:
        name = "prompt-log"
    if not name.lower().endswith(".md"):
        name += ".md"
    return name


def default_filename() -> str:
    return datetime.now().strftime("prompt-log-%Y%m%d-%H%M%S.md")


def unique_path(out_dir: str, filename: str) -> str:
    """out_dir 内でファイル名が衝突する場合、末尾に -2, -3 ... を付けて回避する。"""
    base, ext = os.path.splitext(filename)
    candidate = os.path.join(out_dir, filename)
    i = 2
    while os.path.exists(candidate):
        candidate = os.path.join(out_dir, f"{base}-{i}{ext}")
        i += 1
    return candidate


# ---------------------------------------------------------------------------
# メイン処理
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Claude Code とのプロンプトのやり取りを Markdown 化する"
    )
    parser.add_argument("--name", help="出力ファイル名（省略時は日時から自動生成）")
    parser.add_argument("--session", help="対象セッションIDの先頭一致")
    parser.add_argument("--list", action="store_true", help="セッション一覧を表示して終了")
    parser.add_argument("--out-dir", default=None, help="出力先ディレクトリ（既定: ./prompt-logs）")
    parser.add_argument(
        "--preview-lines", type=int, default=3, help="回答プレビューの行数（既定: 3）"
    )
    args = parser.parse_args()

    cwd = os.getcwd()
    session_dir = find_session_dir(cwd)
    if session_dir is None:
        print(
            f"エラー: {cwd} に対応するセッションログが見つかりません"
            "（~/.claude/projects/ 配下）。",
            file=sys.stderr,
        )
        sys.exit(1)

    sessions = list_sessions(session_dir)
    if not sessions:
        print(f"エラー: {session_dir} にセッションログ（*.jsonl）がありません。", file=sys.stderr)
        sys.exit(1)

    if args.list:
        print(f"セッションログディレクトリ: {session_dir}\n")
        print(f"{'session id':38}  {'更新日時':19}  typedプロンプト数")
        for path, mtime, count in sessions:
            sid = os.path.splitext(os.path.basename(path))[0]
            ts = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
            print(f"{sid:38}  {ts:19}  {count}")
        return

    if args.session:
        target_path = None
        for path, _mtime, _count in sessions:
            sid = os.path.splitext(os.path.basename(path))[0]
            if sid.startswith(args.session):
                target_path = path
                break
        if target_path is None:
            print(
                f"エラー: セッションID '{args.session}' に一致するログが見つかりません。"
                "--list で確認してください。",
                file=sys.stderr,
            )
            sys.exit(1)
    else:
        target_path = sessions[0][0]  # mtime 降順の先頭 = 最新セッション

    turns = parse_turns(target_path)
    if not turns:
        print("対象セッションに typed プロンプトがありません。", file=sys.stderr)
        sys.exit(1)

    meta = extract_meta(target_path)
    out_dir = args.out_dir or os.path.join(cwd, "prompt-logs")
    os.makedirs(out_dir, exist_ok=True)

    filename = sanitize_filename(args.name) if args.name else default_filename()
    out_path = unique_path(out_dir, filename)

    markdown = build_markdown(turns, meta, args.preview_lines)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(markdown)

    rel = os.path.relpath(out_path, cwd)
    print(f"生成: {rel}（やり取り {len(turns)} 件）")


if __name__ == "__main__":
    main()
