package com.tkmedia.taskmanagement.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tkmedia.taskmanagement.dto.BoardPositionUpdateRequest;
import com.tkmedia.taskmanagement.dto.LabelCreateRequest;
import com.tkmedia.taskmanagement.entity.Board;
import com.tkmedia.taskmanagement.entity.Label;
import com.tkmedia.taskmanagement.exception.InvalidRequestException;
import com.tkmedia.taskmanagement.exception.ResourceNotFoundException;
import com.tkmedia.taskmanagement.repository.BoardRepository;
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
 * {@link BoardService} の業務ルールに対する単体テスト。
 *
 * <p>方針は{@link CardServiceTest}と同じで、Repositoryをモックに差し替えDBを使わない。
 * このクラスが対象にするのは、ボードの並べ替えとラベル作成——特に
 * 「パレットにある色しか使えない」「同じボードに同名のラベルを作れない」という、
 * DBの制約では守られていない（アプリ層だけが守っている）ルール。
 */
@ExtendWith(MockitoExtension.class)
class BoardServiceTest {

	@Mock
	private BoardRepository boardRepository;

	@Mock
	private LabelRepository labelRepository;

	@InjectMocks
	private BoardService boardService;

	/** テスト用のボードを組み立てる。 */
	private static Board board(Integer id, String name, Integer position) {
		Board board = new Board();
		board.setId(id);
		board.setName(name);
		board.setPosition(position);
		return board;
	}

	@Nested
	@DisplayName("createLabel（ラベル作成）")
	class CreateLabel {

		@Test
		@DisplayName("パレットに無い色を指定すると拒否される")
		void パレット外の色は拒否される() {
			// ラベル色はフロントエンドが提示する8色のパレットから選ばせる仕様（要件5.5）。
			// DBにはこの制約が無いため、このService層のチェックが唯一の防衛線になる。
			when(boardRepository.findById(1)).thenReturn(Optional.of(board(1, "仕事", 1)));

			assertThatThrownBy(() -> boardService.createLabel(1, new LabelCreateRequest("独自色", "#123456")))
					.isInstanceOf(InvalidRequestException.class)
					.hasMessageContaining("許可されていない色");

			verify(labelRepository, never()).save(any());
		}

		@Test
		@DisplayName("色の検証は、重複チェックのSQLを発行する前に行われる")
		void 色の検証が重複チェックより先に走る() {
			when(boardRepository.findById(1)).thenReturn(Optional.of(board(1, "仕事", 1)));

			assertThatThrownBy(() -> boardService.createLabel(1, new LabelCreateRequest("独自色", "#123456")))
					.isInstanceOf(InvalidRequestException.class);

			// 「DBを見なくても分かる形式的な不正」を先に弾く、という検証順序が保たれていること。
			// 無駄なクエリを1本節約するだけでなく、検証の順序自体が意図的な設計判断であるため
			// テストで固定しておく。
			verify(labelRepository, never()).existsByBoardIdAndName(any(), any());
		}

		@Test
		@DisplayName("同じボードに同名のラベルは作れない")
		void 同名ラベルは拒否される() {
			when(boardRepository.findById(1)).thenReturn(Optional.of(board(1, "仕事", 1)));
			when(labelRepository.existsByBoardIdAndName(1, "優先度高")).thenReturn(true);

			assertThatThrownBy(() -> boardService.createLabel(1, new LabelCreateRequest("優先度高", "#e74c3c")))
					.isInstanceOf(InvalidRequestException.class)
					.hasMessageContaining("同じ名前のラベル");

			verify(labelRepository, never()).save(any());
		}

		@Test
		@DisplayName("ラベル名は前後の空白を除去してから保存・重複判定される")
		void ラベル名はtrimされる() {
			Board target = board(1, "仕事", 1);
			when(boardRepository.findById(1)).thenReturn(Optional.of(target));
			// trim後の "優先度高" で重複判定が行われること（" 優先度高 " のままでは無いこと）を、
			// このスタブの引数で表明している。異なる文字列で呼ばれればstrict stubsが検出する。
			when(labelRepository.existsByBoardIdAndName(1, "優先度高")).thenReturn(false);
			when(labelRepository.save(any(Label.class))).thenAnswer(invocation -> {
				Label saved = invocation.getArgument(0);
				saved.setId(10);
				return saved;
			});

			boardService.createLabel(1, new LabelCreateRequest("  優先度高  ", "#e74c3c"));

			verify(labelRepository).save(any(Label.class));
		}

		@Test
		@DisplayName("存在しないボードIDを指定すると404相当の例外になる")
		void 存在しないボードは404() {
			when(boardRepository.findById(999)).thenReturn(Optional.empty());

			assertThatThrownBy(() -> boardService.createLabel(999, new LabelCreateRequest("ラベル", "#e74c3c")))
					.isInstanceOf(ResourceNotFoundException.class)
					.hasMessageContaining("999");
		}
	}

	@Nested
	@DisplayName("updatePosition（ボードの並べ替え）")
	class UpdatePosition {

		@Test
		@DisplayName("並べ替えると全ボードのpositionが1から振り直される")
		void 全ボードのpositionが振り直される() {
			Board first = board(1, "仕事", 1);
			Board second = board(2, "家事", 2);
			Board third = board(3, "学習", 3);

			when(boardRepository.findById(3)).thenReturn(Optional.of(third));
			when(boardRepository.findAllByOrderByPositionAscIdAsc()).thenReturn(List.of(first, second, third));

			// 3番目のボードを先頭（インデックス0）へ移動する。
			boardService.updatePosition(3, new BoardPositionUpdateRequest(0));

			assertThat(third.getPosition()).isEqualTo(1);
			assertThat(first.getPosition()).isEqualTo(2);
			assertThat(second.getPosition()).isEqualTo(3);
		}

		@Test
		@DisplayName("範囲外のpositionを指定しても末尾への移動として扱われる（400にはしない）")
		void 範囲外のpositionは末尾へクランプされる() {
			Board first = board(1, "仕事", 1);
			Board second = board(2, "家事", 2);

			when(boardRepository.findById(1)).thenReturn(Optional.of(first));
			when(boardRepository.findAllByOrderByPositionAscIdAsc()).thenReturn(List.of(first, second));

			boardService.updatePosition(1, new BoardPositionUpdateRequest(99));

			assertThat(second.getPosition()).isEqualTo(1);
			assertThat(first.getPosition()).isEqualTo(2);
		}

		@Test
		@DisplayName("並べ替え後のpositionに欠番は生じない")
		void 欠番は生じない() {
			// カードの並べ替え（CardService.updateStatus）は移動元の列を詰め直さないため
			// 1,2,4 のような欠番が残り得るが、ボードには「移動元列」という概念が無く
			// 常に全ボードという1つのリストを丸ごと振り直すため、欠番は生じない。
			Board first = board(1, "仕事", 5);
			Board second = board(2, "家事", 11);
			Board third = board(3, "学習", 40);

			when(boardRepository.findById(2)).thenReturn(Optional.of(second));
			when(boardRepository.findAllByOrderByPositionAscIdAsc()).thenReturn(List.of(first, second, third));

			boardService.updatePosition(2, new BoardPositionUpdateRequest(2));

			// 元が 5, 11, 40 という飛び飛びの値でも、結果は必ず 1..n の連番になる。
			assertThat(List.of(first.getPosition(), third.getPosition(), second.getPosition()))
					.containsExactly(1, 2, 3);
		}

		@Test
		@DisplayName("存在しないボードIDを指定すると404相当の例外になる")
		void 存在しないボードは404() {
			when(boardRepository.findById(999)).thenReturn(Optional.empty());

			assertThatThrownBy(() -> boardService.updatePosition(999, new BoardPositionUpdateRequest(0)))
					.isInstanceOf(ResourceNotFoundException.class)
					.hasMessageContaining("999");
		}
	}
}
