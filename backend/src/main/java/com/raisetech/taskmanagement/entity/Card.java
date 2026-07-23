package com.raisetech.taskmanagement.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.Check;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "card")
@Check(constraints = "status in ('todo', 'doing', 'done')")
public class Card {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Integer id;

	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	@JoinColumn(name = "board_id", nullable = false)
	@OnDelete(action = OnDeleteAction.CASCADE)
	private Board board;

	@Column(nullable = false)
	private String title;

	@Column(columnDefinition = "text")
	private String description;

	@Column(name = "due_date")
	private LocalDate dueDate;

	@Column(nullable = false, length = 20)
	@ColumnDefault("'todo'")
	private String status;

	@Column(name = "is_archived", nullable = false)
	@ColumnDefault("false")
	private Boolean isArchived;

	@Column(nullable = false)
	private Integer position;

	@Column(name = "created_at", nullable = false)
	@ColumnDefault("now()")
	private OffsetDateTime createdAt;

	@Column(name = "updated_at", nullable = false)
	@ColumnDefault("now()")
	private OffsetDateTime updatedAt;

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

	public String getTitle() {
		return title;
	}

	public void setTitle(String title) {
		this.title = title;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public LocalDate getDueDate() {
		return dueDate;
	}

	public void setDueDate(LocalDate dueDate) {
		this.dueDate = dueDate;
	}

	public String getStatus() {
		return status;
	}

	public void setStatus(String status) {
		this.status = status;
	}

	public Boolean getIsArchived() {
		return isArchived;
	}

	public void setIsArchived(Boolean isArchived) {
		this.isArchived = isArchived;
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

	public OffsetDateTime getUpdatedAt() {
		return updatedAt;
	}

	public void setUpdatedAt(OffsetDateTime updatedAt) {
		this.updatedAt = updatedAt;
	}

}
