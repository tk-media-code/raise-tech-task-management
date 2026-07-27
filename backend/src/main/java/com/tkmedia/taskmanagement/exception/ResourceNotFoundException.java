package com.tkmedia.taskmanagement.exception;

/**
 * 指定されたIDのリソース（ボード・カードなど）が存在しないときにService層が投げる例外。
 * {@link GlobalExceptionHandler} がこの例外を捕まえ、HTTP 404（Not Found）としてレスポンスに変換する。
 */
// RuntimeException（非検査例外）を継承しているのは、呼び出し元のControllerに
// throws宣言やtry-catchを強制せずに済ませるため。Serviceで投げたこの例外は
// Controllerを素通りして @RestControllerAdvice（GlobalExceptionHandler）まで届く。
// ボード用・カード用に例外クラスを分けていないのは、返すHTTPステータス（404）と
// レスポンスの形（ProblemDetail）が共通で、区別する必要があるのはメッセージ文言だけのため。
public class ResourceNotFoundException extends RuntimeException {

	/**
	 * @param message 「何が見つからなかったか」を表す、ProblemDetailのdetailにそのまま使われるメッセージ
	 */
	public ResourceNotFoundException(String message) {
		super(message);
	}
}
