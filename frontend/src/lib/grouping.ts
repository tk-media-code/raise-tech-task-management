import type { CardResponse, CardStatus } from '../types/api'
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
 * プロトタイプ（prototype/app.js）は空のボードセクションも「▼ ボード名」として
 * 表示するが、ここではカードから導出するため、1枚もカードが無いボードのセクションは
 * 出てこない。単一リクエストで完結させたいことと、3ボード×3列ぶんの空見出しが
 * ノイズになることを優先した判断（プロトタイプに合わせたくなったら、ボード一覧を
 * 引数に追加して各Mapを先に埋めておく形に変更できる）。
 *
 * @param cards GET /api/cards の結果。読み込み中はnullが渡ってくる
 * @returns 3つのステータスすべてをキーに持つオブジェクト（該当カードが無いステータスは空配列）
 */
export function groupCardsByStatusAndBoard(cards: CardResponse[] | null): GroupedCards {
  // Map<ボードID, BoardGroup> をステータスごとに用意する。
  // Recordで todo/doing/done の3キーを型で強制しているので、
  // 将来ステータスが増えたときにここを書き忘れるとコンパイルエラーになって気づける。
  const byStatus: Record<CardStatus, Map<number, BoardGroup>> = {
    todo: new Map(),
    doing: new Map(),
    done: new Map(),
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

    const boards = byStatus[card.status]
    let group = boards.get(card.boardId)
    if (group === undefined) {
      // このステータス列でそのボードが初めて登場した瞬間にセクションを作る。
      // ＝セクションの並び順は「最初に登場した順」＝board.position順になる。
      group = { boardId: card.boardId, boardName: card.boardName, cards: [] }
      boards.set(card.boardId, group)
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
