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

# /rename 実行時にハーネスが挿入するシステムリマインダーから、ユーザーが付けた
# セッション名を取り出すためのパターン。
# 例: 'The user named this session "初級編5 ... - 01". This may indicate ...'
_RENAME_MARKER_PATTERN = re.compile(r'The user named this session "([^"]+)"')


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


# ツール却下（例: ExitPlanMode の却下、Edit/Write/Bash の却下）時、ハーネスが
# 生成する定型メッセージに、ユーザーが入力した理由が埋め込まれる。
# 例: "...To tell you how to proceed, the user said:\n<ここがユーザー入力>\n\nNote: ..."
_TOOL_REJECTION_GUARD = "doesn't want to proceed with this tool use"
_TOOL_REJECTION_MARKER = "the user said:"
_TOOL_REJECTION_NOTE = "\n\nNote: The user's next message may contain"


def _extract_error_tool_result_text(obj: dict) -> str | None:
    """user 行にある、is_error=True の tool_result ブロックのテキストを取り出す。

    is_error を条件に含めるのは、Bash 出力などの「正常な」tool_result の中に
    たまたま却下メッセージと同じ文言が引用されているだけのケース（例: このスクリプト
    自体をデバッグする際に却下メッセージの内容を print した Bash 結果）を、本物の
    ツール却下と誤認しないようにするため。実際の却下は必ず is_error=True で返る。
    """
    message = obj.get("message") or {}
    content = message.get("content")
    if not isinstance(content, list):
        return None
    for block in content:
        if not (isinstance(block, dict) and block.get("type") == "tool_result"):
            continue
        if not block.get("is_error"):
            continue
        inner = block.get("content")
        if isinstance(inner, str):
            return inner
        if isinstance(inner, list):
            for ic in inner:
                if isinstance(ic, dict) and ic.get("type") == "text":
                    return ic.get("text")
    return None


def _extract_correction_prompt(obj: dict) -> str | None:
    """ツール却下時にユーザーが添えた修正指示があれば取り出す（無ければ None）。

    これは「タイプされた生プロンプト」ではなく tool_result として渡ってくるため、
    _is_typed_prompt() では拾えない。しかし実質的にはユーザーが書いた指示文なので、
    プロンプトログとしては通常の入力と同格に扱う。
    """
    if obj.get("type") != "user" or obj.get("isMeta"):
        return None
    text = _extract_error_tool_result_text(obj)
    if not text or _TOOL_REJECTION_GUARD not in text:
        return None
    idx = text.find(_TOOL_REJECTION_MARKER)
    if idx == -1:
        return None
    rest = text[idx + len(_TOOL_REJECTION_MARKER):].lstrip("\n")
    note_idx = rest.find(_TOOL_REJECTION_NOTE)
    if note_idx != -1:
        rest = rest[:note_idx]
    rest = rest.strip()
    return rest or None


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
                            "kind": "typed",
                        }
                        continue
                if current is not None:
                    turns.append(current)
                current = {
                    "prompt": content,
                    "response_parts": [],
                    "timestamp": obj.get("timestamp"),
                    "kind": "typed",
                }
                continue

            if obj_type == "user":
                correction = _extract_correction_prompt(obj)
                if correction:
                    if current is not None:
                        turns.append(current)
                    current = {
                        "prompt": correction,
                        "response_parts": [],
                        "timestamp": obj.get("timestamp"),
                        "kind": "correction",
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
    """ヘッダに載せるメタ情報（セッションID・開始日時・rename名等）を拾う。

    display_name は /rename で付けられたセッション名。複数回リネームされていれば
    最後のものを採用する（そのため timestamp と違い、ファイル全体を読み切る）。
    リネームされていないセッションでは None のままとし、呼び出し側で session_id に
    フォールバックする。
    """
    session_id = os.path.splitext(os.path.basename(jsonl_path))[0]
    start_ts = None
    display_name = None
    with open(jsonl_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if start_ts is None and obj.get("timestamp"):
                start_ts = obj["timestamp"]
            if obj.get("type") == "user":
                content = (obj.get("message") or {}).get("content")
                if isinstance(content, str):
                    m = _RENAME_MARKER_PATTERN.search(content)
                    if m:
                        display_name = m.group(1)
    return {
        "session_id": session_id,
        "start_ts": start_ts or "",
        "display_name": display_name or session_id,
    }


def _format_date(iso_ts: str) -> str:
    """"2026-07-15T14:52:44.451Z" のような ISO8601 文字列から日付部分だけを取り出す。"""
    if not iso_ts:
        return "(不明)"
    return iso_ts.split("T", 1)[0]


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


def build_markdown(turns: list[dict], session_metas: list[dict], preview_lines: int) -> str:
    """turns の各要素は "_session_idx"（session_metas のインデックス）を持つ想定。

    session_metas はセッション開始日時の昇順（時系列順）に並んでいること。
    """
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    short_ids = "+".join(m["session_id"][:8] for m in session_metas)

    lines: list[str] = []
    lines.append(f"# プロンプトログ — {short_ids}")
    lines.append("")
    lines.append("| 項目 | 値 |")
    lines.append("|------|-----|")
    lines.append(f"| 生成日時 | {now_str} |")
    lines.append("| プロジェクト | raise-tech / task-management |")
    if len(session_metas) == 1:
        lines.append(f"| セッション | {session_metas[0]['display_name']} |")
    else:
        chain = " → ".join(
            f"{m['display_name']}（{_format_date(m['start_ts'])}）" for m in session_metas
        )
        lines.append(f"| セッション（時系列順に統合） | {chain} |")
    lines.append(f"| やり取り数 | {len(turns)} |")
    lines.append("")
    lines.append("> 各回答は「回答の全文を表示」をクリックすると展開されます（GitHub で表示時）。")
    lines.append("")
    lines.append("---")
    lines.append("")

    prev_session_idx = None
    for i, turn in enumerate(turns, start=1):
        session_idx = turn.get("_session_idx", 0)
        if len(session_metas) > 1 and session_idx != prev_session_idx:
            m = session_metas[session_idx]
            lines.append(
                f"> **▼ ここから別セッション**：{m['display_name']}"
                f"（{_format_date(m['start_ts'])} 開始）"
            )
            lines.append("")
        prev_session_idx = session_idx

        heading = "プロンプト"
        if turn.get("kind") == "correction":
            heading += "（提案の却下時に伝えた修正指示）"
        lines.append(f"## {i}. {heading}")
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
    parser.add_argument(
        "--session",
        action="append",
        help="対象セッションIDの先頭一致。複数回指定すると、それらのセッションを"
        "開始日時の昇順（時系列順）に結合した1つのログを生成する",
    )
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
        resolved_paths = []
        for prefix in args.session:
            match = None
            for path, _mtime, _count in sessions:
                sid = os.path.splitext(os.path.basename(path))[0]
                if sid.startswith(prefix):
                    match = path
                    break
            if match is None:
                print(
                    f"エラー: セッションID '{prefix}' に一致するログが見つかりません。"
                    "--list で確認してください。",
                    file=sys.stderr,
                )
                sys.exit(1)
            resolved_paths.append(match)
    else:
        resolved_paths = [sessions[0][0]]  # mtime 降順の先頭 = 最新セッション

    session_metas = [extract_meta(p) for p in resolved_paths]
    # 開始日時の昇順（時系列順）に並べ替える。--session を指定した順序ではなく、
    # 実際にセッションが始まった時刻を基準にすることで、渡す順序を気にせず使える。
    order = sorted(range(len(resolved_paths)), key=lambda i: session_metas[i]["start_ts"] or "")
    resolved_paths = [resolved_paths[i] for i in order]
    session_metas = [session_metas[i] for i in order]

    turns: list[dict] = []
    for idx, path in enumerate(resolved_paths):
        for turn in parse_turns(path):
            turn["_session_idx"] = idx
            turns.append(turn)

    if not turns:
        print("対象セッションに typed プロンプトがありません。", file=sys.stderr)
        sys.exit(1)

    out_dir = args.out_dir or os.path.join(cwd, "prompt-logs")
    os.makedirs(out_dir, exist_ok=True)

    filename = sanitize_filename(args.name) if args.name else default_filename()
    out_path = unique_path(out_dir, filename)

    markdown = build_markdown(turns, session_metas, args.preview_lines)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(markdown)

    rel = os.path.relpath(out_path, cwd)
    if len(resolved_paths) > 1:
        print(
            f"生成: {rel}（やり取り {len(turns)} 件 / セッション {len(resolved_paths)} 件を時系列統合）"
        )
    else:
        print(f"生成: {rel}（やり取り {len(turns)} 件）")


if __name__ == "__main__":
    main()
