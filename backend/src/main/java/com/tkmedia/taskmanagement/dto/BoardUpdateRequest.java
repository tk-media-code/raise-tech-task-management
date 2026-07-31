package com.tkmedia.taskmanagement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * ボード名変更API（{@code PUT /api/boards/{id}}）のリクエストボディを表すDTO。
 *
 * @param name 変更後のボード名（必須。空文字・空白のみは不可）
 */
// BoardCreateRequestと制約の中身（@NotBlank・@Size(max = 50)）は同じだが、あえて別のrecordに分けている。
// CardCreateRequestとCardUpdateRequestを分けているのと同じ理由で、「作成」と「更新」は
// 今は形が同じでも将来別々の理由で変わりうる（例えば更新だけ楽観ロック用のバージョン番号を
// 持たせる、といった変更が片方にだけ入る可能性がある）うえ、DTOの型名自体が
// 「このリクエストがどのAPIのものか」を表す説明になる。
public record BoardUpdateRequest(
		@NotBlank(message = "ボード名を入力してください") @Size(max = 50, message = "ボード名は50文字以内で入力してください") String name) {
}
