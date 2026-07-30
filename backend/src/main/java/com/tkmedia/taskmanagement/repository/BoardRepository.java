package com.tkmedia.taskmanagement.repository;

import com.tkmedia.taskmanagement.entity.Board;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

/**
 * {@link Board} エンティティに対するデータアクセスを担うRepository。
 */
// JpaRepository<Board, Integer> を継承するだけで、findById・findAll・existsById・count
// といった基本的なCRUDメソッドが実装なしで使えるようになる。実装クラスはSpring Data JPAが
// アプリ起動時にプロキシとして自動生成するため、このインターフェース自身に処理は書かない。
// インターフェースにJPQL/SQLを一切書かなくても動くため、@Repository（コンポーネントスキャン対象の目印）
// を明示しなくても、Spring Data JPAの仕組みがBeanとして登録してくれる。
public interface BoardRepository extends JpaRepository<Board, Integer> {

	/**
	 * 全ボードを、一覧表示用の順序（表示順→ID）で取得する。
	 *
	 * @return position昇順、position が同値の場合はid昇順のボード一覧
	 */
	// メソッド名からSpring Data JPAがクエリを自動生成する「クエリメソッド」。
	// findAllByOrderByPositionAscIdAsc という名前を「findAllBy」+「OrderBy」+「PositionAsc」+「IdAsc」
	// と機械的に分解し、「select b from Board b order by b.position asc, b.id asc」相当のJPQLに変換される。
	// position の値が重複しても表示順が実行のたびに揺れないよう、第2キーとしてidを加えている。
	List<Board> findAllByOrderByPositionAscIdAsc();

	/**
	 * 現在使われている最大のposition値を取得する。
	 * ボード新規作成時、この戻り値+1を新しいボードのpositionとして採番するために使う
	 * （docs/spring-boot/09-write-api-validation.md 31章参照）。
	 *
	 * @return 現在の最大position。ボードが1件も無い場合は0
	 */
	// CardRepository.findMaxPositionと同じ理由でcoalesceを使う（集約関数maxは対象行が0件だと
	// SQL標準上NULLを返すため、coalesceでSQL側に既定値0を持たせておく）。
	// ボードにはCardと違い「同一ステータス内」のような絞り込み単位が無いため、WHERE句を持たない
	// 全件対象のシンプルな集計になる。
	@Query("select coalesce(max(b.position), 0) from Board b")
	Integer findMaxPosition();
}
