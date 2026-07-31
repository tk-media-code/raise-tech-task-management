import type { ProblemDetail } from '../types/api'

/**
 * バックエンドAPIのベースURL（例: "http://localhost:8080"）。
 *
 * import.meta.env はViteが提供する環境変数の入れ物で、`VITE_` で始まる変数だけが
 * ビルド時にこの位置へ文字列として埋め込まれる（＝ブラウザから丸見えになるので秘密情報は置かない）。
 * 値は frontend/.env.development から読まれる（vite-env.d.ts で型を拡張済み）。
 *
 * `?? ''` のフォールバックは本番ビルド用。`npm run build` は production モードで動くため
 * .env.development を読み込まず、この変数はundefinedになる。空文字にしておけば
 * リクエスト先が "/api/boards" という相対URLになり、画面とAPIを同一オリジンに置く
 * 本番構成（要件定義9.1のリバースプロキシ配下）でそのまま動く。
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

/**
 * APIがエラー応答を返したこと、あるいはAPIに到達できなかったことを表す例外。
 * 素のErrorではなく専用クラスにしておくと、呼び出し側が `err instanceof ApiError` で
 * 「APIのエラー」と「コードのバグ（TypeErrorなど）」を区別できる。
 */
export class ApiError extends Error {
  /** HTTPステータスコード。レスポンス自体に到達できなかった場合（通信断・CORS拒否）はnull */
  readonly status: number | null
  /** サーバーが返したRFC 9457形式のエラー本文。取得できなかった場合はnull */
  readonly problem: ProblemDetail | null

  constructor(message: string, status: number | null, problem: ProblemDetail | null) {
    super(message)
    // ErrorのnameはデフォルトでずっとError。console上でひと目で識別できるよう上書きする。
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}

/**
 * エラーレスポンスの本文をRFC 9457（Problem Details for HTTP APIs）として読む。
 * バックエンドは spring.mvc.problemdetails.enabled=true により、
 * 自前の404もフレームワークが返す400も同じ形（application/problem+json）で返してくる。
 *
 * @returns パースできた場合はProblemDetail、そうでなければnull
 */
async function readProblemDetail(response: Response): Promise<ProblemDetail | null> {
  // Content-Typeには "application/problem+json;charset=UTF-8" のように
  // パラメータが付くことがあるため、完全一致ではなく前方一致で判定する。
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.startsWith('application/problem+json')) return null
  try {
    return (await response.json()) as ProblemDetail
  } catch {
    // ここに来るのは「Content-Typeはproblem+jsonなのに本文が壊れている」という異常系。
    // エラー処理の中でさらに例外を投げると本来のエラーが握り潰されるので、nullに倒す。
    return null
  }
}

/**
 * fetchを実行し、レスポンスのJSONを指定した型として返す共通処理。
 * GET用の{@link fetchJson}・POST用の{@link postJson}の両方がこの関数に委譲する
 * （HTTPメソッドが違うだけで、エラーの扱い方・JSONへの変換方法は完全に共通のため）。
 *
 * 責務の分担: このファイル（クライアント）が持つのは「APIがどこにあるか」（ベースURL）と
 * 「HTTPレスポンスをどう値かErrorに変えるか」。Reactのライフサイクル（state・再フェッチの
 * タイミングなど）は一切知らず、hooks/useApi.ts・hooks/useMutation.ts 側の責務にしている。
 *
 * @param path APIのパス（例: "/api/boards"）。ベースURLはこの関数が前置する
 * @param init fetchにそのまま渡すオプション（method・headers・body・signalなど）
 * @returns パースしたJSON
 * @throws ApiError HTTPステータスが2xx以外だった場合、またはAPIに到達できなかった場合
 */
async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init)
  } catch (cause) {
    // 中断は呼び出し側（useApiのクリーンアップ）が意図してやったこと。
    // ここで握り潰すと中断が「通信エラー」として画面に出てしまうので、そのまま投げ直す。
    if (cause instanceof Error && cause.name === 'AbortError') throw cause
    // fetchがreject（＝TypeError: Failed to fetch）するのは、サーバーに到達できなかったか、
    // ブラウザがCORSでレスポンスを破棄したとき。ブラウザは攻撃者に手がかりを与えないため
    // JS側にはどちらなのか教えてくれない（詳細はDevToolsのConsole/Networkにだけ出る）。
    throw new ApiError(
      'APIサーバーに接続できませんでした。バックエンドが起動しているか、CORSの設定が正しいかを確認してください。',
      null,
      null,
    )
  }

  // ここが最大の落とし穴: fetchは404でも500でもrejectしない。
  // 「サーバーと通信できた」時点で成功扱いになるため、HTTPステータスは自分で見る必要がある
  // （axiosやjQueryの $.ajax が自動でエラーにしてくれるのとは挙動が違う）。
  if (!response.ok) {
    const problem = await readProblemDetail(response)
    // detail（このエラー固有の説明）→ title（種類名）→ 生のステータス、の順で
    // 一番具体的なメッセージを採用する。
    const message =
      problem?.detail ?? problem?.title ?? `HTTP ${response.status} ${response.statusText}`
    throw new ApiError(message, response.status, problem)
  }

  // `as T` は「このJSONはT型だと信じる」という宣言にすぎず、実行時の検証は一切されない。
  // 型定義（types/api.ts）とバックエンドのDTOがずれていても、TypeScriptは気づけない。
  // 外部から来るデータに対する型は「保証」ではなく「約束」だという点は覚えておくこと。
  return (await response.json()) as T
}

/**
 * APIをGETで叩き、レスポンスのJSONを指定した型として返す。
 *
 * @param path   APIのパス（例: "/api/boards"）。ベースURLはこの関数が前置する
 * @param signal 中断用のシグナル（AbortControllerから取得したもの）
 * @returns パースしたJSON
 * @throws ApiError HTTPステータスが2xx以外だった場合、またはAPIに到達できなかった場合
 */
export async function fetchJson<T>(path: string, signal: AbortSignal): Promise<T> {
  return request<T>(path, { signal })
}

/**
 * APIをボディ付きのHTTPメソッド（POST/PUT/PATCH）で叩き、レスポンスのJSONを指定した型として返す。
 * {@link postJson}・{@link putJson}・{@link patchJson}の3つがこの関数に委譲する
 * （GET用の{@link fetchJson}・POST用の{@link postJson}が両方requestに委譲していたのと同じ、
 * 「メソッドが違うだけで、エラーの扱い方・JSONへの変換方法は完全に共通」という考え方）。
 *
 * @param method HTTPメソッド
 * @param path   APIのパス（例: "/api/cards"）
 * @param body   リクエストボディに乗せるオブジェクト。JSON.stringifyでJSON文字列に変換して送る
 * @returns パースしたレスポンスJSON
 * @throws ApiError HTTPステータスが2xx以外だった場合、またはAPIに到達できなかった場合
 */
// fetchJsonと違い、signalを引数に取らない（＝中断できない）のは意図的な非対称。
// GETの中断は「表示しても無駄になった結果を捨てる」だけの安全な操作だが、書き込み系（POST/PUT/PATCH）は
// 呼び出し元でfetchをabortしても、サーバー側では既に処理が進行・完了している可能性があり、
// クライアント側のPromiseを中断してもDBへの書き込みそのものは取り消せない
// （「中断したつもり」なのに実際には登録・更新されている、という状態を防ぐため、
// あえて中断の手段を用意していない）。この考え方はPUT/PATCHでも変わらない。
async function sendJson<TRequest, TResponse>(
  method: 'POST' | 'PUT' | 'PATCH',
  path: string,
  body: TRequest,
): Promise<TResponse> {
  return request<TResponse>(path, {
    method,
    // Content-Typeを明示しないと、Jacksonが@RequestBodyをJSONとして解釈してくれない
    // （バックエンドはこのヘッダーを見てボディの読み方を選ぶ）。
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * APIをPOSTで叩き、レスポンスのJSONを指定した型として返す（新規作成用）
 * （docs/typescript/06-async.md 15章参照）。
 *
 * @param path APIのパス（例: "/api/cards"）
 * @param body リクエストボディに乗せるオブジェクト
 * @returns パースしたレスポンスJSON（作成されたリソースを表すDTO）
 * @throws ApiError HTTPステータスが2xx以外だった場合、またはAPIに到達できなかった場合
 */
export async function postJson<TRequest, TResponse>(path: string, body: TRequest): Promise<TResponse> {
  return sendJson<TRequest, TResponse>('POST', path, body)
}

/**
 * APIをPUTで叩き、レスポンスのJSONを指定した型として返す（リソース全体の更新用）。
 * カード編集（{@code PUT /api/cards/{id}}）で使う。
 *
 * @param path APIのパス（例: "/api/cards/1"）
 * @param body リクエストボディに乗せるオブジェクト
 * @returns パースしたレスポンスJSON（更新後のリソースを表すDTO）
 * @throws ApiError HTTPステータスが2xx以外だった場合、またはAPIに到達できなかった場合
 */
export async function putJson<TRequest, TResponse>(path: string, body: TRequest): Promise<TResponse> {
  return sendJson<TRequest, TResponse>('PUT', path, body)
}

/**
 * APIをPATCHで叩き、レスポンスのJSONを指定した型として返す（リソースの部分更新用）。
 * カードのステータス変更（{@code PATCH /api/cards/{id}/status}）で使う。
 *
 * @param path APIのパス（例: "/api/cards/1/status"）
 * @param body リクエストボディに乗せるオブジェクト
 * @returns パースしたレスポンスJSON（更新後のリソースを表すDTO）
 * @throws ApiError HTTPステータスが2xx以外だった場合、またはAPIに到達できなかった場合
 */
export async function patchJson<TRequest, TResponse>(path: string, body: TRequest): Promise<TResponse> {
  return sendJson<TRequest, TResponse>('PATCH', path, body)
}

/**
 * APIのパスを組み立てる関数群。
 * URLの文字列をコンポーネントに散らばらせず、ここ1箇所に集約する。
 * バックエンドのエンドポイントが変わったとき、直す場所がこのオブジェクトだけで済む。
 *
 * どの関数も「同じ引数なら必ず同じ文字列を返す」純粋な関数であることが重要。
 * useApiの依存配列はこの戻り値（文字列）をObject.isで比較するため、
 * 毎レンダリングで呼び直しても中身が同じなら再フェッチは起きない。
 */
export const apiPaths = {
  /** ボード一覧 */
  boards: () => '/api/boards',

  /** ボード1件 */
  board: (boardId: number | string) => `/api/boards/${boardId}`,

  /**
   * カード一覧（絞り込み）。
   * URLSearchParamsを使うのは、値に含まれる記号（&や日本語など）を自動でURLエンコードしてくれるため。
   * 文字列連結で組み立てると、キーワード検索（日本語や記号を含み得る）で簡単に壊れる。
   *
   * @param params.boardId   指定したボードのカードのみに絞り込む（横断ビュー・検索画面では省略）
   * @param params.keyword   タイトル・説明への部分一致キーワード（要件5.8）。空文字はパラメータ自体を省略する
   * @param params.labelIds  ラベルによる絞り込み（要件5.8）。バックエンドはOR条件（いずれか1つでも
   *                         付いていればヒット）で実装済み。カンマ区切りの1パラメータにまとめて渡す
   *                         （`?labelIds=1&labelIds=2`形式もバックエンドは受け付けるが、
   *                         URLへの反映のしやすさ＝pages/SearchView.tsxのURLクエリと1対1にできるため
   *                         こちらの形にしている）
   * @param params.archived  アーカイブ済みカードだけを取得するか（true）、非アーカイブのみか
   *                         （false、既定）。pages/ArchiveView.tsxだけがtrueを渡す
   */
  cards: (params: { boardId?: number | string; keyword?: string; labelIds?: number[]; archived?: boolean } = {}) => {
    const query = new URLSearchParams()
    if (params.boardId !== undefined) query.set('boardId', String(params.boardId))
    if (params.keyword !== undefined && params.keyword !== '') query.set('keyword', params.keyword)
    if (params.labelIds !== undefined && params.labelIds.length > 0) {
      query.set('labelIds', params.labelIds.join(','))
    }
    // archivedはバックエンド側の既定値もfalseだが、あえて明示する。
    // 「アーカイブ済みは表示しない」は画面の仕様（要件5.7）であって、
    // サーバーの既定値に暗黙で依存すべきではないため（未指定時はfalseに倒す）。
    query.set('archived', String(params.archived ?? false))
    return `/api/cards?${query.toString()}`
  },

  /**
   * カード1件（アーカイブ済みかどうかを問わず取得できる）。
   * GET（詳細取得）だけでなく、PUT（カード編集、components/CardDetailModal.tsx）の送信先としても
   * 使う。createCard()がcards()と別関数になっているのは、cards()が常にクエリパラメータ
   * （archived=falseなど）を付ける関数で文字列が一致しないためだが、こちらはGET/PUTのどちらでも
   * "/api/cards/{id}" という完全に同じ文字列になるため、別名の関数を分ける理由が無い。
   */
  card: (cardId: number | string) => `/api/cards/${cardId}`,

  /** カードのステータス変更（PATCH）先のパス。列間の移動・列内の並べ替えの両方をここへ送る */
  updateCardStatus: (cardId: number | string) => `/api/cards/${cardId}/status`,

  /** カードのアーカイブ状態変更（PATCH）先のパス。アーカイブする・復元する（要件5.7）の両方をここへ送る */
  updateCardArchive: (cardId: number | string) => `/api/cards/${cardId}/archive`,

  /** 指定ボードのラベル一覧（検索画面のラベル絞り込みUIで、ボードごとにグループ化する際に使う） */
  boardLabels: (boardId: number | string) => `/api/boards/${boardId}/labels`,

  /**
   * カード新規作成（POST）先のパス。
   * cards()と同じ"/api/cards"だが、cards()は一覧取得用にarchived等のクエリを必ず付ける関数のため
   * 流用せず、書き込み用に引数を取らない別関数として分けている。
   */
  createCard: () => '/api/cards',

  /** ボード新規作成（POST）先のパス */
  createBoard: () => '/api/boards',
}
