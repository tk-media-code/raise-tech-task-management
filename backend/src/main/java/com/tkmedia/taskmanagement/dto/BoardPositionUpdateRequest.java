package com.tkmedia.taskmanagement.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * ボードの並べ替えAPI（{@code PATCH /api/boards/{id}/position}）のリクエストボディを表すDTO。
 * ボード管理モーダルでの `⠿` ドラッグ、および `▲`/`▼` ボタンによる並べ替え、
 * どちらの操作導線もこのDTOに集約する。
 *
 * @param position 並べ替え後の一覧内での挿入位置（0始まりのインデックス）
 */
// CardStatusUpdateRequest.positionは「未指定(null)なら列の末尾に挿入」という意味を持たせるため
// nullを許容しているが、こちらは@NotNullで必須にしている。ボードの並べ替えには
// 「ステータス変更のついでに、位置は指定せずとりあえず動かす」に相当する呼び出し元
// （カード詳細モーダルのステータス選択のような）が存在せず、常にドラッグ操作か▲▼ボタンの
// クリックという「明確な移動先が1つ決まっている」操作からしか呼ばれないため、
// 「省略時は末尾へ」という緩さを持たせる理由が無い。
public record BoardPositionUpdateRequest(
		@NotNull(message = "位置を指定してください")
		@PositiveOrZero(message = "位置は0以上で指定してください") Integer position) {
}
