package com.tkmedia.taskmanagement.repository;

import com.tkmedia.taskmanagement.entity.CardLabel;
import com.tkmedia.taskmanagement.entity.CardLabelId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

/**
 * {@link CardLabel}（カードとラベルの中間テーブル）に対するデータアクセスを担うRepository。
 * カード一覧・詳細のレスポンスに「付与されたラベル一覧」をネストするための、
 * カード側から見た逆引き（1枚のカードにどのラベルが付いているか）に使う。
 */
public interface CardLabelRepository extends JpaRepository<CardLabel, CardLabelId> {

	/**
	 * 複数カード分の「カードID→ラベル」の対応を、ラベル情報付きでまとめて取得する。
	 * カードの件数によらずSQLを1回だけ発行するための、N+1回避の要となるメソッド
	 * （docs/spring-boot/07-jpa-performance.md 24章参照）。
	 *
	 * @param cardIds 対象のカードID集合
	 * @return 該当する card_label 行（Labelをfetch join済み）。cardIdごとの並びで返す
	 */
	@Query("""
			select cl
			  from CardLabel cl
			  join fetch cl.label l
			 where cl.id.cardId in :cardIds
			 order by cl.id.cardId asc, l.id asc
			""")
	// 呼び出し側（CardService）は、対象カードのIDをまとめてこのメソッドに渡し、
	// 戻ってきた一覧を cl.getId().getCardId() でグルーピングしてカードごとのlabelsに振り分ける。
	// 「カードN件に対してラベル取得のSQLをN回発行する」のではなく、
	// 「IN句で1回にまとめて取得し、Java側（Serviceのgroupingby）で仕分ける」という方針により、
	// カード件数が増えてもクエリ本数は増えない。
	List<CardLabel> findAllWithLabelByCardIdIn(@Param("cardIds") Collection<Integer> cardIds);
}
