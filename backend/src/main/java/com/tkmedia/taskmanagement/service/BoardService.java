package com.tkmedia.taskmanagement.service;

import com.tkmedia.taskmanagement.dto.BoardCreateRequest;
import com.tkmedia.taskmanagement.dto.BoardResponse;
import com.tkmedia.taskmanagement.dto.LabelCreateRequest;
import com.tkmedia.taskmanagement.dto.LabelResponse;
import com.tkmedia.taskmanagement.entity.Board;
import com.tkmedia.taskmanagement.entity.Label;
import com.tkmedia.taskmanagement.exception.InvalidRequestException;
import com.tkmedia.taskmanagement.exception.ResourceNotFoundException;
import com.tkmedia.taskmanagement.repository.BoardRepository;
import com.tkmedia.taskmanagement.repository.LabelRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

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

	// ラベル作成時に選べる色のプリセットパレット（要件定義5.5「あらかじめ用意された色パレットから
	// 色を選び」）。値はprototype/app.jsのLABEL_COLORS・db/seed/dummy-data.sqlの初期ラベルと
	// 揃えてある。フロントエンド（frontend/src/lib/labelColors.ts）にも同じ8色を持たせており、
	// 両者がずれると「フロントで選べた色がバックエンドで拒否される（400）」という食い違いが起きる
	// ため、変更する際は両方合わせて直すこと。CardServiceのINITIAL_STATUSと同じく、
	// 使う場所（このクラスのcreateLabel）にだけ持たせるprivate static finalの定数にしている。
	private static final Set<String> ALLOWED_LABEL_COLORS = Set.of(
			"#e74c3c", "#e67e22", "#f1c40f", "#2ecc71",
			"#3498db", "#9b59b6", "#e84393", "#7f8c8d");

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

	/**
	 * ボードを新規作成する。
	 *
	 * @param request 作成内容（ボード名）
	 * @return 作成したボードのDTO
	 */
	// クラスに付けた @Transactional(readOnly = true) を、書き込みを行うこのメソッドだけ
	// @Transactional で上書きする（CardService.createと同じ理由。
	// docs/spring-boot/09-write-api-validation.md 31章参照）。
	@Transactional
	public BoardResponse create(BoardCreateRequest request) {
		// nameは@NotBlankで「空白のみ」は弾かれているが、前後の空白そのものは除去されないため、
		// ここでtrimする。
		Board board = new Board();
		board.setName(request.name().trim());
		// 既存の最大position+1を採番する。CardService.createのposition採番と同じく、
		// 同時作成によるレースコンディションの可能性はあるが、個人利用アプリでは許容している。
		board.setPosition(boardRepository.findMaxPosition() + 1);
		// createdAtはBoardエンティティの@CreationTimestampがINSERT時に自動でセットするため、
		// ここでは何もしない。
		Board saved = boardRepository.save(board);
		return toResponse(saved);
	}

	/**
	 * 指定ボードにラベルを新規作成する。
	 *
	 * @param boardId 所属させるボードのID
	 * @param request 作成内容（ラベル名・色）
	 * @return 作成したラベルのDTO
	 * @throws ResourceNotFoundException 指定ボードが存在しない場合
	 * @throws InvalidRequestException   色がパレットに含まれない、または同一ボード内に同名のラベルが
	 *                                   既に存在する場合
	 */
	// CardService.createと同じく、findById().orElseThrow()でボードの存在確認とエンティティの
	// 取得を1回で済ませる（後段でlabel.setBoard(board)にそのまま使うエンティティが要るため、
	// findLabelsByBoardIdのexistsByIdだけで済ませる書き方はここでは採れない）。
	@Transactional
	public LabelResponse createLabel(Integer boardId, LabelCreateRequest request) {
		Board board = boardRepository.findById(boardId)
				.orElseThrow(() -> new ResourceNotFoundException("ボードが見つかりません（id=" + boardId + "）"));

		// 検証の順序は「DBを見なくても分かる形式的な不正」→「DBを見ないと分からない制約」の順にする。
		// パレット外の色は明らかに無意味な値なので、わざわざ重複チェックのSQLを発行する前に弾く。
		if (!ALLOWED_LABEL_COLORS.contains(request.color())) {
			throw new InvalidRequestException("許可されていない色です");
		}
		// nameは@NotBlankで「空白のみ」は弾かれているが、前後の空白そのものは除去されないため、
		// ここでtrimする（BoardCreateRequestのnameと同じ理由）。重複チェックもこのtrim後の値で行う。
		String name = request.name().trim();
		// DBの(board_id, name)にUNIQUE制約は設けていない（LabelRepository.existsByBoardIdAndName
		// のJavadoc参照）ため、アプリ層でのこのチェックが唯一の防衛線になる。
		if (labelRepository.existsByBoardIdAndName(boardId, name)) {
			throw new InvalidRequestException("同じ名前のラベルが既に存在します");
		}

		Label label = new Label();
		label.setBoard(board);
		label.setName(name);
		label.setColor(request.color());
		Label saved = labelRepository.save(label);
		return toResponse(saved);
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
