package com.tkmedia.taskmanagement.dto;

import java.time.OffsetDateTime;

/**
 * ボード一覧・ボード詳細APIのレスポンスとして返すDTO（Data Transfer Object）。
 * {@link com.tkmedia.taskmanagement.entity.Board} エンティティをそのまま返さず、
 * このレコードに詰め替えてから返す（理由は {@link com.tkmedia.taskmanagement.dto.CardResponse} のJavadoc参照）。
 *
 * @param id        ボードID
 * @param name      ボード名
 * @param position  ボード一覧での表示順
 * @param createdAt 作成日時
 */
// Java 25 の record。フィールド・コンストラクタ・getter（id() のようなアクセサ）・
// equals()/hashCode()/toString() をこの1行の宣言だけで自動生成してくれる「不変の入れ物」。
// DTOは「値を運ぶだけ」の役割なので、Lombok不使用のこのプロジェクトでは
// 手書きgetter/setterのクラスより record の方が本質に合っている。
// レコードのコンポーネント（id, name, ...）の宣言順が、そのままJSON化した際のキーの出力順になる。
public record BoardResponse(Integer id, String name, Integer position, OffsetDateTime createdAt) {
}
