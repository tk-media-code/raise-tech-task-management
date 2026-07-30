package com.tkmedia.taskmanagement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * ボード新規作成API（{@code POST /api/boards}）のリクエストボディを表すDTO。
 * {@code @Valid}と組み合わせてControllerの引数に置くことで、Bean Validationが
 * {@code name}に付いたアノテーションを自動的に検証する
 * （docs/spring-boot/09-write-api-validation.md 29章参照）。
 *
 * @param name ボード名（必須。空文字・空白のみは不可）
 */
// 同名のボードを複数作成できてしまうことを禁止する制約（一意性）は、あえて設けていない。
// 要件定義5.1にはボード名の一意性についての規定が無く、「仕事」「仕事（2つ目）」のように
// 同名で分けて使いたいケースを勝手に制約で塞いでしまうと、要件を超えた仕様を追加することになる。
// 一意制約が必要になった場合は、要件定義の更新とあわせて@Columnへunique = trueを追加する。
public record BoardCreateRequest(
		@NotBlank(message = "ボード名を入力してください") @Size(max = 50, message = "ボード名は50文字以内で入力してください") String name) {
}
