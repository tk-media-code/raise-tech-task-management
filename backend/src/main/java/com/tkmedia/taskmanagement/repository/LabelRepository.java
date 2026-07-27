package com.tkmedia.taskmanagement.repository;

import com.tkmedia.taskmanagement.entity.Label;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * {@link Label} エンティティに対するデータアクセスを担うRepository。
 */
public interface LabelRepository extends JpaRepository<Label, Integer> {

	/**
	 * 指定したボードに属するラベルを、作成順（ID昇順）で取得する。
	 *
	 * @param boardId 絞り込み対象のボードID
	 * @return 該当ボードのラベル一覧（0件の場合は空リスト）
	 */
	// findByBoardId は Label.board（@ManyToOne）の先の id を辿るプロパティ式で、
	// 「label テーブルの board_id 列」への単純な等値比較になる。Board への実際のJOINは発生しない
	// （Label 側の外部キー列を直接比較するだけで済むため）。
	List<Label> findByBoardIdOrderByIdAsc(Integer boardId);
}
