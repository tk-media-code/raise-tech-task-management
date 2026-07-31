package com.tkmedia.taskmanagement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * カードのステータス変更API（{@code PATCH /api/cards/{id}/status}）のリクエストボディを表すDTO。
 * ドラッグ＆ドロップによる列間移動・列内の並べ替え、カード上の「移動」メニュー、
 * カード詳細モーダルのステータス選択（要件定義5.3）、いずれの操作導線もこのDTOに集約する。
 *
 * @param status   変更後のステータス（"todo" / "doing" / "done"のいずれか。必須）。
 *                 3値以外が指定された場合はService層が400を返す。{@code @Pattern}で縛らないのは、
 *                 CardCreateRequest.labelIdsと同じく「業務ルールの検証はService層に寄せる」方針のため
 * @param position 移動先ステータス列内での挿入位置（0始まりのインデックス）。
 *                 未指定（null）の場合は列の末尾に挿入する（カード詳細モーダルのステータス選択のように、
 *                 列の件数を把握していない呼び出し側からも「とりあえず動かす」操作ができるようにするため）
 */
// @PositiveOrZeroは値がnullの場合は検証をスキップする（Bean Validationの標準的な挙動として、
// 「nullでないこと」は@NotNullの役割であり、他の制約アノテーションはnullを素通りさせる）。
// そのためこのDTOはpositionを「0以上の値、または未指定」として受け付けられる。
public record CardStatusUpdateRequest(
		@NotBlank(message = "ステータスを指定してください") String status,
		@PositiveOrZero(message = "位置は0以上で指定してください") Integer position) {
}
