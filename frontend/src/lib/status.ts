import type { CardStatus } from '../types/api'

/**
 * ステータス関連の定数・型ガード。
 *
 * 「未着手／作業中／完了」の3列は要件定義で固定と決められており、
 * ボードごとに列を増減させたり自由なリストを作れたりする設計にはしない
 * （横断ビューで列名が乱立して比較不能になるのを防ぐため。
 * frontend/src/pages/CrossBoardView.tsx の元コメント、MEMORY参照）。
 * このファイルは「3列固定」という前提をコードの型として表現する場所。
 */

/**
 * 画面に表示する順序どおりのステータス一覧。
 * 配列にしておくことで、`STATUSES.map(...)` のように列を描画する側で
 * 「順序」「網羅性」の両方をこの1箇所だけに任せられる
 * （個々のコンポーネントが独自に並び順を決め直さずに済む）。
 */
export const STATUSES: readonly CardStatus[] = ['todo', 'doing', 'done']

/** ステータスの日本語表示ラベル */
export const STATUS_LABELS: Record<CardStatus, string> = {
  todo: '未着手',
  doing: '作業中',
  done: '完了',
}

/**
 * 値が既知の3ステータスのいずれかであるかを判定する型ガード。
 *
 * 「型ガード」とは、戻り値の型を `value is CardStatus` のように書くことで、
 * この関数がtrueを返した後のコード内では、呼び出し元の変数がCardStatus型として
 * 扱われるようになる特殊な関数。バックエンドのJSONは実行時には「ただの文字列」でしかなく、
 * TypeScriptの型（types/api.ts の CardStatus）はコンパイル時の約束にすぎないため、
 * 想定外の値が来ても安全に弾けるようにこのチェックを用意している
 * （api/client.ts の `as T` の注意点を参照）。
 */
export function isCardStatus(value: string): value is CardStatus {
  return (STATUSES as readonly string[]).includes(value)
}
