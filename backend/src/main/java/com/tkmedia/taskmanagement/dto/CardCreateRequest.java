package com.tkmedia.taskmanagement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

/**
 * カード新規作成API（{@code POST /api/cards}）のリクエストボディを表すDTO。
 * {@code @Valid}と組み合わせてControllerの引数に置くことで、Bean Validationがこのrecordの
 * 各コンポーネントに付いたアノテーション（{@code @NotNull}など）を自動的に検証する
 * （docs/spring-boot/09-write-api-validation.md 29章参照）。
 *
 * @param boardId     所属させるボードのID（必須）。存在しないIDの場合、Service層が404を返す
 * @param title       タイトル（必須。空文字・空白のみは不可）
 * @param description 説明・メモ（任意）。未指定・空白のみの場合はService層でnullに正規化される
 * @param dueDate     期日（任意）。過去の日付も許可する（詳細はクラスコメント参照）
 * @param labelIds    付与するラベルのID一覧（任意）。指定した全IDが{@code boardId}のボードに
 *                    実在しない場合、Service層が400を返す
 */
// CardSearchCondition（検索条件DTO）と同じく、「未入力の正規化」「重複除去」といった判断は
// このrecordのコンパクトコンストラクタに書かず、CardService側に集約する。
// DTOの役割は「リクエストボディの形をJavaの型として受け止めること」に留める。
//
// dueDateに @FutureOrPresent を付けていない理由:
// 一見「期日なら未来のはず」に思えるが、要件定義のDueDateBadge（frontend/src/lib/dueDate.ts）は
// 「期限切れ（過去の期日）」を🔴で表示する仕様であり、過去日は不正な入力ではなく正当なユースケース
// （締切を過ぎたタスクをそのまま記録しておきたい場合など）。バリデーションは「形式として不正」な
// 値だけを弾き、「業務上あり得なくはない」値を弾かないようにする。
//
// descriptionに @Size を付けていない理由:
// エンティティ側もtext型（長さ制限なし）であり、要件定義にも上限の規定がない。
// titleにだけ @Size(max = 200) を付けているのは、Card.titleがvarchar(200)というDBの実カラム長に
// 対応させるため（超過した場合にDBのエラーではなく、フィールドを名指しした400を返せるようにする）。
public record CardCreateRequest(
		@NotNull(message = "ボードを指定してください") Integer boardId,
		@NotBlank(message = "タイトルを入力してください") @Size(max = 200, message = "タイトルは200文字以内で入力してください") String title,
		String description,
		LocalDate dueDate,
		List<Integer> labelIds) {
}
