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
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.annotations.UpdateTimestamp;

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

	// タイトル。NOT NULL制約（必須項目）。
	// length = 200 はDBカラムをvarchar(200)にする指定（アプリ側の @Size(max = 200) と揃える多重防御。
	// docs/spring-boot/09-write-api-validation.md 29章参照）。prototype/index.htmlのmaxlength="200"を踏襲した値で、
	// 要件定義に文字数の規定があるわけではない。
	@Column(nullable = false, length = 200)
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

	// 作成日時。
	// @ColumnDefault("now()") はDDL（CREATE TABLE）にDB側のDEFAULT式を刻むだけで、
	// Hibernateが発行するINSERT文はこのカラムを含め全カラムを明示的に列挙するため、
	// Javaの値がnullのままだとDEFAULTは使われずNOT NULL制約違反になる
	// （db/seed/dummy-data.sqlのような、Hibernateを経由しない直接INSERTのための保険として残している）。
	// @CreationTimestampはHibernate独自の拡張で、INSERT直前にJava側（アプリケーションサーバーの時刻）で
	// 現在時刻を採番してこのフィールドへ自動的にセットしてくれる。
	// これによりCardService側でnew Card().setCreatedAt(...)を書かずに済む
	// （docs/spring-boot/09-write-api-validation.md 31章参照）。
	@Column(name = "created_at", nullable = false)
	@ColumnDefault("now()")
	@CreationTimestamp
	private OffsetDateTime createdAt;

	// 更新日時。@UpdateTimestampはINSERT時はcreatedAtと同じくJava側で現在時刻をセットし、
	// UPDATE時（CardService.update / updateStatusによるダーティチェック経由のUPDATE発行時）にも
	// 自動的に値を更新し直してくれる。createdAtとの役割分担は
	// 「作成時刻は不変」「更新時刻は変更のたびに動く」という違いのみ。
	@Column(name = "updated_at", nullable = false)
	@ColumnDefault("now()")
	@UpdateTimestamp
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
