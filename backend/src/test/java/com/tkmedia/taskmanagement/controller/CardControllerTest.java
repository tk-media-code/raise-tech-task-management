package com.tkmedia.taskmanagement.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tkmedia.taskmanagement.dto.CardResponse;
import com.tkmedia.taskmanagement.exception.InvalidRequestException;
import com.tkmedia.taskmanagement.exception.ResourceNotFoundException;
import com.tkmedia.taskmanagement.service.CardService;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * {@link CardController} のHTTP層に対するテスト。
 *
 * <p>{@code @WebMvcTest}はSpring MVCに関わる部分だけを起動する「スライステスト」で、
 * Service・Repository・DataSourceは読み込まれない。そのためDBが無くても実行できる。
 * Serviceは{@code @MockitoBean}でモックに差し替え、Controller自身の責務——
 * URLとメソッドの割り当て・リクエストの検証・ステータスコード・レスポンスの形——だけを見る。
 *
 * <p>業務ルールそのものは{@link com.tkmedia.taskmanagement.service.CardServiceTest}が担当する。
 * ここで確認したいのは「Serviceが例外を投げたとき、それがHTTPとして正しく表現されるか」という、
 * {@code GlobalExceptionHandler}まで含めた変換の正しさ。
 */
@WebMvcTest(CardController.class)
class CardControllerTest {

	@Autowired
	private MockMvc mockMvc;

	// @MockitoBean: このスライスのApplicationContextへモックをBeanとして登録する。
	// Controllerがコンストラクタで受け取るCardServiceが、実物の代わりにこのモックになる。
	@MockitoBean
	private CardService cardService;

	/** テスト用のレスポンスDTOを組み立てる。 */
	private static CardResponse response(Integer id) {
		return new CardResponse(id, 1, "仕事", "テスト用カード", null, null, "todo", false, 1, List.of());
	}

	@Test
	@DisplayName("POST /api/cards は201と、作成したリソースのURLをLocationヘッダーで返す")
	void 作成は201とLocationを返す() throws Exception {
		when(cardService.create(any())).thenReturn(response(18));

		mockMvc.perform(post("/api/cards")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"boardId\":1,\"title\":\"打合せ資料\"}"))
				.andExpect(status().isCreated())
				// RESTの慣習として、201のレスポンスには作成されたリソースの場所を示す。
				.andExpect(header().string("Location", "/api/cards/18"))
				.andExpect(jsonPath("$.id").value(18));
	}

	@Test
	@DisplayName("タイトルが空のリクエストは400になり、errorsでフィールドを名指しする")
	void タイトル未入力は400() throws Exception {
		mockMvc.perform(post("/api/cards")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"boardId\":1,\"title\":\"   \"}"))
				.andExpect(status().isBadRequest())
				// フロントエンドが「どの入力欄の下にエラーを出すか」を機械的に判定できるよう、
				// フィールド名をキーにしたerrorsを返す（GlobalExceptionHandler.handleValidationError）。
				.andExpect(jsonPath("$.errors.title").value("タイトルを入力してください"))
				.andExpect(jsonPath("$.title").value("バリデーションエラー"));

		// バリデーションで弾かれた場合、Service層には一切到達しないこと。
		verify(cardService, org.mockito.Mockito.never()).create(any());
	}

	@Test
	@DisplayName("ボードID未指定のリクエストは400になる")
	void ボード未指定は400() throws Exception {
		mockMvc.perform(post("/api/cards")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"title\":\"打合せ資料\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors.boardId").value("ボードを指定してください"));
	}

	@Test
	@DisplayName("Serviceが投げたResourceNotFoundExceptionは404のProblemDetailに変換される")
	void 存在しないカードは404() throws Exception {
		when(cardService.findById(999))
				.thenThrow(new ResourceNotFoundException("カードが見つかりません（id=999）"));

		mockMvc.perform(get("/api/cards/999"))
				.andExpect(status().isNotFound())
				// RFC 9457（ProblemDetail）形式で返っていること。
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.detail").value("カードが見つかりません（id=999）"))
				.andExpect(jsonPath("$.instance").value("/api/cards/999"));
	}

	@Test
	@DisplayName("Serviceが投げたInvalidRequestExceptionは400のProblemDetailに変換される")
	void 業務ルール違反は400() throws Exception {
		when(cardService.updateArchived(eq(1), any()))
				.thenThrow(new InvalidRequestException("完了ステータスのカードのみアーカイブできます"));

		mockMvc.perform(patch("/api/cards/1/archive")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"archived\":true}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.detail").value("完了ステータスのカードのみアーカイブできます"));
	}

	@Test
	@DisplayName("DELETE /api/cards/{id} は204 No Contentを返し、本文を持たない")
	void 削除は204を返す() throws Exception {
		mockMvc.perform(delete("/api/cards/1"))
				.andExpect(status().isNoContent());

		verify(cardService).delete(1);
	}

	@Test
	@DisplayName("削除できない状態のカードへのDELETEは400になる")
	void 削除不可のカードは400() throws Exception {
		doThrow(new InvalidRequestException("アーカイブ済みのカードのみ完全に削除できます"))
				.when(cardService).delete(1);

		mockMvc.perform(delete("/api/cards/1"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.detail").value("アーカイブ済みのカードのみ完全に削除できます"));
	}

	@Test
	@DisplayName("ステータス未指定のPATCHは400になる")
	void ステータス未指定は400() throws Exception {
		mockMvc.perform(patch("/api/cards/1/status")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"status\":\"\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors.status").value("ステータスを指定してください"));
	}

	@Test
	@DisplayName("負のpositionを指定したPATCHは400になる")
	void 負のpositionは400() throws Exception {
		mockMvc.perform(patch("/api/cards/1/status")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"status\":\"doing\",\"position\":-1}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors.position").value("位置は0以上で指定してください"));
	}
}
