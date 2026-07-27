package com.tkmedia.taskmanagement.service;

import com.tkmedia.taskmanagement.dto.BoardResponse;
import com.tkmedia.taskmanagement.dto.LabelResponse;
import com.tkmedia.taskmanagement.entity.Board;
import com.tkmedia.taskmanagement.entity.Label;
import com.tkmedia.taskmanagement.exception.ResourceNotFoundException;
import com.tkmedia.taskmanagement.repository.BoardRepository;
import com.tkmedia.taskmanagement.repository.LabelRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * ボードに関する業務ロジックを担うService。
 * Controllerとデータアクセス層（Repository）の間に立ち、エンティティをレスポンス用DTOへ
 * 詰め替える処理や、「存在しないのか、単に0件なのか」といった判断をここに集約する。
 */
// @Service: このクラスをIoCコンテナに登録するための目印（docs/spring-boot/01-architecture.md 3章）。
// クラス単位の @Transactional(readOnly = true): このServiceのメソッドは全て参照系（更新を行わない）
// なので、クラスにまとめて付与する。効果は3つ:
//   1. open-in-view=false の下では、トランザクションの範囲＝永続化コンテキストの寿命になる。
//      DTOへの詰め替え（遅延ロードされたboardへのアクセス含む）をこの中で完結させることで、
//      「トランザクションの外で遅延ロードに触れて例外」という事故を防ぐ。
//   2. readOnly=true により Hibernate が更新検知（ダーティチェック）を省略できる。参照系では
//      不要な処理なので、その分だけオーバーヘッドを削れる。
//   3. importは org.springframework.transaction.annotation.Transactional を使うこと。
//      よく似た jakarta.transaction.Transactional には readOnly 属性が無いため、
//      import を間違えるとコンパイルは通ってもreadOnlyの効果が得られない点に注意。
@Service
@Transactional(readOnly = true)
public class BoardService {

	private final BoardRepository boardRepository;
	private final LabelRepository labelRepository;

	// コンストラクタインジェクション。IoCコンテナ（ApplicationContext）が起動時に
	// BoardRepository・LabelRepositoryのBeanをここへ自動的に渡してくれる
	// （docs/spring-boot/01-architecture.md 3章参照）。
	public BoardService(BoardRepository boardRepository, LabelRepository labelRepository) {
		this.boardRepository = boardRepository;
		this.labelRepository = labelRepository;
	}

	/**
	 * 全ボードを表示順で取得する。
	 *
	 * @return ボード一覧のDTO
	 */
	public List<BoardResponse> findAll() {
		return boardRepository.findAllByOrderByPositionAscIdAsc().stream()
				.map(BoardService::toResponse)
				.toList();
	}

	/**
	 * 指定IDのボードを1件取得する。
	 *
	 * @param id ボードID
	 * @return ボードのDTO
	 * @throws ResourceNotFoundException 該当ボードが存在しない場合
	 */
	public BoardResponse findById(Integer id) {
		Board board = boardRepository.findById(id)
				.orElseThrow(() -> new ResourceNotFoundException("ボードが見つかりません（id=" + id + "）"));
		return toResponse(board);
	}

	/**
	 * 指定ボードに属するラベル一覧を取得する。
	 *
	 * @param boardId ボードID
	 * @return ラベル一覧のDTO（ラベルが0件の場合は空リスト）
	 * @throws ResourceNotFoundException 指定ID自体のボードが存在しない場合
	 */
	public List<LabelResponse> findLabelsByBoardId(Integer boardId) {
		// 先にボードの存在だけを確認する。これを省くと「存在しないボードのラベル一覧」も
		// 「ラベルがまだ1つも無いボード」も同じ空配列([])として返ってしまい、
		// クライアント側がboardId自体の指定ミスに気づけなくなるため、明確に区別する。
		if (!boardRepository.existsById(boardId)) {
			throw new ResourceNotFoundException("ボードが見つかりません（id=" + boardId + "）");
		}
		return labelRepository.findByBoardIdOrderByIdAsc(boardId).stream()
				.map(BoardService::toResponse)
				.toList();
	}

	// エンティティをDTOへ変換する処理。DBアクセスを伴わない単純な詰め替えだが、
	// 「エンティティをController・APIレスポンスへ漏らさない」という責務をService層に閉じ込めておく。
	private static BoardResponse toResponse(Board board) {
		return new BoardResponse(board.getId(), board.getName(), board.getPosition(), board.getCreatedAt());
	}

	private static LabelResponse toResponse(Label label) {
		return new LabelResponse(label.getId(), label.getName(), label.getColor());
	}
}
