package com.tkmedia.taskmanagement.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

/**
 * ラベルを表すJPAエンティティ。
 * DBの label テーブルに対応する（docs/spring-boot/03-entity-jpa.md 12章参照）。
 * カードとは多対多の関係にあり、中間テーブル {@link CardLabel} 経由で結び付く。
 */
@Entity
@Table(name = "label")
public class Label {

	/** 主キー。IDENTITYでDB側が採番する */
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Integer id;

	// 所属するボード。多対一。OnDelete(CASCADE): ボード削除時にこのラベルも連動して削除される
	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	@JoinColumn(name = "board_id", nullable = false)
	@OnDelete(action = OnDeleteAction.CASCADE)
	private Board board;

	// ラベル名。NOT NULL制約（必須項目）
	@Column(nullable = false)
	private String name;

	// 色（既定パレットから選択）。NOT NULL制約（必須項目）
	@Column(nullable = false)
	private String color;

	public Integer getId() {
		return id;
	}

	public void setId(Integer id) {
		this.id = id;
	}

	public Board getBoard() {
		return board;
	}

	public void setBoard(Board board) {
		this.board = board;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getColor() {
		return color;
	}

	public void setColor(String color) {
		this.color = color;
	}

}
