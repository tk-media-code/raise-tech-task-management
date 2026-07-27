-- 開発用ダミーデータ投入スクリプト
--
-- 目的: バックエンドAPI（GET系）の動作確認を、いつでも同じ条件でやり直せるようにする。
-- 「同じデータを何度でも投入できる」を実現する方法として、このファイルは
-- 既存データを全削除してから入れ直す冪等（何度実行しても同じ結果になる）なスクリプトにしている。
-- 中身を差分更新する形にはしていない。差分更新は「実行時点の状態」に依存して結果が変わりうるため、
-- 再現性という目的にそぐわない。
--
-- 実行方法（リポジトリルートで実行すること）:
--   docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
--     < db/seed/dummy-data.sql
--
-- 前提: backend を一度起動しており、spring.jpa.hibernate.ddl-auto=update によって
--       board / card / label / card_label の4テーブルが作成済みであること
--       （このファイルはデータ(DML)だけを扱い、テーブル定義(DDL)はJPAエンティティ側に任せる）。
--
-- 日付の方針:
--   due_date は CURRENT_DATE（実行時点の日付）を基準にした相対値にしている。
--   「期限切れ／期限間近」（要件定義 docs/requirements/02-requirements.md 5.6）は相対的な意味を
--   持つ属性であり、絶対日付で埋めてしまうと時間の経過とともに全カードが「期限切れ」へ単調に
--   退化してしまい、確認用データとして機能しなくなる
--   （prototype/app.js の addDaysStr も同じ理由で相対日付を採用している。本ファイルはその先例を踏襲）。
--   「毎回同じデータになる」という要件の本質は「再実行しても行が増えず、内容がブレない」ことであり、
--   それは下の TRUNCATE で保証している。
--   一方 created_at / updated_at は「レスポンスの値そのものの再現性」に直結するため、
--   実行時点に依存しない固定の日時リテラルにしている。

SET client_encoding TO 'UTF8';

-- 文の途中でエラーが起きても中途半端な状態を残さないよう、全体を1トランザクションにまとめる
-- （psqlは既定では文ごとに自動コミットするため、明示的にBEGIN/COMMITで囲む）。
BEGIN;

-- 既存データを全削除して入れ直す。
-- RESTART IDENTITY: 自動採番(id)の次の値を1から振り直す。
-- CASCADE: このテーブルを参照している行も一緒に削除する（本来はcard_label→card→label→board の順に
-- 単独TRUNCATEすれば足りるが、将来テーブルが増えたときに削除順を書き漏らさないための保険）。
TRUNCATE TABLE card_label, card, label, board RESTART IDENTITY CASCADE;

-- ============================================================
-- board（3件）
-- ============================================================
INSERT INTO board (id, name, position, created_at) VALUES
  (1, '仕事', 1, TIMESTAMPTZ '2026-07-20 09:00:00+09'),
  (2, '家事', 2, TIMESTAMPTZ '2026-07-20 09:00:00+09'),
  (3, '学習', 3, TIMESTAMPTZ '2026-07-20 09:00:00+09');

-- ============================================================
-- label（8件）
-- prototype/app.js の LABEL_COLORS（8色パレット）を1色ずつ、ボードごとに割り当てる。
-- ラベルIDをボードごとに連続させているのは（1-3=仕事、4-6=家事、7-8=学習）、
-- 「boardId=1 & labelIds=4」のようなボードをまたいだ組み合わせが0件になることを
-- 確認しやすくするための意図的な配置。
-- ============================================================
INSERT INTO label (id, board_id, name, color) VALUES
  (1, 1, '優先度高',      '#e74c3c'),
  (2, 1, '社外',          '#3498db'),
  (3, 1, '要確認',        '#f1c40f'),
  (4, 2, '買い物',        '#2ecc71'),
  (5, 2, '週末',          '#9b59b6'),
  (6, 2, '急ぎ',          '#e84393'),
  (7, 3, 'Spring Boot',   '#e67e22'),
  (8, 3, '読書',          '#7f8c8d');

-- ============================================================
-- card（15件）
-- 内訳: todo 6件 / doing 4件 / done 5件。うちアーカイブ済みは各ボード1件ずつ（計3件）。
-- 期日は「期限切れ／当日／翌日／先の予定／未設定」を、ラベルは「0件〜3件」の付与数を
-- 満遍なく含めており、GET /api/cards の絞り込み・並び順の確認に必要な組み合わせを網羅する。
-- ============================================================
INSERT INTO card (id, board_id, title, description, due_date, status, is_archived, position, created_at, updated_at) VALUES
  ( 1, 1, '見積書を作成する',
    'A社向けの見積書。単価表は共有ドライブの最新版を使う。',
    CURRENT_DATE - 3, 'todo', false, 1, TIMESTAMPTZ '2026-07-21 10:00:00+09', TIMESTAMPTZ '2026-07-21 10:00:00+09'),
  ( 2, 1, '提案資料をレビューする',
    NULL,
    CURRENT_DATE, 'todo', false, 2, TIMESTAMPTZ '2026-07-21 10:00:00+09', TIMESTAMPTZ '2026-07-21 10:00:00+09'),
  ( 3, 1, '関係者へ連絡する',
    'キックオフ日程の調整。',
    CURRENT_DATE + 1, 'todo', false, 3, TIMESTAMPTZ '2026-07-21 10:00:00+09', TIMESTAMPTZ '2026-07-21 10:00:00+09'),
  ( 4, 1, '議事録をまとめる',
    '定例MTGの議事録。',
    NULL, 'doing', false, 1, TIMESTAMPTZ '2026-07-21 10:00:00+09', TIMESTAMPTZ '2026-07-21 10:00:00+09'),
  ( 5, 1, '請求書を送付する',
    '月末締め。',
    CURRENT_DATE + 14, 'doing', false, 2, TIMESTAMPTZ '2026-07-21 10:00:00+09', TIMESTAMPTZ '2026-07-21 10:00:00+09'),
  ( 6, 1, '勤怠を提出する',
    NULL,
    CURRENT_DATE - 10, 'done', false, 1, TIMESTAMPTZ '2026-07-21 10:00:00+09', TIMESTAMPTZ '2026-07-21 10:00:00+09'),
  ( 7, 1, '旧システムの棚卸し',
    '完了済み。参考のため保管。',
    NULL, 'done', true, 2, TIMESTAMPTZ '2026-07-21 10:00:00+09', TIMESTAMPTZ '2026-07-21 10:00:00+09'),
  ( 8, 2, '洗剤を買う',
    '詰め替え用。',
    CURRENT_DATE - 1, 'todo', false, 1, TIMESTAMPTZ '2026-07-21 10:00:00+09', TIMESTAMPTZ '2026-07-21 10:00:00+09'),
  ( 9, 2, '部屋を片付ける',
    NULL,
    NULL, 'todo', false, 2, TIMESTAMPTZ '2026-07-21 10:00:00+09', TIMESTAMPTZ '2026-07-21 10:00:00+09'),
  (10, 2, 'クリーニングを取りに行く',
    '受付票は財布の中。',
    CURRENT_DATE + 1, 'doing', false, 1, TIMESTAMPTZ '2026-07-21 10:00:00+09', TIMESTAMPTZ '2026-07-21 10:00:00+09'),
  (11, 2, 'ゴミ出し',
    NULL,
    CURRENT_DATE, 'done', false, 1, TIMESTAMPTZ '2026-07-21 10:00:00+09', TIMESTAMPTZ '2026-07-21 10:00:00+09'),
  (12, 2, '冬物をしまう',
    '来シーズンまで保管。',
    NULL, 'done', true, 2, TIMESTAMPTZ '2026-07-21 10:00:00+09', TIMESTAMPTZ '2026-07-21 10:00:00+09'),
  (13, 3, 'Spring BootのREST APIを実装する',
    'GETのみ先に作る。Controller / Service / Repository の3層に分ける。',
    CURRENT_DATE + 3, 'doing', false, 1, TIMESTAMPTZ '2026-07-21 10:00:00+09', TIMESTAMPTZ '2026-07-21 10:00:00+09'),
  (14, 3, 'JPAのN+1問題を調べる',
    'Spring Data JPA の join fetch と IN句によるまとめ取得の違いを整理する。',
    CURRENT_DATE + 7, 'todo', false, 1, TIMESTAMPTZ '2026-07-21 10:00:00+09', TIMESTAMPTZ '2026-07-21 10:00:00+09'),
  (15, 3, '技術書を1冊読み終える',
    NULL,
    NULL, 'done', true, 1, TIMESTAMPTZ '2026-07-21 10:00:00+09', TIMESTAMPTZ '2026-07-21 10:00:00+09');

-- ============================================================
-- card_label（16件）
-- card 3, 6, 9, 11 は意図的にラベル0件のままにしている（labels: [] の確認用）。
-- ============================================================
INSERT INTO card_label (card_id, label_id) VALUES
  (1, 1), (1, 2),
  (2, 3),
  (4, 2),
  (5, 1), (5, 2), (5, 3),
  (7, 1),
  (8, 4), (8, 6),
  (10, 6),
  (12, 5),
  (13, 7),
  (14, 7), (14, 8),
  (15, 8);

-- ============================================================
-- シーケンス補正
-- ============================================================
-- TRUNCATE ... RESTART IDENTITY でシーケンス（次に採番される値）は1に戻るが、
-- 上のINSERTはすべてidを明示しているため、シーケンス自体は1のまま進んでいない。
-- この状態のまま将来のWrite系API（POSTなど）がidを省略してINSERTすると、
-- シーケンスは1から採番し直してしまい、既存の主キー(id=1など)と衝突してエラーになる。
-- そこで「次にnextval()が返す値」を、各テーブルの現在の最大id+1に補正しておく。
-- pg_get_serial_sequence() はテーブル名・列名から、IDENTITY列の実体であるシーケンス名を返す。
-- setval() の第3引数 false は「次のnextval()がこの値そのものを返す」という意味
-- （省略した場合のtrue相当だと、次のnextval()はこの値+1を返してしまい1つずれる）。
-- COALESCE(..., 0) は、万一該当テーブルが空だった場合にMAX(id)がNULLになるのを防ぐ安全策。
SELECT setval(pg_get_serial_sequence('board', 'id'), COALESCE((SELECT MAX(id) FROM board), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('label', 'id'), COALESCE((SELECT MAX(id) FROM label), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('card',  'id'), COALESCE((SELECT MAX(id) FROM card),  0) + 1, false);
-- card_label は複合主キー（card_id, label_id）でIDENTITY列を持たないため、シーケンス補正の対象外。

COMMIT;
