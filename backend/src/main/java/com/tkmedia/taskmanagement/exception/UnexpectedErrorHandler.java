package com.tkmedia.taskmanagement.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;

/**
 * どのハンドラにも捕まらなかった想定外の例外を、最後に受け止めるフォールバック。
 *
 * <p>{@link GlobalExceptionHandler}とあえてクラスを分けている。あちらは
 * {@code @Order(Ordered.HIGHEST_PRECEDENCE)}で「最初に評価される」位置にあり、そこへ
 * {@code @ExceptionHandler(Exception.class)}を足すと、Spring MVCが投げるフレームワーク由来の
 * 例外——存在しないURLの{@code NoResourceFoundException}（404）、壊れたJSONの
 * {@code HttpMessageNotReadableException}（400）など——まで軒並みこちらが捕まえてしまい、
 * 本来404・400で返るべきものが一律500になる。
 *
 * <p>フォールバックは「他のどれにも当てはまらなかったもの」を受ける役目なので、
 * 優先順位はその逆——{@code LOWEST_PRECEDENCE}でなければならない。「例外の型による絞り込み」
 * だけでなく「アドバイスの評価順」もハンドラ選択に効く、というのがこのクラスを分けた理由。
 */
@RestControllerAdvice
@Order(Ordered.LOWEST_PRECEDENCE)
public class UnexpectedErrorHandler {

	/** 想定外の例外の詳細（スタックトレース含む）を記録するためのロガー。 */
	private static final Logger LOG = LoggerFactory.getLogger(UnexpectedErrorHandler.class);

	/**
	 * 想定外の例外をHTTP 500のレスポンスに変換する。
	 *
	 * @param ex      どのハンドラにも捕まらなかった例外
	 * @param request リクエストパス（instanceフィールドとログに使う）
	 * @return RFC 9457形式のエラー本文。原因の詳細は含めない（下記コメント参照）
	 */
	@ExceptionHandler(Exception.class)
	public ProblemDetail handleUnexpectedError(Exception ex, HttpServletRequest request) {
		// 詳細はサーバーのログにだけ残す。第3引数に例外を渡すとスタックトレースまで出力される。
		LOG.error("想定外のエラーが発生しました（path={}）", request.getRequestURI(), ex);

		// クライアントへは原因を返さない。例外メッセージにはSQLの断片・テーブル名・
		// ファイルパスといった内部構造の手がかりが含まれることがあり、それをそのまま
		// 返すのは攻撃者への情報提供になりうるため（他のハンドラがex.getMessage()を
		// そのまま返しているのは、あちらが「アプリが意図して投げた、利用者に見せてよい
		// メッセージ」だけを対象にしているから、という違いがある）。
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(
				HttpStatus.INTERNAL_SERVER_ERROR, "サーバー側で予期しないエラーが発生しました");
		problem.setTitle("サーバーエラー");
		problem.setInstance(URI.create(request.getRequestURI()));
		return problem;
	}
}
