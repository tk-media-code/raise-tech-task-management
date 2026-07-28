/**
 * バックエンドAPIが返すJSONの型定義。
 *
 * ここに書く型は、バックエンドの `dto/` パッケージにあるJavaの record と1対1で対応させる
 * （フィールド名・順序をそのまま踏襲する）。ただし本当に対応しているかをTypeScriptが
 * 検証してくれるわけではなく、あくまで「このJSONはこの形のはず」という人間側の約束にすぎない
 * （実際にJSONを受け取る場所は api/client.ts の `as T` を参照）。
 * バックエンドのDTOを変更したら、必ずこのファイルも合わせて直すこと。
 */

/**
 * カードのステータス（固定3種）。
 * バックエンドの `Card` エンティティで `@Check(constraints = "status in ('todo','doing','done')")`
 * によりDBレベルでも3値に制約されている（docs/spring-boot/03-entity-jpa.md 14章）。
 *
 * 文字列リテラルの合併（ユニオン型）にしておくと、`status === 'todi'` のような
 * タイプミスをコンパイル時に検出できる（単なる `string` ではこの恩恵がない）。
 */
export type CardStatus = 'todo' | 'doing' | 'done'

/**
 * ボード（GET /api/boards, GET /api/boards/{id} のレスポンス）。
 * バックエンド: backend/.../dto/BoardResponse.java
 */
export type BoardResponse = {
  id: number
  name: string
  position: number
  /** ISO-8601形式の日時文字列（例: "2026-07-20T00:00:00Z"）。今回の画面では表示に使わない */
  createdAt: string
}

/**
 * ラベル（CardResponse.labels の要素、および GET /api/boards/{id}/labels のレスポンス）。
 * バックエンド: backend/.../dto/LabelResponse.java
 */
export type LabelResponse = {
  id: number
  name: string
  /** "#e74c3c" のような16進カラーコード。表示色にそのまま使う */
  color: string
}

/**
 * カード（GET /api/cards, GET /api/cards/{id} のレスポンス）。
 * バックエンド: backend/.../dto/CardResponse.java
 *
 * description・dueDateが `string | null` なのは、DBのカラムがNULL許容だから
 * （Java側もString/LocalDateで、値が無ければnullを返す）。
 * labelsは常に配列で、ラベル無しの場合も `[]`（nullにはならない）。
 */
export type CardResponse = {
  id: number
  boardId: number
  boardName: string
  title: string
  description: string | null
  /** "YYYY-MM-DD" 形式。未設定ならnull */
  dueDate: string | null
  status: CardStatus
  isArchived: boolean
  position: number
  labels: LabelResponse[]
}

/**
 * エラー応答の型（RFC 9457 Problem Details for HTTP APIs）。
 * バックエンドは `spring.mvc.problemdetails.enabled=true` により、
 * 自前の404（GlobalExceptionHandler）もフレームワークが返す400も同じ形で返してくる。
 *
 * 全フィールドを省略可能にしているのは、RFC上どのメンバーも必須ではなく、
 * 実際に返る内容がエラーの種類によって変わり得るため。
 * 「型を厳しくして実態と合わなくなる」より「緩めにして安全に使う」ことを優先している。
 */
export type ProblemDetail = {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
}
