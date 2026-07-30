package com.tkmedia.taskmanagement.exception;

/**
 * リクエストの形式は正しい（＝Bean Validationは通過した）が、業務ルールに反しているときに
 * Service層が投げる例外。{@link GlobalExceptionHandler} がこの例外を捕まえ、
 * HTTP 400（Bad Request）としてレスポンスに変換する。
 */
// @NotBlankや@Sizeのようなアノテーションだけでは表現できない検証がここでの対象になる。
// 例えば「カードに付与しようとしたラベルIDが、実は別のボードに属するラベルだった」というのは、
// リクエストの形（Integerのリストであること）は正しいので@Validでは検出できず、
// Service層でDBの内容と突き合わせて初めて分かる。
//
// ResourceNotFoundException（404）と使い分ける基準は「何を指定したか」ではなく「指定した対象を
// どう扱おうとしたか」。boardIdそのものが存在しなければ404（そのリクエストが指す相手がいない）、
// labelIdsの中に「実在はするが今回の文脈では使えないもの」が混ざっていれば400（相手はいるが、
// この組み合わせでの要求が成立しない）という切り分けにしている。
public class InvalidRequestException extends RuntimeException {

	/**
	 * @param message 「リクエストの何が不正だったか」を表す、ProblemDetailのdetailにそのまま使われるメッセージ
	 */
	public InvalidRequestException(String message) {
		super(message);
	}
}
