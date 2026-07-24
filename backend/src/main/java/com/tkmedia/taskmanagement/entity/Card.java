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
import org.hibernate.annotations.Check;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * カード（タスク1件）を表すJPAエンティティ。
 * DBの card テーブルに対応する（docs/spring-boot/03-entity-jpa.md 12章参照）。
 * リスト（列）は独立したテーブルを持たず、status カラムの値（todo/doing/done）で状態を表現する
 * （要件定義 7.3 設計上の補足）。
 */
@Entity
@Table(name = "card")
// アプリ側のバリデーションとは別に、DBレベルでも status の値を制限する多重防御（docs/spring-boot/03-entity-jpa.md 14章）
@Check(constraints = "status in ('todo', 'doing', 'done')")
public class Card {

	/** 主キー。IDENTITYでDB側が採番する */
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Integer id;

	// 所属するボード。多対一（複数のCardが1つのBoardに属する）。
	// fetch = LAZY: getBoard() 等で実際にアクセスするまでSQLを発行しない遅延読み込み。
	// OnDelete(CASCADE): ボードが削除されたら、このカードもDB側で連動して削除される。
	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	@JoinColumn(name = "board_id", nullable = false)
	@OnDelete(action = OnDeleteAction.CASCADE)
	private Board board;

	// タイトル。NOT NULL制約（必須項目）
	@Column(nullable = false)
	private String title;

	// 説明・メモ。任意項目のため、長文を格納できるtext型とする
	@Column(columnDefinition = "text")
	private String description;

	// 期日。任意項目
	@Column(name = "due_date")
	private LocalDate dueDate;

	// ステータス（todo/doing/done）。クラス宣言の@Checkとあわせて不正値をDBレベルでも防ぐ
	@Column(nullable = false, length = 20)
	@ColumnDefault("'todo'")
	private String status;

	// アーカイブ済みかどうか
	@Column(name = "is_archived", nullable = false)
	@ColumnDefault("false")
	private Boolean isArchived;

	// 同一ステータス内での表示順（ドラッグ＆ドロップによる並び替えに使用）
	@Column(nullable = false)
	private Integer position;

	// 作成日時。DB側のDEFAULT（now()）に対応させる
	@Column(name = "created_at", nullable = false)
	@ColumnDefault("now()")
	private OffsetDateTime createdAt;

	// 更新日時。DB側のDEFAULT（now()）に対応させる
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
