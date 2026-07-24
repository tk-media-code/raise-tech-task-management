package com.raisetech.taskmanagement.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.ColumnDefault;

import java.time.OffsetDateTime;

/**
 * ボード（カードを束ねる単位）を表すJPAエンティティ。
 * DBの board テーブルに対応する（docs/spring-boot/03-entity-jpa.md 11章参照）。
 */
@Entity
@Table(name = "board")
public class Board {

	/** 主キー。IDENTITYでDB側（PostgreSQLの自動採番）が採番する */
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Integer id;

	// ボード名。NOT NULL制約（空を許さない）
	@Column(nullable = false)
	private String name;

	// ボード一覧での表示順
	@Column(nullable = false)
	private Integer position;

	// 作成日時。DB側のDEFAULT（now()）に対応させ、INSERT時にDBが自動設定する
	@Column(name = "created_at", nullable = false)
	@ColumnDefault("now()")
	private OffsetDateTime createdAt;

	public Integer getId() {
		return id;
	}

	public void setId(Integer id) {
		this.id = id;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public Integer getPosition() {
		return position;
	}

	public void setPosition(Integer position) {
		this.position = position;
	}

	public OffsetDateTime getCreatedAt() {
		return createdAt;
	}

	public void setCreatedAt(OffsetDateTime createdAt) {
		this.createdAt = createdAt;
	}

}
