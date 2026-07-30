package com.tkmedia.taskmanagement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * ラベル新規作成API（{@code POST /api/boards/{id}/labels}）のリクエストボディを表すDTO。
 * {@code @Valid}と組み合わせてControllerの引数に置くことで、Bean Validationがこのrecordの
 * 各コンポーネントに付いたアノテーションを自動的に検証する
 * （docs/spring-boot/09-write-api-validation.md 29章参照）。
 *
 * @param name  ラベル名（必須。空文字・空白のみは不可）。同一ボード内での重複はService層が検証する
 * @param color 色（必須）。あらかじめ用意された色パレットに含まれるかはService層が検証する
 */
// colorに@Patternのような形式チェックを付けていない理由:
// 「許可された色パレットに含まれているか」は、CardCreateRequestのlabelIds（29章参照）と同じく
// DBの内容（あるいはアプリケーションが持つ許可リスト）と突き合わせないと判断できないビジネスルール
// であり、リクエストの形だけを見るBean Validationの役割ではない。ここでは「空でないこと」という
// 形式チェックだけをDTOに置き、パレット内かどうかの判断はBoardService.createLabelに委ねる
// （CardCreateRequestがdueDateに@FutureOrPresentをあえて付けていないのと同じ、
// 「形式検証」と「業務ルール検証」を分離する考え方）。
//
// max = 30 の根拠:
// 要件定義5.5にはラベル名の文字数上限の規定が無いが、プロトタイプ（prototype/app.js）の
// ラベル作成フォームがmaxlength="30"を採用しているため、それに揃えた。
public record LabelCreateRequest(
		@NotBlank(message = "ラベル名を入力してください") @Size(max = 30, message = "ラベル名は30文字以内で入力してください") String name,
		@NotBlank(message = "色を選択してください") String color) {
}
