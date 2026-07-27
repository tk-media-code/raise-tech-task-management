package com.tkmedia.taskmanagement.dto;

/**
 * ラベルのレスポンスDTO。
 * {@code GET /api/boards/{id}/labels}（ボード単位のラベル一覧）と、
 * {@link CardResponse#labels()}（カードに付与されたラベルの一覧）の両方で共用する。
 * どちらの文脈でも「所属ボードのID」は呼び出し元（パスの{id}、あるいは親のboardId）に
 * 既に現れているため、このDTO自体にはboardIdを持たせない。
 *
 * @param id    ラベルID
 * @param name  ラベル名
 * @param color ラベルの色（既定パレットのカラーコード。例: "#e74c3c"）
 */
public record LabelResponse(Integer id, String name, String color) {
}
