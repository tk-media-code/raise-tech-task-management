package com.tkmedia.taskmanagement.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;

/**
 * アプリ全体の例外を1箇所で受け止め、統一したエラーレスポンスに変換するクラス。
 * 各Controllerのメソッドに個別のtry-catchを書かずに済み、「業務処理」と「エラー応答の形式」
 * という2つの関心事を分離できる（横断的関心事の集約）。
 */
// @RestControllerAdvice は @ControllerAdvice（例外ハンドラをアプリ全体に適用する）と
// @ResponseBody（戻り値をレスポンスボディにそのまま書き込む）を組み合わせたアノテーション。
// アプリ内のどのController（BoardController・CardControllerなど）で例外が発生しても、
// このクラスの @ExceptionHandler が横断的に呼び出される。
@RestControllerAdvice
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
}
