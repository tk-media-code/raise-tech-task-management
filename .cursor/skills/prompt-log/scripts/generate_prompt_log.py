#!/usr/bin/env python3
"""Cursor Agent とのプロンプトのやり取りを Markdown 化するスクリプト。

Cursor は会話ログを次の場所に JSONL で保存する（プロジェクトごと）:

  ~/.cursor/projects/<cwd をエンコードした名前>/agent-transcripts/<uuid>/<uuid>.jsonl

このスクリプトはそのログから

  - ユーザーが送った生プロンプト（<user_query> 内。全文）
  - それに続くアシスタントのテキスト回答（tool_use は含めない）

を取り出し、講師へのプルリクエストに添付できる 1 枚の Markdown にまとめる。
標準ライブラリのみで動作し、外部依存は無い。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime

# <user_query>...</user_query> からユーザー入力を取り出す
_USER_QUERY_PATTERN = re.compile(
    r"<user_query>\s*(.*?)\s*</user_query>", re.DOTALL
)
# 先頭の <timestamp>...</timestamp> をメタから落とす（プロンプト本文には不要）
_TIMESTAMP_PATTERN = re.compile(
    r"<timestamp>.*?</timestamp>\s*", re.DOTALL
)


def encode_cwd_to_project_dirname(cwd: str) -> str:
    """Cursor のプロジェクトディレクトリ名エンコードを再現する。

    絶対パス先頭の "/" を除き、残りの "/" を "-" に置換する。
    例: /home/tokuoka/projects/raise-tech/task-management
      → home-tokuoka-projects-raise-tech-task-management
    """
    abspath = os.path.abspath(cwd)
    if abspath.startswith("/"):
        abspath = abspath[1:]
    return abspath.replace("/", "-")


def projects_root() -> str:
    return os.path.expanduser("~/.cursor/projects")


def find_transcripts_dir(cwd: str) -> str | None:
    """cwd に対応する agent-transcripts ディレクトリを返す。"""
    root = projects_root()
    encoded = encode_cwd_to_project_dirname(cwd)
    candidate = os.path.join(root, encoded, "agent-transcripts")
    if os.path.isdir(candidate):
        return candidate
    return None


def _iter_jsonl_paths(transcripts_dir: str) -> list[str]:
    """agent-transcripts 配下の *.jsonl を列挙する。"""
    paths: list[str] = []
    for entry in os.listdir(transcripts_dir):
        sub = os.path.join(transcripts_dir, entry)
        if not os.path.isdir(sub):
            continue
        for name in os.listdir(sub):
            if name.endswith(".jsonl"):
                paths.append(os.path.join(sub, name))
    return paths


def _extract_text_parts(content) -> list[str]:
    """message.content から type=text の文字列だけを取り出す。"""
    texts: list[str] = []
    if isinstance(content, str):
        texts.append(content)
        return texts
    if not isinstance(content, list):
        return texts
    for block in content:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "text" and isinstance(block.get("text"), str):
            texts.append(block["text"])
    return texts


def _extract_user_prompt(text: str) -> str | None:
    """ユーザーメッセージから <user_query> 本文を取り出す。無ければ None。"""
    cleaned = _TIMESTAMP_PATTERN.sub("", text).strip()
    m = _USER_QUERY_PATTERN.search(cleaned)
    if m:
        return m.group(1).strip()
    # user_query タグが無い場合は、システム用ラッパーっぽいもの以外をそのまま使う
    if cleaned.startswith("<") and "user_query" not in cleaned:
        return None
    return cleaned or None


def list_sessions(transcripts_dir: str) -> list[tuple[str, float, int]]:
    """[(path, mtime, user_prompt_count), ...] を mtime 降順で返す。"""
    results: list[tuple[str, float, int]] = []
    for path in _iter_jsonl_paths(transcripts_dir):
        try:
            mtime = os.path.getmtime(path)
        except OSError:
            continue
        count = 0
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
                    if obj.get("role") != "user":
                        continue
                    content = (obj.get("message") or {}).get("content")
                    for t in _extract_text_parts(content):
                        if _extract_user_prompt(t):
                            count += 1
                            break
        except OSError:
            pass
        results.append((path, mtime, count))
    results.sort(key=lambda r: r[1], reverse=True)
    return results


def parse_turns(jsonl_path: str) -> list[dict]:
    """JSONL を読み、[{prompt, response, timestamp, kind}] のリストを返す。

    1 やり取り = ユーザープロンプト 1 件 + 次のユーザープロンプトまでの
    アシスタントテキスト回答（ツール呼び出しは除外）。
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

            role = obj.get("role")
            content = (obj.get("message") or {}).get("content")
            texts = _extract_text_parts(content)

            if role == "user":
                prompt = None
                for t in texts:
                    prompt = _extract_user_prompt(t)
                    if prompt:
                        break
                if not prompt:
                    continue
                if current is not None:
                    turns.append(current)
                # Cursor の JSONL には ISO タイムスタンプが無いことが多いので、
                # 先頭の <timestamp> があればそこから拾う（メタ用）。
                ts = None
                for t in texts:
                    m = re.search(
                        r"<timestamp>(.*?)</timestamp>", t, re.DOTALL
                    )
                    if m:
                        ts = m.group(1).strip()
                        break
                current = {
                    "prompt": prompt,
                    "response_parts": [],
                    "timestamp": ts,
                    "kind": "typed",
                }
                continue

            if role == "assistant" and current is not None:
                for t in texts:
                    t = t.strip()
                    if t:
                        current["response_parts"].append(t)

        if current is not None:
            turns.append(current)

    for turn in turns:
        turn["response"] = "\n\n".join(turn["response_parts"]).strip()
        del turn["response_parts"]

    return turns


def extract_meta(jsonl_path: str) -> dict:
    """ヘッダ用メタ（セッションID・開始日時）。"""
    session_id = os.path.splitext(os.path.basename(jsonl_path))[0]
    start_ts = None
    try:
        with open(jsonl_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                content = (obj.get("message") or {}).get("content")
                for t in _extract_text_parts(content):
                    m = re.search(
                        r"<timestamp>(.*?)</timestamp>", t, re.DOTALL
                    )
                    if m:
                        start_ts = m.group(1).strip()
                        break
                if start_ts:
                    break
    except OSError:
        pass
    # ファイル mtime をフォールバックに使う
    if not start_ts:
        try:
            start_ts = datetime.fromtimestamp(
                os.path.getmtime(jsonl_path)
            ).strftime("%Y-%m-%d")
        except OSError:
            start_ts = ""
    return {
        "session_id": session_id,
        "start_ts": start_ts,
        "display_name": session_id,
    }


def _format_date(ts: str) -> str:
    if not ts:
        return "(不明)"
    # "Tuesday, Aug 4, 2026, 11:04 PM (UTC+9)" や "2026-08-04" 両対応
    if "T" in ts:
        return ts.split("T", 1)[0]
    # 英語曜日付きなら先頭から日付っぽい部分をそのまま短く
    if "," in ts:
        parts = ts.split(",")
        if len(parts) >= 2:
            return parts[1].strip()[:12]
    return ts[:10] if len(ts) >= 10 else ts


def to_blockquote(text: str) -> str:
    lines = text.split("\n")
    return "\n".join(">" if ln == "" else f"> {ln}" for ln in lines)


def build_preview(response: str, n: int) -> str:
    lines = [ln for ln in response.splitlines() if ln.strip()]
    return "\n".join(lines[:n])


def build_markdown(
    turns: list[dict], session_metas: list[dict], preview_lines: int
) -> str:
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    short_ids = "+".join(m["session_id"][:8] for m in session_metas)

    lines: list[str] = []
    lines.append(f"# プロンプトログ — {short_ids}")
    lines.append("")
    lines.append("| 項目 | 値 |")
    lines.append("|------|-----|")
    lines.append(f"| 生成日時 | {now_str} |")
    lines.append("| プロジェクト | raise-tech / task-management |")
    lines.append("| ソース | Cursor Agent |")
    if len(session_metas) == 1:
        lines.append(f"| セッション | {session_metas[0]['display_name']} |")
    else:
        chain = " → ".join(
            f"{m['display_name']}（{_format_date(m['start_ts'])}）"
            for m in session_metas
        )
        lines.append(f"| セッション（時系列順に統合） | {chain} |")
    lines.append(f"| やり取り数 | {len(turns)} |")
    lines.append("")
    lines.append(
        "> 各回答は「回答の全文を表示」をクリックすると展開されます（GitHub で表示時）。"
    )
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

        lines.append(f"## {i}. プロンプト")
        lines.append("")
        lines.append(to_blockquote(turn["prompt"]))
        lines.append("")
        lines.append("**アシスタントの回答:**")
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


def sanitize_filename(name: str) -> str:
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
    base, ext = os.path.splitext(filename)
    candidate = os.path.join(out_dir, filename)
    i = 2
    while os.path.exists(candidate):
        candidate = os.path.join(out_dir, f"{base}-{i}{ext}")
        i += 1
    return candidate


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Cursor Agent とのプロンプトのやり取りを Markdown 化する"
    )
    parser.add_argument("--name", help="出力ファイル名（省略時は日時から自動生成）")
    parser.add_argument(
        "--session",
        action="append",
        help="対象セッションIDの先頭一致。複数回指定で時系列結合",
    )
    parser.add_argument("--list", action="store_true", help="セッション一覧を表示して終了")
    parser.add_argument("--out-dir", default=None, help="出力先（既定: ./prompt-logs）")
    parser.add_argument(
        "--preview-lines", type=int, default=3, help="回答プレビュー行数（既定: 3）"
    )
    args = parser.parse_args()

    cwd = os.getcwd()
    transcripts_dir = find_transcripts_dir(cwd)
    if transcripts_dir is None:
        print(
            f"エラー: {cwd} に対応する agent-transcripts が見つかりません"
            "（~/.cursor/projects/ 配下）。",
            file=sys.stderr,
        )
        sys.exit(1)

    sessions = list_sessions(transcripts_dir)
    if not sessions:
        print(
            f"エラー: {transcripts_dir} にセッションログ（*.jsonl）がありません。",
            file=sys.stderr,
        )
        sys.exit(1)

    if args.list:
        print(f"セッションログディレクトリ: {transcripts_dir}\n")
        print(f"{'session id':38}  {'更新日時':19}  プロンプト数")
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
        resolved_paths = [sessions[0][0]]

    session_metas = [extract_meta(p) for p in resolved_paths]
    order = sorted(
        range(len(resolved_paths)),
        key=lambda i: session_metas[i]["start_ts"] or "",
    )
    resolved_paths = [resolved_paths[i] for i in order]
    session_metas = [session_metas[i] for i in order]

    turns: list[dict] = []
    for idx, path in enumerate(resolved_paths):
        for turn in parse_turns(path):
            turn["_session_idx"] = idx
            turns.append(turn)

    if not turns:
        print("対象セッションにユーザープロンプトがありません。", file=sys.stderr)
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
            f"生成: {rel}（やり取り {len(turns)} 件 /"
            f" セッション {len(resolved_paths)} 件を時系列統合）"
        )
    else:
        print(f"生成: {rel}（やり取り {len(turns)} 件）")


if __name__ == "__main__":
    main()
