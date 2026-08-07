package com.tkmedia.taskmanagement.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tkmedia.taskmanagement.dto.CardArchiveUpdateRequest;
import com.tkmedia.taskmanagement.dto.CardCreateRequest;
import com.tkmedia.taskmanagement.dto.CardStatusUpdateRequest;
import com.tkmedia.taskmanagement.entity.Board;
import com.tkmedia.taskmanagement.entity.Card;
import com.tkmedia.taskmanagement.entity.Label;
import com.tkmedia.taskmanagement.exception.InvalidRequestException;
import com.tkmedia.taskmanagement.exception.ResourceNotFoundException;
import com.tkmedia.taskmanagement.repository.BoardRepository;
import com.tkmedia.taskmanagement.repository.CardLabelRepository;
import com.tkmedia.taskmanagement.repository.CardRepository;
import com.tkmedia.taskmanagement.repository.LabelRepository;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * {@link CardService} の業務ルールに対する単体テスト。
 *
 * <p>Repositoryをすべてモックに差し替えているため、このテストはDBを一切必要としない。
 * Testcontainersを使った結合テストも検討したが、backendコンテナ内から Docker socket が
 * 見えず起動できないことを実測で確認したため、まず「業務ルールそのもの」を対象にする
 * この形から始めている（Issue #82参照）。
 *
 * <p>検証対象は、Bean Validationでは表現できずService層に置かれた判断——
 * 「完了ステータスのカードのみアーカイブできる」「アーカイブ済みのカードのみ削除できる」
 * 「ラベルは同じボードのものに限る」といったルール。これらは要件定義に由来する制約であり、
 * リファクタリングで最も壊してはいけない部分にあたる。
 */
// MockitoExtension: @Mock/@InjectMocks の注入を行い、テストごとにモックを初期化する。
// 併せて「スタブしたのに一度も呼ばれなかった」場合にテストを失敗させる（strict stubs）ため、
// 各テストでは実際にそのテストが通る経路で使われるスタブだけを書いている。
@ExtendWith(MockitoExtension.class)
class CardServiceTest {

	@Mock
	private CardRepository cardRepository;

	@Mock
	private CardLabelRepository cardLabelRepository;

	@Mock
	private BoardRepository boardRepository;

	@Mock
	private LabelRepository labelRepository;

	// 上の4つのモックをコンストラクタ経由で注入したテスト対象。
	@InjectMocks
	private CardService cardService;

	/** テスト用のボードを組み立てる。 */
	private static Board board(Integer id, String name) {
		Board board = new Board();
		board.setId(id);
		board.setName(name);
		board.setPosition(1);
		return board;
	}

	/**
	 * テスト用のカードを組み立てる。
	 * エンティティを直接newしているのは、このテストが永続化の仕組み（Hibernate）ではなく
	 * Service層の判断だけを対象にしているため。DBを経由しないぶん、
	 * 「どういう状態のカードを相手にしたときどう振る舞うか」だけに集中できる。
	 */
	private static Card card(Integer id, String status, boolean archived) {
		Card card = new Card();
		card.setId(id);
		card.setBoard(board(1, "仕事"));
		card.setTitle("テスト用カード");
		card.setStatus(status);
		card.setIsArchived(archived);
		card.setPosition(1);
		return card;
	}

	@Nested
	@DisplayName("updateArchived（アーカイブ・復元）")
	class UpdateArchived {

		@Test
		@DisplayName("完了ステータス以外のカードはアーカイブできない")
		void 完了以外はアーカイブできない() {
			// 要件5.7「完了したカードを退避する」に由来する制約。作業中・未着手のタスクを
			// 誤って視界から消してしまう事故を防ぐためのもの。
			Card doing = card(1, "doing", false);
			when(cardRepository.findByIdWithBoard(1)).thenReturn(Optional.of(doing));

			assertThatThrownBy(() -> cardService.updateArchived(1, new CardArchiveUpdateRequest(true)))
					.isInstanceOf(InvalidRequestException.class)
					.hasMessageContaining("完了ステータスのカードのみ");

			// 例外を投げた以上、カードの状態は一切変わっていないこと。
			assertThat(doing.getIsArchived()).isFalse();
		}

		@Test
		@DisplayName("完了ステータスのカードはアーカイブでき、status・positionは保持される")
		void 完了カードはアーカイブできる() {
			Card done = card(1, "done", false);
			done.setPosition(3);
			when(cardRepository.findByIdWithBoard(1)).thenReturn(Optional.of(done));
			when(cardLabelRepository.findAllWithLabelByCardIdIn(anyList())).thenReturn(List.of());

			cardService.updateArchived(1, new CardArchiveUpdateRequest(true));

			assertThat(done.getIsArchived()).isTrue();
			// status・positionをあえて変えないのは、要件5.7の「元のステータスへ復元できる」を
			// 満たすため。「どの列の何番目にいたか」をアーカイブ中も保持しておく必要がある。
			assertThat(done.getStatus()).isEqualTo("done");
			assertThat(done.getPosition()).isEqualTo(3);
		}

		@Test
		@DisplayName("既にアーカイブ済みのカードを再度アーカイブしても、エラーにはならない（冪等）")
		void 同じ状態への変更は冪等() {
			Card archived = card(1, "done", true);
			when(cardRepository.findByIdWithBoard(1)).thenReturn(Optional.of(archived));
			when(cardLabelRepository.findAllWithLabelByCardIdIn(anyList())).thenReturn(List.of());

			cardService.updateArchived(1, new CardArchiveUpdateRequest(true));

			// ボタンの連打・ネットワークの再送で同じリクエストが重複して届いても、
			// 400にはせず「結果として意図した状態になっていればよい」と扱う。
			assertThat(archived.getIsArchived()).isTrue();
			// 冪等な経路では復元用のposition採番（findMaxPosition）まで進まないこと。
			verify(cardRepository, never()).findMaxPosition(any(), any());
		}

		@Test
		@DisplayName("復元するとpositionが採番し直され、列の末尾に置かれる")
		void 復元時はpositionを採番し直す() {
			Card archived = card(1, "done", true);
			archived.setPosition(2);
			when(cardRepository.findByIdWithBoard(1)).thenReturn(Optional.of(archived));
			// 復元先の列（board=1, status=done）には既に5番まで埋まっている状況を作る。
			when(cardRepository.findMaxPosition(1, "done")).thenReturn(5);
			when(cardLabelRepository.findAllWithLabelByCardIdIn(anyList())).thenReturn(List.of());

			cardService.updateArchived(1, new CardArchiveUpdateRequest(false));

			assertThat(archived.getIsArchived()).isFalse();
			// アーカイブ中に元の列が並べ替えられ、保持していたposition=2が既に他のカードに
			// 使われている可能性があるため、最大値+1で採番し直す。
			assertThat(archived.getPosition()).isEqualTo(6);
		}
	}

	@Nested
	@DisplayName("delete（完全削除）")
	class Delete {

		@Test
		@DisplayName("アーカイブされていないカードは削除できない")
		void 非アーカイブは削除できない() {
			// 「完全削除」ボタンはアーカイブ画面にしか無いが、それはUIの導線の話であって、
			// APIとしての制約はService層が持つ。取り消せない操作なので、画面を経由しない
			// リクエストであっても作業中のカードが消えないようにする。
			Card active = card(1, "done", false);
			when(cardRepository.findById(1)).thenReturn(Optional.of(active));

			assertThatThrownBy(() -> cardService.delete(1))
					.isInstanceOf(InvalidRequestException.class)
					.hasMessageContaining("アーカイブ済みのカードのみ");

			verify(cardRepository, never()).delete(any());
		}

		@Test
		@DisplayName("アーカイブ済みのカードは削除できる")
		void アーカイブ済みは削除できる() {
			Card archived = card(1, "done", true);
			when(cardRepository.findById(1)).thenReturn(Optional.of(archived));

			cardService.delete(1);

			verify(cardRepository).delete(archived);
		}

		@Test
		@DisplayName("存在しないカードIDを指定すると404相当の例外になる")
		void 存在しないカードは404() {
			when(cardRepository.findById(999)).thenReturn(Optional.empty());

			assertThatThrownBy(() -> cardService.delete(999))
					.isInstanceOf(ResourceNotFoundException.class)
					.hasMessageContaining("999");
		}
	}

	@Nested
	@DisplayName("updateStatus（ステータス変更・並べ替え）")
	class UpdateStatus {

		@Test
		@DisplayName("todo/doing/done以外のステータスは拒否される")
		void 不正なステータス値は拒否される() {
			// @NotBlankは「空文字でないこと」しか保証しないため、3値のいずれかであることは
			// Service層で確認する必要がある（DBの@Check制約に到達する前に400で返すため）。
			when(cardRepository.findByIdWithBoard(1)).thenReturn(Optional.of(card(1, "todo", false)));

			assertThatThrownBy(() -> cardService.updateStatus(1, new CardStatusUpdateRequest("archived", null)))
					.isInstanceOf(InvalidRequestException.class)
					.hasMessageContaining("todo / doing / done");
		}

		@Test
		@DisplayName("移動先の列に挿入すると、その列全体のpositionが1から振り直される")
		void 移動先列のpositionが振り直される() {
			Card moving = card(10, "todo", false);
			Card first = card(11, "doing", false);
			first.setPosition(1);
			Card second = card(12, "doing", false);
			second.setPosition(2);

			when(cardRepository.findByIdWithBoard(10)).thenReturn(Optional.of(moving));
			// 移動先（doing列）には既に2枚並んでいる。可変リストを渡すのは、
			// Serviceがこのリストに対してremoveIf・addを行うため。
			when(cardRepository.findByBoardIdAndStatusAndIsArchivedFalseOrderByPositionAscIdAsc(1, "doing"))
					.thenReturn(new java.util.ArrayList<>(List.of(first, second)));
			when(cardLabelRepository.findAllWithLabelByCardIdIn(anyList())).thenReturn(List.of());

			// 先頭（インデックス0）へ挿入する。
			cardService.updateStatus(10, new CardStatusUpdateRequest("doing", 0));

			assertThat(moving.getStatus()).isEqualTo("doing");
			// 「対象カードのpositionだけ書き換える」方式では既存カードと値が重複してしまうため、
			// 列に並ぶカード全員へ1から連番を振り直す。これが一意な順序を保証している。
			assertThat(moving.getPosition()).isEqualTo(1);
			assertThat(first.getPosition()).isEqualTo(2);
			assertThat(second.getPosition()).isEqualTo(3);
		}

		@Test
		@DisplayName("positionを省略すると列の末尾に置かれる")
		void position省略時は末尾に置かれる() {
			Card moving = card(10, "todo", false);
			Card existing = card(11, "doing", false);
			existing.setPosition(1);

			when(cardRepository.findByIdWithBoard(10)).thenReturn(Optional.of(moving));
			when(cardRepository.findByBoardIdAndStatusAndIsArchivedFalseOrderByPositionAscIdAsc(1, "doing"))
					.thenReturn(new java.util.ArrayList<>(List.of(existing)));
			when(cardLabelRepository.findAllWithLabelByCardIdIn(anyList())).thenReturn(List.of());

			cardService.updateStatus(10, new CardStatusUpdateRequest("doing", null));

			assertThat(existing.getPosition()).isEqualTo(1);
			assertThat(moving.getPosition()).isEqualTo(2);
		}

		@Test
		@DisplayName("列のサイズを超えるpositionを指定しても、末尾への挿入として扱われる（400にはしない）")
		void 範囲外のpositionは末尾へクランプされる() {
			Card moving = card(10, "todo", false);
			Card existing = card(11, "doing", false);

			when(cardRepository.findByIdWithBoard(10)).thenReturn(Optional.of(moving));
			when(cardRepository.findByBoardIdAndStatusAndIsArchivedFalseOrderByPositionAscIdAsc(1, "doing"))
					.thenReturn(new java.util.ArrayList<>(List.of(existing)));
			when(cardLabelRepository.findAllWithLabelByCardIdIn(anyList())).thenReturn(List.of());

			// ドラッグ＆ドロップで列の最後尾へドロップしたとき、フロントエンドは
			// 「その時点の件数」をpositionとして送ってくることがある。それを素直に
			// 「末尾への挿入」として扱い、範囲外エラーにはしない。
			cardService.updateStatus(10, new CardStatusUpdateRequest("doing", 99));

			assertThat(moving.getPosition()).isEqualTo(2);
		}
	}

	@Nested
	@DisplayName("create（新規作成）")
	class Create {

		@Test
		@DisplayName("他のボードに属するラベルIDを指定すると拒否される")
		void 他ボードのラベルは拒否される() {
			Board target = board(1, "仕事");
			when(boardRepository.findById(1)).thenReturn(Optional.of(target));
			// ラベルID 99 を指定したが、ボード1に属するラベルとしては1件も見つからない状況。
			// ラベルはボード単位で管理される（要件5.5）ため、他ボードのラベルを付けることはできない。
			when(labelRepository.findByBoardIdAndIdIn(1, List.of(99))).thenReturn(List.of());

			CardCreateRequest request = new CardCreateRequest(1, "新しいカード", null, null, List.of(99));

			assertThatThrownBy(() -> cardService.create(request))
					.isInstanceOf(InvalidRequestException.class)
					.hasMessageContaining("指定されたラベル");

			verify(cardRepository, never()).save(any());
		}

		@Test
		@DisplayName("存在しないボードIDを指定すると404相当の例外になる")
		void 存在しないボードは404() {
			when(boardRepository.findById(999)).thenReturn(Optional.empty());

			CardCreateRequest request = new CardCreateRequest(999, "新しいカード", null, null, null);

			assertThatThrownBy(() -> cardService.create(request))
					.isInstanceOf(ResourceNotFoundException.class)
					.hasMessageContaining("999");
		}

		@Test
		@DisplayName("同じボードのラベルであれば付与できる")
		void 同一ボードのラベルは付与できる() {
			Board target = board(1, "仕事");
			Label label = new Label();
			label.setId(5);
			label.setBoard(target);
			label.setName("優先度高");
			label.setColor("#e74c3c");

			when(boardRepository.findById(1)).thenReturn(Optional.of(target));
			when(labelRepository.findByBoardIdAndIdIn(1, List.of(5))).thenReturn(List.of(label));
			when(cardRepository.findMaxPosition(1, "todo")).thenReturn(0);
			when(cardRepository.save(any(Card.class))).thenAnswer(invocation -> {
				Card saved = invocation.getArgument(0);
				saved.setId(100);
				return saved;
			});
			when(cardLabelRepository.findAllWithLabelByCardIdIn(anyList())).thenReturn(List.of());

			CardCreateRequest request = new CardCreateRequest(1, "新しいカード", null, null, List.of(5));
			cardService.create(request);

			// 中間テーブル（card_label）への保存が行われたこと。
			verify(cardLabelRepository).saveAll(anyList());
		}
	}

	@Nested
	@DisplayName("findById（1件取得）")
	class FindById {

		@Test
		@DisplayName("存在しないカードIDを指定すると404相当の例外になる")
		void 存在しないカードは404() {
			when(cardRepository.findByIdWithBoard(999)).thenReturn(Optional.empty());

			assertThatThrownBy(() -> cardService.findById(999))
					.isInstanceOf(ResourceNotFoundException.class)
					.hasMessageContaining("999");
		}
	}
}
