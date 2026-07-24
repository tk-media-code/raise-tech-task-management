package com.tkmedia.taskmanagement.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.io.Serializable;
import java.util.Objects;

/**
 * {@link CardLabel} の複合主キー（card_id + label_id）を表すクラス。
 * JPAの仕様上、複合主キークラスは Serializable の実装と equals()/hashCode() の実装が必須
 * （docs/spring-boot/03-entity-jpa.md 13章参照）。
 */
@Embeddable
public class CardLabelId implements Serializable {

	@Column(name = "card_id")
	private Integer cardId;

	@Column(name = "label_id")
	private Integer labelId;

	// JPAがリフレクション経由でインスタンス化する際に必要なデフォルトコンストラクタ
	public CardLabelId() {
	}

	public CardLabelId(Integer cardId, Integer labelId) {
		this.cardId = cardId;
		this.labelId = labelId;
	}

	public Integer getCardId() {
		return cardId;
	}

	public void setCardId(Integer cardId) {
		this.cardId = cardId;
	}

	public Integer getLabelId() {
		return labelId;
	}

	public void setLabelId(Integer labelId) {
		this.labelId = labelId;
	}

	// 複合主キーは「cardIdとlabelIdが両方一致していれば同じ主キー」という値としての同一性判断が必要なため実装する
	@Override
	public boolean equals(Object o) {
		if (this == o) {
			return true;
		}
		if (!(o instanceof CardLabelId that)) {
			return false;
		}
		return Objects.equals(cardId, that.cardId) && Objects.equals(labelId, that.labelId);
	}

	@Override
	public int hashCode() {
		return Objects.hash(cardId, labelId);
	}

}
