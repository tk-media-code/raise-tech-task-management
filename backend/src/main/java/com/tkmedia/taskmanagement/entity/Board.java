package com.tkmedia.taskmanagement.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;

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

	// ボード名。NOT NULL制約（空を許さない）。
	// length = 50 はDBカラムをvarchar(50)にする指定（アプリ側の @Size(max = 50) と揃える多重防御。
	// docs/spring-boot/09-write-api-validation.md 29章参照）。prototype/index.htmlのmaxlength="50"を踏襲した値。
	@Column(nullable = false, length = 50)
	private String name;

	// ボード一覧での表示順
	@Column(nullable = false)
	private Integer position;

	// 作成日時。
	// @ColumnDefault("now()")はDDL生成時にDB側のDEFAULT式を刻むだけで、Hibernateが発行するINSERT文は
	// このカラムを含め全カラムを明示的に列挙するため、Javaの値がnullのままだとDEFAULTは使われず
	// NOT NULL制約違反になる（db/seed/dummy-data.sqlのような直接INSERTのための保険として残している）。
	// @CreationTimestampはHibernate独自の拡張で、INSERT直前にJava側で現在時刻を採番し
	// このフィールドへ自動的にセットしてくれる（docs/spring-boot/09-write-api-validation.md 31章参照）。
	@Column(name = "created_at", nullable = false)
	@ColumnDefault("now()")
	@CreationTimestamp
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
