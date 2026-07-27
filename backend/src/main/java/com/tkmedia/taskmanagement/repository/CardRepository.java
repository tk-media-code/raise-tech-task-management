package com.tkmedia.taskmanagement.repository;

import com.tkmedia.taskmanagement.entity.Card;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * {@link Card} エンティティに対するデータアクセスを担うRepository。
 * カード一覧の絞り込みは条件が4種類（boardId・archived・keyword・labelIds）あり、
 * それぞれ「指定されていれば絞り込み、されていなければ無視する」という任意条件のため、
 * メソッド名からの自動生成では表現しきれない。そのため {@link #search} は {@code @Query} で
 * JPQL（Jakarta Persistence Query Language。テーブルではなくエンティティに対する問い合わせ言語）を直接書く。
 */
// JPQL採用の理由（Specification/Criteria APIを使わなかった理由）:
// このAPIの絞り込み条件は4つで固定であり将来的に激増する見込みもない。
// JPQLはSQLに近い構造で読めるため、SQLを学びながらJPAも学ぶ本プロジェクトの読者にとって
// Criteria APIのRoot/CriteriaBuilder/Subqueryのような専用APIより段差が小さい。
// また、実行されるクエリの全体像が @Query の中に1箇所にまとまって見える点も、
// 複数のstaticメソッドに条件が散らばりがちなSpecificationより読みやすいと判断した。
public interface CardRepository extends JpaRepository<Card, Integer> {

	/**
	 * 4つの任意条件（すべてnull/false可）でカードを絞り込む。
	 * 呼び出し側（CardService）で正規化してから渡すこと。
	 *
	 * @param boardId        ボードIDによる絞り込み。nullなら全ボード対象
	 * @param archived       アーカイブ済みかどうかの一致条件。null-guardはせず常に等値比較する
	 *                       （「未指定＝非アーカイブのみ」という仕様は、呼び出し側がarchived=falseに正規化することで
	 *                       単純な等値比較に落とせるため、ここではガード不要）
	 * @param keyword        タイトル・説明に対する部分一致（大文字小文字を無視）。nullなら絞り込みなし
	 * @param filterByLabels ラベル絞り込みを行うかどうかのフラグ。falseならlabelIdsの中身は無視される
	 * @param labelIds       付与ラベルによる絞り込み対象のラベルID集合（OR条件）。
	 *                       filterByLabels=falseのときは空にできない番兵値が渡される想定（下記コメント参照）
	 * @return 条件に合致するカードを、ボード表示順→ステータス（todo/doing/done）→カード内表示順で並べた一覧
	 */
	@Query("""
			select c
			  from Card c
			  join fetch c.board b
			 where (:boardId is null or b.id = :boardId)
			   and c.isArchived = :archived
			   and (:keyword is null
			        or lower(c.title) like lower(concat('%', cast(:keyword as string), '%'))
			        or lower(c.description) like lower(concat('%', cast(:keyword as string), '%')))
			   and (:filterByLabels = false
			        or exists (select 1
			                     from CardLabel cl
			                    where cl.id.cardId = c.id
			                      and cl.id.labelId in :labelIds))
			 order by b.position asc,
			          b.id asc,
			          case c.status when 'todo' then 1 when 'doing' then 2 when 'done' then 3 else 4 end asc,
			          c.position asc,
			          c.id asc
			""")
	// join fetch c.board : Card.board は fetch = LAZY だが、レスポンス（CardResponse.boardName）に
	// 必要なため、ここで最初から一緒に取得してしまう（fetch join）。@ManyToOne(optional = false) なので
	// 対応するボードが必ず存在し、INNER JOINになっても行が減ったり増えたりしない。
	//
	// (:x is null or ...) というnull-guardの形は、「パラメータが指定されていなければ、
	// そのAND条件全体を常に真にして絞り込みを無効化する」ためのJPQLの定番の書き方。
	//
	// cast(:keyword as string) が必要な理由：:keyword は「is null」という比較にしか
	// 現れない箇所があると、Hibernateがバインドパラメータの型を確定できないことがある。
	// 型が確定しないままPostgreSQLへ送られると、JDBCドライバが型不明のパラメータを
	// bytea（バイナリ列）として扱ってしまい、"function lower(bytea) does not exist" という
	// SQLエラーになる（実際に発生を確認した）。cast(... as string) でJPQL側から明示的に
	// 文字列型だと伝えることで、この型推論の失敗を防いでいる。
	//
	// labelIds の絞り込みだけbooleanフラグを介しているのは、「in :labelIds」に空コレクションを
	// 渡すと「in ()」という不正なSQLになってしまうため。ラベル指定が無いときは
	// filterByLabels=false にしてOR条件の左辺を真にし、右辺（exists句）を評価させない
	// （このときlabelIdsには型を満たすためだけの番兵値が渡っているだけで、実際には参照されない）。
	//
	// order by に c.status をそのまま書くとアルファベット順（doing, done, todo）になり、
	// 画面の列順（todo→doing→done）と食い違ってしまう。case式で明示的に1/2/3を割り当てて防いでいる。
	List<Card> search(@Param("boardId") Integer boardId,
			@Param("archived") boolean archived,
			@Param("keyword") String keyword,
			@Param("filterByLabels") boolean filterByLabels,
			@Param("labelIds") Collection<Integer> labelIds);

	/**
	 * カードをボード情報付きで1件取得する（アーカイブ済みかどうかは問わない）。
	 *
	 * @param id カードID
	 * @return 該当カード。存在しない場合は空
	 */
	@Query("select c from Card c join fetch c.board where c.id = :id")
	Optional<Card> findByIdWithBoard(@Param("id") Integer id);
}
