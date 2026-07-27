package com.tkmedia.taskmanagement.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * カード一覧・カード詳細APIのレスポンスとして返すDTO。
 * 所属ボードの名前（boardName）と、付与されたラベルの一覧（labels）をカード自身の
 * 属性と一緒にネストして返す。フロントエンドが1回のリクエストで画面に必要な情報を
 * 揃えられるようにするための構成。
 *
 * @param id          カードID
 * @param boardId     所属ボードのID
 * @param boardName   所属ボードの名前（一覧・横断ビューでボード名を都度引く手間を省くための冗長化）
 * @param title       タイトル
 * @param description 説明・メモ（未設定の場合はnull）
 * @param dueDate     期日（未設定の場合はnull）
 * @param status      ステータス（"todo" / "doing" / "done"）
 * @param isArchived  アーカイブ済みかどうか
 * @param position    同一ステータス内での表示順
 * @param labels      付与されたラベルの一覧（0件の場合は空配列。nullにはしない）
 */
public record CardResponse(
		Integer id,
		Integer boardId,
		String boardName,
		String title,
		String description,
		LocalDate dueDate,
		String status,
		Boolean isArchived,
		Integer position,
		List<LabelResponse> labels) {

	// --- なぜエンティティ(Card)を直接returnしないのか ---
	// 1. Card.board は @ManyToOne(fetch = LAZY) であり、トランザクションの外側
	//    （このAPIではJacksonがJSONに変換するタイミング）でアクセスすると、
	//    open-in-view=false の設定下では LazyInitializationException になる。
	//    トランザクション内であっても、エンティティをそのまま返すとJacksonが
	//    board や labels 相当の関連を辿ろうとして意図しない追加SQL（N+1）を招きやすい。
	// 2. エンティティを直接返すと「DBのテーブル構造」が「APIの応答形式」と直結してしまい、
	//    DB側のリファクタリング（カラム名変更など）がそのままAPIの破壊的変更になる。
	//    DTOを1枚挟むことで、DBの都合とAPI利用者への契約を分離できる。
	// このDTOへの詰め替えは CardService（Service層）が @Transactional の中で行う。
}
