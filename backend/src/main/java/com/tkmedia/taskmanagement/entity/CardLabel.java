package com.tkmedia.taskmanagement.entity;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

/**
 * カードとラベルの多対多の関連を表す中間テーブルのJPAエンティティ。
 * DBの card_label テーブルに対応する（docs/spring-boot/03-entity-jpa.md 13章参照）。
 * 主キーは card_id と label_id の組み合わせ（複合主キー）で、{@link CardLabelId} が担う。
 */
@Entity
@Table(name = "card_label")
public class CardLabel {

	// 複合主キー本体。card・label 双方の@MapsIdと値が同期する
	@EmbeddedId
	private CardLabelId id;

	// カード側の関連。@MapsId("cardId")でid.cardIdと値を同期させ、外部キーの二重管理を避ける
	@MapsId("cardId")
	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	@JoinColumn(name = "card_id")
	@OnDelete(action = OnDeleteAction.CASCADE)
	private Card card;

	// ラベル側の関連。@MapsId("labelId")でid.labelIdと値を同期させる
	@MapsId("labelId")
	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	@JoinColumn(name = "label_id")
	@OnDelete(action = OnDeleteAction.CASCADE)
	private Label label;

	public CardLabelId getId() {
		return id;
	}

	public void setId(CardLabelId id) {
		this.id = id;
	}

	public Card getCard() {
		return card;
	}

	public void setCard(Card card) {
		this.card = card;
	}

	public Label getLabel() {
		return label;
	}

	public void setLabel(Label label) {
		this.label = label;
	}

}
