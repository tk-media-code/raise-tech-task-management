package com.tkmedia.taskmanagement.repository;

import com.tkmedia.taskmanagement.entity.CardLabel;
import com.tkmedia.taskmanagement.entity.CardLabelId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

	/**
	 * 指定カードに紐づくcard_label行をすべて削除する。
	 * カード編集時、ラベルの付与内容を「一度すべて削除してから、選び直されたものを入れ直す」方式で
	 * 更新するために使う（差分だけを削除・追加する方式にしない理由はCardService.update参照）。
	 *
	 * @param cardId 対象カードのID
	 */
	// メソッド名を deleteByIdCardId（idの中のcardIdを辿る派生クエリ）にする方法もあるが、
	// その場合Spring Data JPAは「まずSELECTで対象行を読み込み、1行ずつEntityManager.removeを呼ぶ」
	// という実装になり、対象がN件あればSELECT 1回＋DELETE N回のSQLが発行される。
	// CardLabelは他のエンティティからJPAレベルのcascade（永続化の連鎖）を受けない中間テーブルの
	// 行であり、読み込みを経由せず一括削除しても永続化コンテキストとの整合性が崩れる心配が無いため、
	// @ModifyingでJPQLのDELETE文1本だけを発行する形にしている。
	//
	// @Modifying を付けたJPQLは、呼び出された時点でDBへ直接DELETE文を発行する
	// （create()のcard_label INSERTのように、フラッシュのタイミングまで遅延しない）。
	// そのためCardService.updateでこのメソッドを呼んだ直後にsaveAllで新しい行を追加しても、
	// 同じラベルIDを選び直した場合に一意制約違反にはならない（削除が先に完了しているため）。
	@Modifying
	@Query("delete from CardLabel cl where cl.id.cardId = :cardId")
	void deleteByCardId(@Param("cardId") Integer cardId);
}
