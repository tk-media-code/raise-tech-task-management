package com.tkmedia.taskmanagement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

/**
 * カード編集API（{@code PUT /api/cards/{id}}）のリクエストボディを表すDTO。
 * {@code @Valid}と組み合わせてControllerの引数に置くことで、Bean Validationがこのrecordの
 * 各コンポーネントに付いたアノテーションを自動的に検証する
 * （docs/spring-boot/09-write-api-validation.md 29章参照）。
 *
 * @param title       タイトル（必須。空文字・空白のみは不可）
 * @param description 説明・メモ（任意）。未指定・空白のみの場合はService層でnullに正規化される
 * @param dueDate     期日（任意）
 * @param labelIds    付与するラベルのID一覧（任意）。指定した全IDがこのカードの所属ボードに
 *                    実在しない場合、Service層が400を返す
 */
// CardCreateRequestと違い、boardIdとstatusを持たない。
//
// boardId: カードの所属ボードを変更する機能（別のボードへ付け替える）は要件のスコープ外
// （prototype/README.mdに「横断ビュー内でカードを別ボードのセクションへドラッグしても移動しない仕様」
// と明記されている）。そもそも変更する手段が無いので、リクエストにも含めない。
//
// status: ステータス変更はドラッグ＆ドロップ・カード上の「移動」メニュー・カード詳細モーダルの
// ステータス選択という、この編集フォームとは別の操作導線から行われ、「列内の並び順（position）」
// という編集フォームには存在しない情報も一緒に扱う必要がある。そのため専用のCardStatusUpdateRequestと
// PATCH /api/cards/{id}/status に分けている（1つのPUTに全部乗せると、タイトル等を保存するだけの
// 操作でも無関係なpositionの計算・送信が必要になり、責務が混ざってしまう）。
//
// 「未入力の正規化」「重複除去」といった判断は、CardCreateRequestと同じくこのrecordの
// コンパクトコンストラクタには書かず、CardService側に集約する。
public record CardUpdateRequest(
		@NotBlank(message = "タイトルを入力してください") @Size(max = 200, message = "タイトルは200文字以内で入力してください") String title,
		String description,
		LocalDate dueDate,
		List<Integer> labelIds) {
}
