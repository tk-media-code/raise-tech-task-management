package com.tkmedia.taskmanagement.controller;

import com.tkmedia.taskmanagement.dto.CardResponse;
import com.tkmedia.taskmanagement.dto.CardSearchCondition;
import com.tkmedia.taskmanagement.service.CardService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * カードに関するHTTPリクエストの受け口となるController。
 */
@RestController
@RequestMapping("/api/cards")
public class CardController {

	private final CardService cardService;

	public CardController(CardService cardService) {
		this.cardService = cardService;
	}

	/**
	 * 絞り込み条件に合致するカード一覧を取得する。4つの条件はいずれも任意で、組み合わせて指定できる。
	 *
	 * @param boardId  ボードIDで絞り込む（例: {@code ?boardId=1}）。未指定なら全ボード対象
	 * @param archived アーカイブ済みかどうかで絞り込む。未指定時は非アーカイブのみを返す
	 * @param keyword  タイトル・説明の部分一致（大文字小文字を無視）で絞り込む
	 * @param labelIds 付与ラベルで絞り込む（いずれか1つでも付いていればヒットするOR条件）。
	 *                 {@code ?labelIds=1,2} と {@code ?labelIds=1&labelIds=2} のどちらの形式でも
	 *                 同じ結果になる（Spring MVCが両方をList&lt;Integer&gt;へバインドする）
	 * @return 条件に合致するカード一覧。該当0件でもHTTP 200・空配列で返す
	 *         （「一覧が空であること」自体は正常な結果であり、404にはしない）
	 */
	@GetMapping
	public List<CardResponse> list(
			@RequestParam(required = false) Integer boardId,
			@RequestParam(required = false) Boolean archived,
			@RequestParam(required = false) String keyword,
			@RequestParam(required = false) List<Integer> labelIds) {
		// @RequestParam(required = false) は Integer/Boolean のラッパー型で受ける。
		// int/booleanのようなプリミティブ型だと、パラメータ未指定時に代入すべきnullが無く
		// 例外になってしまうため、ここでは必ずラッパー型を使う。
		// 受け取った生の値はここでは正規化せず、そのままCardSearchConditionに詰めてServiceへ渡す
		// （空文字・空リストの扱いなどの判断はCardService側の責務とする）。
		return cardService.search(new CardSearchCondition(boardId, archived, keyword, labelIds));
	}

	/**
	 * カードを1件取得する。アーカイブ済みかどうかは問わない
	 * （アーカイブ一覧からカード詳細を開けるようにするため）。
	 *
	 * @param id カードID
	 * @return 該当カード。存在しなければServiceが投げた例外をGlobalExceptionHandlerが404に変換する
	 */
	@GetMapping("/{id}")
	public CardResponse get(@PathVariable Integer id) {
		return cardService.findById(id);
	}
}
