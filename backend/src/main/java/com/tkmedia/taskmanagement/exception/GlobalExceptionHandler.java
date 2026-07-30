package com.tkmedia.taskmanagement.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * アプリ全体の例外を1箇所で受け止め、統一したエラーレスポンスに変換するクラス。
 * 各Controllerのメソッドに個別のtry-catchを書かずに済み、「業務処理」と「エラー応答の形式」
 * という2つの関心事を分離できる（横断的関心事の集約）。
 */
// @RestControllerAdvice は @ControllerAdvice（例外ハンドラをアプリ全体に適用する）と
// @ResponseBody（戻り値をレスポンスボディにそのまま書き込む）を組み合わせたアノテーション。
// アプリ内のどのController（BoardController・CardControllerなど）で例外が発生しても、
// このクラスの @ExceptionHandler が横断的に呼び出される。
//
// @Order(Ordered.HIGHEST_PRECEDENCE) が必要な理由（実際にこれが無いと起きた事故）:
// spring.mvc.problemdetails.enabled=true にすると、Spring Boot自身が
// MethodArgumentNotValidExceptionなどフレームワークが投げる例外向けに、既定のProblemDetail
// （detail: "Invalid request content." のような定型文）を生成する内部の@ControllerAdviceを
// 自動登録する。この内部アドバイスは既定の優先順位（Ordered.LOWEST_PRECEDENCEより高い）を持つため、
// @Orderを指定しないままだと同点の優先順位の中でこちらが後回しにされ、
// handleValidationErrorを書いても呼ばれずに素通りしてしまう（実機検証で確認した挙動）。
// このクラスに最高優先度を明示することで、必ずこちらが先に呼ばれるようにしている
// （docs/spring-boot/09-write-api-validation.md 30章参照）。
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class GlobalExceptionHandler {

	/**
	 * {@link ResourceNotFoundException} をHTTP 404のレスポンスに変換する。
	 *
	 * @param ex      Service層で投げられた「見つからない」例外
	 * @param request リクエストパス（instanceフィールドに使う）を取得するために受け取る
	 * @return RFC 9457（Problem Details for HTTP APIs）形式のエラー本文
	 */
	@ExceptionHandler(ResourceNotFoundException.class)
	public ProblemDetail handleResourceNotFound(ResourceNotFoundException ex, HttpServletRequest request) {
		// ProblemDetail は Spring Framework 6 以降が持つ、RFC 9457 に沿ったエラー表現のための型。
		// @ExceptionHandler メソッドの戻り値が ProblemDetail の場合、Springがここに設定した
		// status の値をそのままHTTPステータスコードとして使い、Content-Typeも
		// 自動的に application/problem+json にしてくれる（@ResponseStatus は不要）。
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
		problem.setTitle("リソースが見つかりません");
		// instance（今回のエラーが発生したリクエストのパス）はforStatusAndDetailでは
		// 自動的に設定されないため、HttpServletRequestから取得して明示的にセットする。
		problem.setInstance(URI.create(request.getRequestURI()));
		return problem;
	}

	/**
	 * {@link InvalidRequestException} をHTTP 400のレスポンスに変換する。
	 * Bean Validationでは表現できない業務ルール違反（例：他ボードのラベルIDを指定した）が対象
	 * （docs/spring-boot/09-write-api-validation.md 30章参照）。
	 *
	 * @param ex      Service層で投げられた「リクエストが不正」例外
	 * @param request リクエストパス（instanceフィールドに使う）を取得するために受け取る
	 * @return RFC 9457形式のエラー本文
	 */
	@ExceptionHandler(InvalidRequestException.class)
	public ProblemDetail handleInvalidRequest(InvalidRequestException ex, HttpServletRequest request) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
		problem.setTitle("リクエストが不正です");
		problem.setInstance(URI.create(request.getRequestURI()));
		return problem;
	}

	/**
	 * {@code @Valid} が付いた {@code @RequestBody} の検証に失敗したときにSpring MVCが投げる
	 * {@link MethodArgumentNotValidException} をHTTP 400のレスポンスに変換する。
	 * {@link InvalidRequestException} と違い、こちらはServiceに処理が到達する前
	 * （Controllerの引数を組み立てる段階）で発生する（docs/spring-boot/09-write-api-validation.md 30章参照）。
	 *
	 * @param ex      検証に失敗したフィールドの一覧を保持する例外
	 * @param request リクエストパス（instanceフィールドに使う）を取得するために受け取る
	 * @return RFC 9457形式のエラー本文。標準メンバーに加え、フィールド名→エラーメッセージの
	 *         拡張メンバー{@code errors}を持つ（RFC 9457はこうした拡張を許容している）
	 */
	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ProblemDetail handleValidationError(MethodArgumentNotValidException ex, HttpServletRequest request) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "入力内容に誤りがあります");
		problem.setTitle("バリデーションエラー");
		problem.setInstance(URI.create(request.getRequestURI()));

		// getFieldErrors()は「どのフィールドが」「どんな理由で」検証に失敗したかを表す
		// FieldErrorのリスト。フィールド名をキーにしたMapへ詰め替え、フロントエンドが
		// 「どの入力欄の下にエラーメッセージを出すか」を機械的に判定できるようにする。
		// LinkedHashMapにしているのは、DTOでのフィールド宣言順（＝画面での表示順に近い）を
		// そのまま保つため（HashMapだと順序が保証されない）。
		// 同じフィールドに複数のアノテーション違反があった場合は、後勝ちで1件だけが残る
		// （複数エラーの一覧表示までは今回のスコープ外）。
		Map<String, String> errors = new LinkedHashMap<>();
		for (FieldError fieldError : ex.getFieldErrors()) {
			errors.put(fieldError.getField(), fieldError.getDefaultMessage());
		}
		// setPropertyはProblemDetailにRFC 9457標準外の項目を追加するためのメソッド。
		// レスポンスJSONでは他のフィールド（title・detailなど）と同じ階層に"errors"として出力される。
		problem.setProperty("errors", errors);
		return problem;
	}
}
