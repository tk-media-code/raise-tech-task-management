import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { apiPaths } from '../api/client'
import CardDetailModal from '../components/CardDetailModal'
import LabelFilterBar from '../components/LabelFilterBar'
import SearchResultItem from '../components/SearchResultItem'
import StatusMessage from '../components/StatusMessage'
import { useApi } from '../hooks/useApi'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import type { CardResponse } from '../types/api'

/** キーワード入力が止まってから、実際に検索へ反映するまでの待ち時間 */
const DEBOUNCE_MS = 300

/**
 * URLの`labels`パラメータ（例: "1,2"）を数値の配列に変換する。
 * 空文字・未指定はどちらも「絞り込みなし」として空配列を返す。
 */
function parseLabelIds(params: URLSearchParams): number[] {
  const raw = params.get('labels')
  if (raw === null || raw === '') return []
  return raw.split(',').map(Number)
}

/** App.tsxの<Link to="/search" state={...}>から渡される、遷移元のパス情報 */
type SearchLocationState = {
  from?: string
}

/**
 * 検索結果画面（要件定義 docs/requirements/03-screens.md 6章の⑤）。
 * キーワード（タイトル・説明への部分一致）とラベル（要件5.8よりOR条件。バックエンドの
 * CardRepository.searchの実装に合わせている）を組み合わせて、全ボード横断でカードを絞り込む。
 * 横断ビュー・ボード詳細のどちらから開いても、この画面自体は常に全ボードを対象にする
 * （プロトタイプ prototype/app.js の openSearch と同じ挙動。ワイヤーフレームにも
 * 「現在のボード」を示すUIが無いことから、この画面は独立した全ボード検索として設計した）。
 *
 * 検索条件（キーワード・ラベル）は component の state ではなくURLクエリパラメータ
 * （useSearchParams）に持たせている。ブックマーク・リロードで条件が消えないことに加え、
 * ブラウザの戻る/進むで絞り込みの変更履歴を辿れるようにするため
 * （components/BoardSelect.tsxがuseMatchでURLを「唯一の真実」にしているのと同じ考え方を、
 * 検索条件という別の状態にも広げている）。
 */
function SearchView() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  // 「← 戻る」の遷移先。検索中に打鍵・ラベル選択のたびに履歴エントリが積まれていくため
  // （下記のURL同期を参照）、単純にnavigate(-1)で1つ前に戻ると、検索を開く前の画面ではなく
  // 「1つ前の絞り込み状態」に着地してしまう。App.tsxの<Link to="/search">がstateとして
  // 渡した「検索を開く直前のパス」へ直接navigateすることで、何回検索条件を変えていても
  // 1回のクリックで元の画面に戻れるようにしている。
  // /search?q=... を直接開いた場合などstateが無いときは、アプリの入口である横断ビュー（/）
  // へ戻す。
  //
  // useState(() => ...)の遅延初期化で「マウント時の1回だけ」location.stateから読み取り、
  // 以後はこのローカルstateを正とする。react-routerのsetSearchParamsは、何も指定しなければ
  // 新しく積む履歴エントリにstateを引き継いでくれない（前のエントリのstateが消える）ため、
  // 検索中に何度URLが変わってもfromPathを見失わないよう、値そのものをここで固定しておき、
  // 以降のsetSearchParams呼び出し（下記）ではこの値を毎回stateとして明示的に渡し直す。
  const [fromPath] = useState(() => (location.state as SearchLocationState | null)?.from ?? '/')

  const keywordInUrl = searchParams.get('q') ?? ''
  const labelIdsInUrl = parseLabelIds(searchParams)

  // キーワード入力欄は打鍵のたびに再描画したいので、URLとは別にローカルstateを持つ。
  // 初期値をkeywordInUrlにしているのは、/search?q=... を直接開いた場合や
  // ブラウザの戻る/進むで着地した場合に、入力欄へ既存の条件を反映するため。
  const [keywordInput, setKeywordInput] = useState(keywordInUrl)
  const debouncedKeyword = useDebouncedValue(keywordInput, DEBOUNCE_MS)

  // 【逆方向の同期】ブラウザの戻る/進む・URLの直接編集など、このコンポーネントの
  // 外側の要因でURLのqが変わったときは、入力欄の表示もそれに合わせて更新する。
  // これが無いと「URLは前の検索条件に戻ったのに、入力欄の文字だけ新しい方のまま」
  // というズレが起きる。依存配列がkeywordInUrlだけなので、keywordInputをここで
  // 更新しても（それ自体はkeywordInUrlの値ではないので）このeffectが自分自身を
  // 再度呼び出すことはない。
  useEffect(() => {
    setKeywordInput(keywordInUrl)
  }, [keywordInUrl])

  // 【確定方向の同期】debounceが確定したらURLへ書き戻す。
  //
  // 呼び出す**前**にdebouncedKeyword===keywordInUrlを見て、変化が無ければ
  // setSearchParams自体を呼ばないのが重要。setSearchParamsは「内容が変わらないupdater」
  // （＝同じprevをそのまま返す）を渡しても、呼び出したという事実だけで履歴エントリを
  // 1つ消費してしまう（ReactのuseStateのように「同じ値ならバイパスする」仕組みは無い）。
  // そのため「本当に変更が必要なときだけ呼ぶ」形にしないと、意図しない履歴エントリが
  // 積まれ続けてしまう。
  //
  // 依存配列がdebouncedKeywordだけで、setSearchParamsもkeywordInUrlも含めていないのは
  // 意図的:
  // (1) setSearchParamsは呼び出しのたびに関数の同一性が変わり得る（react-routerの
  //     実装依存）。依存配列に入れると、ラベル絞り込みのような無関係なURL変更のたびに
  //     このeffectが再実行され、そのたびに（中身が変わらなくても）呼び出しが発生し、
  //     余分な履歴エントリが増えてしまう。
  // (2) keywordInUrlを依存配列に入れると、「戻る/進むでURLが変わった直後、
  //     まだ古い値のままのdebouncedKeywordがそれを上書きし返してしまう」という
  //     競合が起きる（debouncedKeywordはuseDebouncedValueの内部タイマー分だけ
  //     反映が遅れるため、一瞬だけURLの新しい値と食い違う瞬間がある）。
  //     debouncedKeywordの変化だけをトリガーにすることで、この競合を避けている
  //     （そのタイミングでは既にkeywordInUrlは最新になっている）。
  useEffect(() => {
    if (debouncedKeyword === keywordInUrl) return

    setSearchParams(
      (prev) => {
        // 呼び出し前のガードだけで十分だが、念のためprevからも同じ判定をしておく
        // （呼び出し前チェックと実際の書き込みの間に、理論上は別の変更が挟まる余地があるため）。
        const current = prev.get('q') ?? ''
        if (debouncedKeyword === current) return prev
        const next = new URLSearchParams(prev)
        if (debouncedKeyword === '') next.delete('q')
        else next.set('q', debouncedKeyword)
        return next
      },
      // stateを明示的に渡し直さないと、この呼び出しで新しく積む履歴エントリの
      // location.stateがnullになり、fromPath（「← 戻る」の行き先）を見失ってしまう。
      { state: { from: fromPath } satisfies SearchLocationState },
    )
    // replace指定はしていない（＝既定のpush）。debounceで打鍵ごとの連発は防げているため、
    // 確定した検索条件の変化ごとに履歴へ積んでよく、それによってブラウザの戻る/進むで
    // 検索条件の変化を辿れるようにしている。
    //
    // keywordInUrlとsetSearchParamsを意図的に依存配列から外している。理由は上記(1)(2)のとおりで、
    // どちらも含めると「戻る操作との競合」や「無関係なURL変更での余分な履歴」を招く。
    // fromPathはuseStateの初期値のまま変わらない値なので、依存配列に入れても入れなくても
    // 再実行のタイミングに影響しないが、実際に参照している値として明記しておく。
    //
    // 上記のとおり意図的な省略であることを、ルールに対しても明示する。
    // ESLintは導入していないため接頭辞はoxlint-（.oxlintrc.jsonで
    // react-hooks/exhaustive-depsをerrorとして有効化している）。
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedKeyword, fromPath])

  /** ラベルチップがクリックされたとき、選択中なら外し、そうでなければ加える */
  function toggleLabel(labelId: number) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        const current = parseLabelIds(next)
        const updated = current.includes(labelId)
          ? current.filter((id) => id !== labelId)
          : [...current, labelId]
        if (updated.length === 0) next.delete('labels')
        else next.set('labels', updated.join(','))
        return next
      },
      // キーワードの確定時と同じ理由で、fromPathを次の履歴エントリにも引き継ぐ。
      { state: { from: fromPath } satisfies SearchLocationState },
    )
  }

  const { data: cards, loading, error, refetch } = useApi<CardResponse[]>(
    apiPaths.cards({
      keyword: debouncedKeyword === '' ? undefined : debouncedKeyword,
      labelIds: labelIdsInUrl.length > 0 ? labelIdsInUrl : undefined,
    }),
  )

  const [selectedCardId, setSelectedCardId] = useState<number | null>(null)

  function renderContent() {
    if (loading) return <StatusMessage kind="loading">読み込み中…</StatusMessage>
    if (error !== null) {
      return <StatusMessage kind="error">読み込みに失敗しました：{error.message}</StatusMessage>
    }
    if (cards === null) return null

    return (
      <>
        {/* プロトタイプと同じく、0件でも「n件ヒット」の行自体は常に表示する */}
        <p className="mb-2 text-xs text-slate-500">{cards.length}件ヒット</p>
        {cards.length === 0 ? (
          <StatusMessage kind="empty">条件に一致するカードがありません。</StatusMessage>
        ) : (
          <div className="flex flex-col gap-2">
            {cards.map((card) => (
              <SearchResultItem
                key={card.id}
                card={card}
                onSelect={(cardId) => setSelectedCardId(cardId)}
              />
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(fromPath)}
          className="text-sm text-blue-600 hover:underline"
        >
          ← 戻る
        </button>
        <h2 className="text-lg font-semibold">🔍 検索</h2>
      </div>

      <input
        type="text"
        value={keywordInput}
        onChange={(event) => setKeywordInput(event.target.value)}
        placeholder="キーワード（タイトル・説明）"
        aria-label="検索キーワード"
        className="mb-4 w-full rounded border border-slate-300 px-3 py-2 text-sm"
      />

      <div className="mb-4">
        <LabelFilterBar selectedLabelIds={labelIdsInUrl} onToggle={toggleLabel} />
      </div>

      {renderContent()}

      <CardDetailModal cardId={selectedCardId} onUpdated={refetch} onClose={() => setSelectedCardId(null)} />
    </section>
  )
}

export default SearchView
