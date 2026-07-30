package com.tkmedia.taskmanagement.controller;

import com.tkmedia.taskmanagement.dto.CardCreateRequest;
import com.tkmedia.taskmanagement.dto.CardResponse;
import com.tkmedia.taskmanagement.dto.CardSearchCondition;
import com.tkmedia.taskmanagement.dto.CardStatusUpdateRequest;
import com.tkmedia.taskmanagement.dto.CardUpdateRequest;
import com.tkmedia.taskmanagement.service.CardService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
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

	/**
	 * カードを新規作成する。
	 *
	 * @param request リクエストボディ（タイトル・説明・期日・ラベルなど）。
	 *                {@code @Valid}により、CardCreateRequestに付いたBean Validationの
	 *                アノテーション（{@code @NotNull}など）がこのメソッドの実行前に検証される
	 *                （違反時はMethodArgumentNotValidExceptionが投げられ、GlobalExceptionHandlerが
	 *                400へ変換するため、このメソッドの中では検証済みの値として扱ってよい）
	 * @return 作成したカード（HTTPステータス201、{@code Location}ヘッダーに作成先URLを添えて返す）
	 */
	// @RequestBody: HTTPリクエストボディ（JSON）を、Jacksonを介してCardCreateRequestに変換する
	// アノテーション。GET系メソッドの@RequestParamと異なり、URLではなくボディから値を受け取る。
	//
	// 戻り値がCardResponseそのものではなくResponseEntity<CardResponse>なのは、このプロジェクト初の
	// 「ステータスコードとヘッダーを明示的に指定したいレスポンス」であるため。GET系のメソッドは
	// 常に200を返せば足りたが、リソースを新規作成するPOSTはRESTの慣習として201 Createdを返し、
	// 作成されたリソースの場所をLocationヘッダーで示すのが望ましいとされる
	// （docs/spring-boot/09-write-api-validation.md 28章参照）。
	@PostMapping
	public ResponseEntity<CardResponse> create(@Valid @RequestBody CardCreateRequest request) {
		CardResponse created = cardService.create(request);
		// ResponseEntity.created(URI) は 201 Created とし、指定したURIをLocationヘッダーに設定する
		// ビルダーメソッド。URI.create(...)の文字列連結だけでURLを組み立てているのは、
		// カードIDが数値（パスに直接埋め込んでも安全な文字種）であるため、
		// URLエンコードを考慮する必要が無いという判断による。
		return ResponseEntity.created(URI.create("/api/cards/" + created.id())).body(created);
	}

	/**
	 * カードを編集する（タイトル・説明・期日・ラベル）。
	 *
	 * @param id      更新対象のカードID
	 * @param request リクエストボディ（タイトル・説明・期日・ラベル）
	 * @return 更新後のカード
	 */
	// 戻り値を素のCardResponseにしている（POSTのようにResponseEntityでラップしない）理由:
	// このAPIは既存リソースを更新するだけで新しいURLを作らないため、201 CreatedやLocationヘッダーを
	// 返す必要が無い。成功時はGET系と同じ200 OKが素直な選択であり、Spring MVCは戻り値をそのまま
	// レスポンスボディとして扱い、ステータスコードは明示しなければ自動的に200になる。
	@PutMapping("/{id}")
	public CardResponse update(@PathVariable Integer id, @Valid @RequestBody CardUpdateRequest request) {
		return cardService.update(id, request);
	}

	/**
	 * カードのステータス（および、ステータス列内での並び順）を変更する。
	 *
	 * @param id      対象カードのID
	 * @param request 変更後のステータスと、移動先列内での挿入位置（省略時は列の末尾）
	 * @return 更新後のカード
	 */
	// PUTではなくPATCHを使う理由:
	// このAPIは「カードの全属性を送り直す」のではなく「ステータスと並び順という一部の属性だけ」を
	// 変更する部分更新であるため。PUTはリソース全体を置き換える意味を持つHTTPメソッドであり、
	// タイトルや説明を含まないこのリクエストボディをPUTとして送ってしまうと、
	// 「タイトル等は指定しなかったので変更しない」のか「タイトル等を空にする」のかが
	// 意味的に曖昧になる。PATCHはもともと部分的な変更を表すために用意されたメソッドであり、
	// この曖昧さが生じない。
	@PatchMapping("/{id}/status")
	public CardResponse updateStatus(@PathVariable Integer id, @Valid @RequestBody CardStatusUpdateRequest request) {
		return cardService.updateStatus(id, request);
	}
}
