package com.tkmedia.taskmanagement.service;

import com.tkmedia.taskmanagement.dto.CardResponse;
import com.tkmedia.taskmanagement.dto.CardSearchCondition;
import com.tkmedia.taskmanagement.dto.LabelResponse;
import com.tkmedia.taskmanagement.entity.Card;
import com.tkmedia.taskmanagement.entity.CardLabel;
import com.tkmedia.taskmanagement.exception.ResourceNotFoundException;
import com.tkmedia.taskmanagement.repository.CardLabelRepository;
import com.tkmedia.taskmanagement.repository.CardRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * カードに関する業務ロジックを担うService。
 * 一覧・詳細のいずれも「条件に合うカード本体を取得するクエリ」と「付与ラベルをまとめて取得する
 * クエリ」の2本で完結させ、カードの件数が増えてもSQLの発行回数を一定に保つ
 * （N+1問題の回避。docs/spring-boot/07-jpa-performance.md 24章参照）。
 */
@Service
@Transactional(readOnly = true)
public class CardService {

	private final CardRepository cardRepository;
	private final CardLabelRepository cardLabelRepository;

	public CardService(CardRepository cardRepository, CardLabelRepository cardLabelRepository) {
		this.cardRepository = cardRepository;
		this.cardLabelRepository = cardLabelRepository;
	}

	/**
	 * 絞り込み条件に合致するカード一覧を取得する。
	 *
	 * @param condition Controllerから渡された絞り込み条件（正規化前の生の値）
	 * @return 条件に合致するカードのDTO一覧（該当0件の場合は空リスト）
	 */
	public List<CardResponse> search(CardSearchCondition condition) {
		// --- 1. 正規化：DTOに入っている「入力そのまま」の値を、クエリに渡せる形に変換する ---
		// keyword: 空文字・空白のみの指定は「絞り込み条件なし」として扱う
		String keyword = (condition.keyword() == null || condition.keyword().isBlank())
				? null
				: condition.keyword().trim();
		// archived: 未指定(null)は「非アーカイブのみを対象にする」という仕様上の既定値に倒す。
		// これにより CardRepository.search 側では null-guard 不要の単純な等値比較で済む。
		boolean archived = condition.archived() != null && condition.archived();
		// labelIds: 未指定または空リストなら絞り込みを行わない。
		// JPQLの「in :labelIds」に空コレクションをそのまま渡すと「in ()」という不正なSQLになるため、
		// filterByLabelsフラグで絞り込みの有無自体を切り替え、無効時はダミー値で型だけ満たす。
		boolean filterByLabels = condition.labelIds() != null && !condition.labelIds().isEmpty();
		// id は 1 から採番されるため、0 はどのラベルにも一致しない安全な番兵値。
		List<Integer> labelIds = filterByLabels ? condition.labelIds() : List.of(0);

		// --- 2. クエリ1本目：条件に合うカード本体を取得する（boardはjoin fetch済みなのでboardNameの
		//        取得に追加SQLは発生しない） ---
		List<Card> cards = cardRepository.search(condition.boardId(), archived, keyword, filterByLabels, labelIds);
		if (cards.isEmpty()) {
			// 該当カードが無ければ、この先のラベル取得（クエリ2本目）自体が無意味であり、
			// 「IN ()」という空のIN句を発行してしまうのを避けるためにもここで打ち切る。
			return List.of();
		}
		return toResponses(cards);
	}

	/**
	 * カードを1件取得する。アーカイブ済みかどうかは問わない
	 * （アーカイブ一覧からカード詳細を開けるようにするための仕様。絞り込みの{@code archived}は
	 * あくまで一覧表示のためのフィルタで、詳細取得には適用しない）。
	 *
	 * @param id カードID
	 * @return カードのDTO
	 * @throws ResourceNotFoundException 該当カードが存在しない場合
	 */
	public CardResponse findById(Integer id) {
		Card card = cardRepository.findByIdWithBoard(id)
				.orElseThrow(() -> new ResourceNotFoundException("カードが見つかりません（id=" + id + "）"));
		// 1件だけの場合も toResponses を再利用する。要素数1のリストで2本目のクエリを呼ぶことになり
		// 一見遠回りに見えるが、「ラベルをまとめて取り、Java側で組み立てる」という
		// N+1回避のロジックを一覧・詳細の両方で1箇所に保てる利点の方が大きい。
		return toResponses(List.of(card)).get(0);
	}

	// カードのリストを受け取り、ラベルをまとめて取得(クエリ2本目)してからDTOのリストを組み立てる、
	// search()・findById()共通の処理。
	private List<CardResponse> toResponses(List<Card> cards) {
		List<Integer> cardIds = cards.stream().map(Card::getId).toList();

		// --- 3. クエリ2本目：対象カード全件分のラベルを1回のIN句でまとめて取得 ---
		List<CardLabel> cardLabels = cardLabelRepository.findAllWithLabelByCardIdIn(cardIds);

		// cardIdごとにラベルをグルーピングする。
		// cl.getId().getCardId()（@EmbeddedIdに既に載っている値）を使うのは、
		// cl.getCard().getId()でも結果は同じだが、後者は関連（LAZY）越しにIDを読む形になり
		// 「本当に追加SQLが発生しないか」を読み手が都度確認する必要が出るため。
		// IDに直接触れる前者なら、追加SQLが発生しないことがコードの見た目からも明らかになる。
		// Collectors.groupingByの第2引数にLinkedHashMap::newを指定し、
		// クエリのorder by（cardId昇順→labelId昇順）の並びをそのまま保持する。
		Map<Integer, List<LabelResponse>> labelsByCardId = cardLabels.stream()
				.collect(Collectors.groupingBy(
						cl -> cl.getId().getCardId(),
						LinkedHashMap::new,
						Collectors.mapping(CardService::toLabelResponse, Collectors.toList())));

		return cards.stream()
				.map(card -> toCardResponse(card, labelsByCardId.getOrDefault(card.getId(), Collections.emptyList())))
				.toList();
	}

	private static CardResponse toCardResponse(Card card, List<LabelResponse> labels) {
		// card.getBoard() は join fetch 済みのため、ここで呼んでも追加SQLは発生しない。
		return new CardResponse(
				card.getId(),
				card.getBoard().getId(),
				card.getBoard().getName(),
				card.getTitle(),
				card.getDescription(),
				card.getDueDate(),
				card.getStatus(),
				card.getIsArchived(),
				card.getPosition(),
				labels);
	}

	private static LabelResponse toLabelResponse(CardLabel cardLabel) {
		// cardLabel.getLabel() は findAllWithLabelByCardIdIn 側で join fetch 済みのため、
		// ここでのアクセスも追加SQLを伴わない。
		return new LabelResponse(
				cardLabel.getLabel().getId(),
				cardLabel.getLabel().getName(),
				cardLabel.getLabel().getColor());
	}
}
