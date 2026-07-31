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
  /**
   * バリデーションエラー（400）のときだけ含まれる、フィールド名→エラーメッセージの対応。
   * RFC 9457は標準メンバー以外の拡張を許容しており、これはバックエンドの
   * GlobalExceptionHandler.handleValidationError が独自に追加している拡張メンバー
   * （backend/.../exception/GlobalExceptionHandler.java 参照）。
   * 404など他の種類のエラーには含まれないため、他のフィールドと同じく省略可能にしている。
   */
  errors?: Record<string, string>
}

/**
 * カード新規作成API（{@code POST /api/cards}}）のリクエストボディ。
 * バックエンド: backend/.../dto/CardCreateRequest.java（フィールド名・順序を一致させる）
 *
 * description・dueDate・labelIdsを省略可能にしているのは、要件5.2「タイトルのみでカードを
 * 新規作成できる」に対応するため。ただし送信時は明示的に`null`を入れる方針にしている
 * （components/CardCreateForm.tsx参照）。undefinedにして省略した場合でも、JSON.stringifyが
 * そのキー自体を出力しないため結果的にサーバー側の「未指定」と同じ扱いになるが、
 * 「入力欄が空だった」ことを明示する方が意図が伝わりやすいため。
 */
export type CardCreateRequest = {
  boardId: number
  title: string
  description: string | null
  dueDate: string | null
  labelIds: number[]
}

/**
 * ボード新規作成API（{@code POST /api/boards}}）のリクエストボディ。
 * バックエンド: backend/.../dto/BoardCreateRequest.java
 */
export type BoardCreateRequest = {
  name: string
}

/**
 * ボード名変更API（{@code PUT /api/boards/{id}}）のリクエストボディ。
 * バックエンド: backend/.../dto/BoardUpdateRequest.java
 */
export type BoardUpdateRequest = {
  name: string
}

/**
 * ボードの並べ替えAPI（{@code PATCH /api/boards/{id}/position}）のリクエストボディ。
 * バックエンド: backend/.../dto/BoardPositionUpdateRequest.java
 *
 * ボード管理モーダルでの `⠿` ドラッグ・`▲`/`▼` ボタン、どちらの操作もこの型でリクエストを送る。
 * CardStatusUpdateRequest.positionと違い、こちらは省略できない（必須）。ボードの並べ替えには
 * 「位置を指定せずとりあえず末尾へ動かす」という呼び出し元が無く、常に明確な移動先を
 * 指定できる操作（ドラッグの着地点・▲▼が指す隣の位置）からしか呼ばれないため。
 */
export type BoardPositionUpdateRequest = {
  /** 並べ替え後の一覧内での挿入位置（0始まり） */
  position: number
}

/**
 * ラベル新規作成API（{@code POST /api/boards/{id}/labels}}）のリクエストボディ。
 * バックエンド: backend/.../dto/LabelCreateRequest.java
 *
 * colorは自由入力ではなく、`lib/labelColors.ts`のLABEL_COLORSから選んだ値をそのまま送る
 * （既定パレット外の値を送ってもバックエンドが400で拒否する）。
 */
export type LabelCreateRequest = {
  name: string
  color: string
}

/**
 * カード編集API（{@code PUT /api/cards/{id}}）のリクエストボディ。
 * バックエンド: backend/.../dto/CardUpdateRequest.java
 *
 * CardCreateRequestと違い、boardId・statusを持たない（理由はバックエンドのCardUpdateRequestの
 * クラスコメントと同じ：ボード間移動はスコープ外、ステータス変更は別APIの責務）。
 */
export type CardUpdateRequest = {
  title: string
  description: string | null
  dueDate: string | null
  labelIds: number[]
}

/**
 * カードのステータス変更API（{@code PATCH /api/cards/{id}/status}）のリクエストボディ。
 * バックエンド: backend/.../dto/CardStatusUpdateRequest.java
 *
 * ドラッグ＆ドロップ（列間移動・列内の並べ替え）、カード上の「移動」メニュー、
 * カード詳細モーダルのステータス選択、いずれの操作からもこの型でリクエストを送る。
 */
export type CardStatusUpdateRequest = {
  status: CardStatus
  /** 移動先ステータス列内での挿入位置（0始まり）。省略時（undefined）は列の末尾に挿入される */
  position?: number
}

/**
 * カードのアーカイブ状態変更API（{@code PATCH /api/cards/{id}/archive}）のリクエストボディ。
 * バックエンド: backend/.../dto/CardArchiveUpdateRequest.java
 *
 * カード詳細モーダルの「アーカイブ」ボタン（archived: true）・アーカイブ画面の「復元」ボタン
 * （archived: false）の両方が、この同じ型でリクエストを送る（要件定義5.7）。
 */
export type CardArchiveUpdateRequest = {
  archived: boolean
}
