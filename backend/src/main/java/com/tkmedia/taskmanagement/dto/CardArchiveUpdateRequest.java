package com.tkmedia.taskmanagement.dto;

import jakarta.validation.constraints.NotNull;

/**
 * カードのアーカイブ状態変更API（{@code PATCH /api/cards/{id}/archive}）のリクエストボディを表すDTO。
 * アーカイブする操作・アーカイブ一覧から元へ戻す「復元」操作のどちらも、このDTOに集約する
 * （要件定義5.7）。
 *
 * @param archived 変更後のアーカイブ状態（true: アーカイブする / false: 復元する）。
 *                 booleanではなくBooleanで受けるのは、値そのものを省略したリクエスト（null）を
 *                 {@code @NotNull}で検出し「falseを指定し忘れた」のか「未入力」なのかを区別するため
 *                 （CardStatusUpdateRequest.statusと同じ、@NotBlankを使えない値の扱い方の理屈）
 */
public record CardArchiveUpdateRequest(
		@NotNull(message = "アーカイブするかどうかを指定してください") Boolean archived) {
}
