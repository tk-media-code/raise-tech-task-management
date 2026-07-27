package com.tkmedia.taskmanagement.dto;

import java.util.List;

/**
 * カード一覧API（{@code GET /api/cards}）の絞り込み条件をまとめたDTO。
 * Controllerが受け取った4つの {@code @RequestParam} をここに詰めてServiceへ渡す。
 * 同じような型（Integer / Boolean / String / List）が並ぶ4引数のメソッドは
 * 引数の順序を間違えやすいため、名前の付いたまとまりとして受け渡しする。
 *
 * @param boardId  絞り込み対象のボードID（未指定の場合はnull＝全ボード対象）
 * @param archived アーカイブ済みで絞り込むかどうか（未指定の場合はnull＝非アーカイブのみを表す）
 * @param keyword  タイトル・説明に対する部分一致キーワード（未指定の場合はnull＝絞り込みなし）
 * @param labelIds 付与ラベルによる絞り込み（いずれか1つでも付いていればヒット。未指定の場合はnullまたは空リスト）
 */
// 「未入力（null）と空文字・空リストの正規化」「archivedのnull→falseへの変換」といった
// 業務ルールはこのrecordのコンパクトコンストラクタには持たせず、CardService側で行う。
// DTOはあくまで「Controllerが受け取った値をそのまま運ぶ入れ物」に留め、
// 判断ロジックをService層に集約した方が、責務の境界が分かりやすいため。
public record CardSearchCondition(Integer boardId, Boolean archived, String keyword, List<Integer> labelIds) {
}
