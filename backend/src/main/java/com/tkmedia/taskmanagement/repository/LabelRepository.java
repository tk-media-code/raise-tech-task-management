package com.tkmedia.taskmanagement.repository;

import com.tkmedia.taskmanagement.entity.Label;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
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

	/**
	 * 指定したボードに属するラベルのうち、指定したID群に一致するものを取得する。
	 * カード新規作成時、リクエストで指定されたラベルIDが「実在するか」だけでなく
	 * 「本当にそのカードが属するボードのラベルか」まで確認するために使う
	 * （docs/spring-boot/09-write-api-validation.md 29章参照）。
	 *
	 * @param boardId 絞り込み対象のボードID
	 * @param ids     絞り込み対象のラベルID集合
	 * @return 条件に合致するラベル一覧
	 */
	// 単なる findAllById(ids)（JpaRepository標準メソッド）ではなく boardId も条件に含めているのが要点。
	// 例えばボードAのカードに対し、ボードBのラベルIDを紛れ込ませたリクエストが来た場合、
	// findAllByIdだけだとそのラベルIDは「実在する」ため素通りしてしまう。boardIdも条件に加えることで、
	// 「IDは実在するが、このボードのものではない」ラベルは戻り値に含まれなくなり、
	// CardService側で「要求した件数 と 実際に見つかった件数 の不一致」として検出できるようになる。
	List<Label> findByBoardIdAndIdIn(Integer boardId, Collection<Integer> ids);
}
