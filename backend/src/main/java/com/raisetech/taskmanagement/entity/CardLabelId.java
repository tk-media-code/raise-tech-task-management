package com.raisetech.taskmanagement.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class CardLabelId implements Serializable {

	@Column(name = "card_id")
	private Integer cardId;

	@Column(name = "label_id")
	private Integer labelId;

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
