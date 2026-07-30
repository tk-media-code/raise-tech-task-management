package com.tkmedia.taskmanagement.controller;

import com.tkmedia.taskmanagement.dto.BoardCreateRequest;
import com.tkmedia.taskmanagement.dto.BoardResponse;
import com.tkmedia.taskmanagement.dto.LabelCreateRequest;
import com.tkmedia.taskmanagement.dto.LabelResponse;
import com.tkmedia.taskmanagement.service.BoardService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;

/**
 * ボードに関するHTTPリクエストの受け口となるController。
 * URLとHTTPメソッドに応じた処理の振り分けのみを担当し、業務ロジックはBoardServiceに委譲する。
 */
// @RestController は @Controller（このクラスをIoCコンテナに登録し、リクエストの振り分け先にする）と
// @ResponseBody（戻り値のオブジェクトをそのままレスポンスボディに書き込む。Jacksonが自動でJSONへ
// 変換する）を組み合わせたアノテーション。画面(HTML)のテンプレート名として戻り値を解決する
// @Controller単体の挙動とは異なり、このプロジェクトはREST APIサーバーなので常にこちらを使う。
// @RequestMapping("/api/boards") はこのControllerの全メソッドに共通するURLの接頭辞。
@RestController
@RequestMapping("/api/boards")
public class BoardController {

	private final BoardService boardService;

	public BoardController(BoardService boardService) {
		this.boardService = boardService;
	}

	/**
	 * ボード一覧を取得する。
	 *
	 * @return ボード一覧（0件でもHTTP 200・空配列で返す）
	 */
	@GetMapping
	public List<BoardResponse> list() {
		return boardService.findAll();
	}

	/**
	 * ボードを1件取得する。
	 *
	 * @param id ボードID（URLパスの{id}部分。@PathVariableでここに束縛される）
	 * @return 該当ボード。存在しなければServiceが投げた例外をGlobalExceptionHandlerが404に変換する
	 */
	@GetMapping("/{id}")
	public BoardResponse get(@PathVariable Integer id) {
		return boardService.findById(id);
	}

	/**
	 * 指定ボードに属するラベル一覧を取得する。
	 *
	 * @param id ボードID
	 * @return ラベル一覧（ラベルが0件ならHTTP 200・空配列。ボード自体が存在しなければ404）
	 */
	@GetMapping("/{id}/labels")
	public List<LabelResponse> listLabels(@PathVariable Integer id) {
		return boardService.findLabelsByBoardId(id);
	}

	/**
	 * ボードを新規作成する。
	 *
	 * @param request リクエストボディ（ボード名）。{@code @Valid}によりBean Validationが
	 *                このメソッドの実行前に検証する（CardController.createと同じ仕組み）
	 * @return 作成したボード（HTTPステータス201、{@code Location}ヘッダーに作成先URLを添えて返す）
	 */
	@PostMapping
	public ResponseEntity<BoardResponse> create(@Valid @RequestBody BoardCreateRequest request) {
		BoardResponse created = boardService.create(request);
		return ResponseEntity.created(URI.create("/api/boards/" + created.id())).body(created);
	}

	/**
	 * 指定ボードにラベルを新規作成する（要件定義5.5 ラベル管理）。
	 *
	 * @param id      ボードID
	 * @param request リクエストボディ（ラベル名・色）。{@code @Valid}によりBean Validationが
	 *                このメソッドの実行前に検証する（create（ボード作成）と同じ仕組み）
	 * @return 作成したラベル（HTTPステータス201）。ボードが存在しなければ404、色がパレット外・
	 *         同名ラベルが既に存在する場合は400（いずれもServiceが投げた例外をGlobalExceptionHandlerが変換）
	 */
	@PostMapping("/{id}/labels")
	public ResponseEntity<LabelResponse> createLabel(
			@PathVariable Integer id, @Valid @RequestBody LabelCreateRequest request) {
		LabelResponse created = boardService.createLabel(id, request);
		// ラベル単体を返すGETエンドポイント（/api/boards/{id}/labels/{labelId}相当）が無いため、
		// Locationは代わりに一覧取得エンドポイント（listLabelsと同じURL）を指す。
		return ResponseEntity.created(URI.create("/api/boards/" + id + "/labels")).body(created);
	}
}
