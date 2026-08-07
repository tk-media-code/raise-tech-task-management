import type { BoardResponse, CardResponse, CardStatus } from '../types/api'
import { isCardStatus } from './status'

/** 横断ビューで、1つのステータス列の中に置くボード別セクション1つぶん */
export type BoardGroup = {
  boardId: number
  boardName: string
  cards: CardResponse[]
}

/** ステータス（3種固定）ごとの、ボード別セクションの一覧 */
export type GroupedCards = Record<CardStatus, BoardGroup[]>

/**
 * フラットなカード配列を「ステータス → ボード → カード」の3階層に組み替える（横断ビュー用）。
 *
 * バックエンド（CardRepository.search のJPQL）は
 * board.position → board.id → status(todo,doing,done) → card.position → card.id
 * の順に並べて返してくる。ボードが最も外側のソートキーなので、
 * この関数はフロント側で並べ替えを一切行わない。Mapが「キーを最初に入れた順」を保つ性質だけで、
 * サーバーが決めた表示順（ボードのposition順）がそのまま結果に写る。
 *
 * プロトタイプ（prototype/app.js の buildQuickAddHtml/buildCrossViewHtml）は、横断ビューの
 * 未着手列でも各ボードから「＋ カードを追加」できるようにするため、カードが1枚も無い
 * ボードのセクションも「▼ ボード名」として表示していた。当初はカードから導出する
 * だけの実装にしていたためこの挙動が抜け落ちていたが、それでは「カードが1枚も無い
 * ボード」に横断ビューから追加する手段が無くなってしまう（ボード詳細画面まで
 * 遷移しないといけない）。そこで第2引数にボード一覧を受け取り、カードを走査する
 * “前”に3つのステータスすべてへ空のBoardGroupを先に登録しておく形にした
 * （board.position順はboardsの並び順＝BoardRepository.findAllByOrderByPositionAscIdAsc
 * の結果がそのまま反映される）。
 *
 * boardsがnull（App.tsx側でボード一覧が未取得・取得失敗）のときは事前登録をスキップし、
 * 従来どおりカードから導出するだけのフォールバックにする。ボード一覧が引けなくても、
 * 少なくともカードのあるボードだけは表示され続ける。
 *
 * @param cards GET /api/cards の結果。読み込み中はnullが渡ってくる
 * @param boards GET /api/boards の結果（App.tsxが取得済みのものをそのまま渡す）。
 *   未取得・取得失敗のときはnull
 * @returns 3つのステータスすべてをキーに持つオブジェクト（該当ボードが無いステータスは空配列）
 */
export function groupCardsByStatusAndBoard(
  cards: CardResponse[] | null,
  boards: BoardResponse[] | null,
): GroupedCards {
  // Map<ボードID, BoardGroup> をステータスごとに用意する。
  // Recordで todo/doing/done の3キーを型で強制しているので、
  // 将来ステータスが増えたときにここを書き忘れるとコンパイルエラーになって気づける。
  const byStatus: Record<CardStatus, Map<number, BoardGroup>> = {
    todo: new Map(),
    doing: new Map(),
    done: new Map(),
  }

  // カードを見る前に、全ボード×全ステータスぶんの空セクションを先に作っておく。
  // これにより「カードが1枚も無いボード」もセクション自体は出現するようになる
  // （中身のcardsが空配列のまま、というだけ）。boardsがnullの間はこのブロックを
  // 丸ごとスキップする＝カード起点の従来ロジックだけで動くフォールバックになる。
  if (boards !== null) {
    for (const board of boards) {
      byStatus.todo.set(board.id, { boardId: board.id, boardName: board.name, cards: [] })
      byStatus.doing.set(board.id, { boardId: board.id, boardName: board.name, cards: [] })
      byStatus.done.set(board.id, { boardId: board.id, boardName: board.name, cards: [] })
    }
  }

  // `cards ?? []` は「nullなら空配列として扱う」という書き方。
  // 読み込み中（null）でも空のグルーピングを返せるので、呼び出し側で分岐が要らない。
  for (const card of cards ?? []) {
    // card.status の型は CardStatus だが、それは「JSONがそうなっているはず」という
    // 約束にすぎず、実行時の保証ではない（api/client.ts の `as T` を参照）。
    // 想定外の値が来ても byStatus[未知のキー] が undefined になって画面が
    // 真っ白になるのを防ぐため、型ガードで弾く。
    if (!isCardStatus(card.status)) {
      console.warn(`未知のステータスのカードを無視した: id=${card.id}, status=${card.status}`)
      continue
    }

    // 外側の引数`boards`（ボード一覧）とは別物なので、シャドーイングを避けて別名にする。
    const sectionsForStatus = byStatus[card.status]
    let group = sectionsForStatus.get(card.boardId)
    if (group === undefined) {
      // 通常は上の事前登録で必ず見つかるはずだが、boardsがnullだったフォールバック時、
      // または（本来起き得ないが）ボード一覧に無いboardIdのカードが来た場合に備えて、
      // ここで初めて登場した時点でもセクションを作れるようにしておく。
      // その場合のセクションの並び順は「カード配列内で最初に登場した順」になる。
      group = { boardId: card.boardId, boardName: card.boardName, cards: [] }
      sectionsForStatus.set(card.boardId, group)
    }
    // pushはサーバーが返した順に積むだけ。card.position順もここで自然に保たれる。
    group.cards.push(card)
  }

  return {
    todo: Array.from(byStatus.todo.values()),
    doing: Array.from(byStatus.doing.values()),
    done: Array.from(byStatus.done.values()),
  }
}

/**
 * 横断ビューの1ステータスぶんのボード別セクション一覧から、カードの合計件数を数える。
 * StatusColumnの列見出し（例:「未着手 (2)」）とMobileStatusTabsのタブラベル
 * （components/MobileStatusTabs.tsx、要件8.1）が同じ数を表示する必要があるため、
 * 元は呼び出し側（CrossBoardView.tsx）で個別にreduceしていた計算をここへ集約した。
 */
export function countCardsInGroups(groups: BoardGroup[]): number {
  return groups.reduce((sum, group) => sum + group.cards.length, 0)
}

/**
 * フラットなカード配列を「ステータス → カード」の2階層に組み替える（ボード詳細画面用）。
 * 単一ボードの画面ではボード別セクションが不要なので、こちらを使う。
 */
export function groupCardsByStatus(cards: CardResponse[] | null): Record<CardStatus, CardResponse[]> {
  const byStatus: Record<CardStatus, CardResponse[]> = { todo: [], doing: [], done: [] }
  for (const card of cards ?? []) {
    if (!isCardStatus(card.status)) continue
    byStatus[card.status].push(card)
  }
  return byStatus
}
