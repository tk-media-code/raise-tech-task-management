package com.tkmedia.taskmanagement.service;

import com.tkmedia.taskmanagement.dto.CardCreateRequest;
import com.tkmedia.taskmanagement.dto.CardResponse;
import com.tkmedia.taskmanagement.dto.CardSearchCondition;
import com.tkmedia.taskmanagement.dto.LabelResponse;
import com.tkmedia.taskmanagement.entity.Board;
import com.tkmedia.taskmanagement.entity.Card;
import com.tkmedia.taskmanagement.entity.CardLabel;
import com.tkmedia.taskmanagement.entity.Label;
import com.tkmedia.taskmanagement.exception.InvalidRequestException;
import com.tkmedia.taskmanagement.exception.ResourceNotFoundException;
import com.tkmedia.taskmanagement.repository.BoardRepository;
import com.tkmedia.taskmanagement.repository.CardLabelRepository;
import com.tkmedia.taskmanagement.repository.CardRepository;
import com.tkmedia.taskmanagement.repository.LabelRepository;
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

	// 新規作成したカードの初期ステータス。要件定義5.2「ステータス…初期値は『未着手』」に対応する。
	// リクエストDTO（CardCreateRequest）にstatusフィールドを設けていないのは、
	// 作成時のステータスがこの1択しかなく、クライアントに選ばせる理由が無いため
	// （ワイヤーフレーム6.2①の「＋ カードを追加」も未着手列の下にしか無い）。
	private static final String INITIAL_STATUS = "todo";

	private final CardRepository cardRepository;
	private final CardLabelRepository cardLabelRepository;
	private final BoardRepository boardRepository;
	private final LabelRepository labelRepository;

	public CardService(CardRepository cardRepository, CardLabelRepository cardLabelRepository,
			BoardRepository boardRepository, LabelRepository labelRepository) {
		this.cardRepository = cardRepository;
		this.cardLabelRepository = cardLabelRepository;
		this.boardRepository = boardRepository;
		this.labelRepository = labelRepository;
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

	/**
	 * カードを新規作成する。
	 *
	 * @param request 作成内容（タイトル・説明・期日・ラベル）
	 * @return 作成したカードのDTO（付与したラベルを含む）
	 * @throws ResourceNotFoundException 指定した{@code boardId}のボードが存在しない場合
	 * @throws InvalidRequestException   指定したラベルIDの一部が、そのボードに存在しない場合
	 */
	// クラスに付けた @Transactional(readOnly = true) を、書き込みを行うこのメソッドだけ
	// @Transactional で上書きする。readOnly=trueのままだとHibernateが更新検知（ダーティチェック）を
	// 省略する設定のままになり、INSERTが発行されない可能性がある
	// （docs/spring-boot/09-write-api-validation.md 31章参照）。
	@Transactional
	public CardResponse create(CardCreateRequest request) {
		// --- 1. ボードの存在確認 ---
		// existsById + 別途findByIdではなく、最初からfindByIdで実体を取得する。
		// このあとCard.setBoard(board)でそのまま使うため、二度手間（存在確認のSELECTと
		// 関連付け用のSELECTを別々に発行すること）を避けられる。
		// getReferenceById（実体を取得せず、IDだけを持つプロキシを返す）という選択肢もあるが、
		// その場合ボードが存在しないミスはSELECTの時点ではなく、flush時のFK制約違反という
		// 分かりにくいエラーになってしまう。ここでは「無いものは早い段階ではっきり404にする」ことを優先する。
		Board board = boardRepository.findById(request.boardId())
				.orElseThrow(() -> new ResourceNotFoundException("ボードが見つかりません（id=" + request.boardId() + "）"));

		// --- 2. 正規化：Bean Validationを通過した値を、DBに保存できる形へ整える ---
		// titleは@NotBlankで「空白のみ」は弾かれているが、前後の空白そのものは除去されないため、
		// ここでtrimする（" 会議 " のようなタイトルがそのまま保存されるのを防ぐ）。
		String title = request.title().trim();
		String description = normalizeDescription(request.description());
		List<Integer> labelIds = normalizeLabelIds(request.labelIds());

		// --- 3. ラベルの検証：指定されたIDが「実在し、かつこのボードのものである」ことを確認する ---
		List<Label> labels = labelIds.isEmpty()
				? Collections.emptyList()
				: labelRepository.findByBoardIdAndIdIn(board.getId(), labelIds);
		if (labels.size() != labelIds.size()) {
			// 要求件数と実際に見つかった件数が食い違うのは、「存在しないID」または「他ボードのID」が
			// 混ざっていたとき。どちらであってもクライアントの指定が誤っているという点は同じなので、
			// 個々にどのIDが悪かったかまでは特定せず、まとめて400として扱う。
			throw new InvalidRequestException("指定されたラベルの一部が、このボードに存在しません");
		}

		// --- 4. カード本体の組み立てと保存 ---
		Card card = new Card();
		card.setBoard(board);
		card.setTitle(title);
		card.setDescription(description);
		card.setDueDate(request.dueDate());
		card.setStatus(INITIAL_STATUS);
		card.setIsArchived(false);
		// 同一ボード・同一ステータス内の最大position+1を採番する。
		// 「1回SELECTしてから+1したものをINSERTする」という流れは、複数リクエストが同時に
		// 実行されると同じpositionを採番してしまう競合状態（レースコンディション）の余地がある。
		// 個人利用アプリで同時アクセスが実質発生しない本プロジェクトでは許容している
		// （表示順が多少前後する程度で、データが壊れるわけではない）。
		card.setPosition(cardRepository.findMaxPosition(board.getId(), INITIAL_STATUS) + 1);
		// createdAt/updatedAtはCardエンティティの@CreationTimestamp/@UpdateTimestampが
		// このあとのINSERT時に自動でセットするため、ここでは何もしない。
		Card saved = cardRepository.save(card);

		// --- 5. ラベルの紐付け（中間テーブルcard_labelへの行の追加） ---
		if (!labels.isEmpty()) {
			List<CardLabel> cardLabels = labels.stream()
					.map(label -> {
						CardLabel cardLabel = new CardLabel();
						// idフィールド（CardLabelId）は意図的に設定しない。setCard/setLabelで
						// 渡したエンティティのID（saved.getId() / label.getId()）から、
						// @MapsIdの仕組みがINSERT時に複合主キーを自動的に導出してくれるため。
						// 自分でidを組み立ててsetIdしてしまうと、Spring Dataの新規/既存判定
						// （isNew()）がid非nullを理由に「既存」と誤認し、persist（INSERT）ではなく
						// merge（SELECT→INSERT）が発行される回り道になる（docs/spring-boot/09-write-api-validation.md 31章参照）。
						cardLabel.setCard(saved);
						cardLabel.setLabel(label);
						return cardLabel;
					})
					.toList();
			cardLabelRepository.saveAll(cardLabels);
		}

		// --- 6. レスポンスDTOへの変換 ---
		// 一覧・詳細と同じtoResponsesを再利用する。内部で発行されるJPQL（CardLabelRepository経由）は
		// 実行前に永続化コンテキストの変更を自動的にflushする（デフォルトのFlushModeType.AUTO）ため、
		// 直前の5.で保存したcard_label行も、追加のflush操作なしでこのSELECTの結果に反映される。
		return toResponses(List.of(saved)).get(0);
	}

	// descriptionの正規化：未入力(null)・空白のみの入力を、DB上は同じ意味であるnullへ統一する。
	// 空文字列とnullをどちらも「未設定」として同一視することで、CardResponse.descriptionを
	// 読む側（フロントエンド）が2通りの「無い」を区別する必要がなくなる。
	private static String normalizeDescription(String description) {
		return (description == null || description.isBlank()) ? null : description.trim();
	}

	// labelIdsの正規化：未指定(null)は空リストへ、重複IDはdistinctで除去する。
	// 重複除去をしないと、同じラベルIDを2回渡された場合にcard_labelへ同じ複合主キーの行を
	// 2回INSERTしようとして一意制約違反になる。
	private static List<Integer> normalizeLabelIds(List<Integer> labelIds) {
		if (labelIds == null || labelIds.isEmpty()) {
			return Collections.emptyList();
		}
		return labelIds.stream().distinct().toList();
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
