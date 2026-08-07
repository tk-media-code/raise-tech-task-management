package com.tkmedia.taskmanagement.exception;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tkmedia.taskmanagement.controller.CardController;
import com.tkmedia.taskmanagement.service.CardService;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * {@link UnexpectedErrorHandler} のテスト。
 *
 * <p>このハンドラで最も壊れやすいのは「捕まえすぎてしまう」ことなので、
 * 500になるべきものが500になることだけでなく、<strong>500になってはいけないものが
 * 500になっていないこと</strong>を同じ重みで検証する。
 */
@WebMvcTest(CardController.class)
class UnexpectedErrorHandlerTest {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private CardService cardService;

	@Test
	@DisplayName("想定外の例外は500のProblemDetailに変換される")
	void 想定外の例外は500になる() throws Exception {
		// アプリが意図して投げる例外（ResourceNotFound・InvalidRequest）ではない、
		// 「本来起きるはずのない」種類の失敗を模している。
		when(cardService.findById(1)).thenThrow(new IllegalStateException("コネクションプールが枯渇しました"));

		mockMvc.perform(get("/api/cards/1"))
				.andExpect(status().isInternalServerError())
				.andExpect(jsonPath("$.status").value(500))
				.andExpect(jsonPath("$.title").value("サーバーエラー"))
				.andExpect(jsonPath("$.instance").value("/api/cards/1"));
	}

	@Test
	@DisplayName("500のレスポンスに、例外メッセージ（内部情報）は含まれない")
	void 例外の詳細はクライアントへ漏らさない() throws Exception {
		when(cardService.findById(1))
				.thenThrow(new IllegalStateException("relation \"card\" does not exist"));

		mockMvc.perform(get("/api/cards/1"))
				.andExpect(status().isInternalServerError())
				// 例外メッセージにはSQLの断片・テーブル名といった内部構造の手がかりが
				// 含まれることがあるため、そのままクライアントへ返してはいけない。
				.andExpect(jsonPath("$.detail").value(not(containsString("does not exist"))))
				.andExpect(jsonPath("$.detail").value("サーバー側で予期しないエラーが発生しました"));
	}

	@Test
	@DisplayName("フレームワーク由来の404（存在しないカードID）は500に化けない")
	void 業務例外は500に化けない() throws Exception {
		when(cardService.findById(999))
				.thenThrow(new ResourceNotFoundException("カードが見つかりません（id=999）"));

		// GlobalExceptionHandler（HIGHEST_PRECEDENCE）が先に評価されるため、
		// このフォールバック（LOWEST_PRECEDENCE）までは到達しない。
		mockMvc.perform(get("/api/cards/999"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.title").value("リソースが見つかりません"));
	}

	@Test
	@DisplayName("パス変数の型不一致（Spring MVCが投げる例外）は500に化けない")
	void 型不一致は400のまま() throws Exception {
		// /api/cards/{id} の id は Integer。文字列を渡すとSpring MVC自身が
		// MethodArgumentTypeMismatchException を投げる。この種のフレームワーク例外まで
		// Exception.class のハンドラが捕まえてしまうと、本来400のものが500になる。
		mockMvc.perform(get("/api/cards/abc"))
				.andExpect(status().isBadRequest());
	}
}
