package com.raisetech.taskmanagement.entity;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name = "card_label")
public class CardLabel {

	@EmbeddedId
	private CardLabelId id;

	@MapsId("cardId")
	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	@JoinColumn(name = "card_id")
	@OnDelete(action = OnDeleteAction.CASCADE)
	private Card card;

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
