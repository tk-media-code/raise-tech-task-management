package com.tkmedia.taskmanagement.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS（Cross-Origin Resource Sharing）の設定クラス。
 * ブラウザは「同一オリジンポリシー」により、表示中のページとは別のオリジン
 * （スキーム・ホスト・ポートのいずれかが違うURL）への通信結果を、サーバーが
 * 明示的に許可を返さない限りJavaScriptに渡さない。開発時はフロントエンド
 * （http://localhost:5173）とAPI（http://localhost:8080）でポートが異なり別オリジンに
 * なるため、このクラスで許可を与える（詳細は docs/spring-boot/08-configuration-cors.md 27章）。
 *
 * <p>curlやPostmanでAPIを叩いたときにCORSが問題にならないのは、同一オリジンポリシーが
 * 「ブラウザが実装している制限」であって、サーバー側の認可の仕組みではないため。
 * つまりCORSはAPIを守るセキュリティ機構ではなく、「このオリジンのJSにレスポンスを
 * 渡してよい」とブラウザに伝えるための宣言でしかない。</p>
 */
// @Configuration は「このクラス自身が設定情報である」ことを示すアノテーション。
// @Service や @RestController と同じくコンポーネントスキャンでBeanとして登録されるが、
// 役割が「業務処理」ではなく「フレームワークの構成」である点が違う
// （docs/spring-boot/08-configuration-cors.md 26章参照）。
//
// WebMvcConfigurer は Spring MVC の設定に介入するためのインターフェース。
// implementsして必要なメソッドだけをオーバーライドすれば、Spring Bootの自動構成に
// 「差分」を足すだけで済む。@EnableWebMvc は付けないこと。付けると自動構成が丸ごと
// 無効化され、Jacksonの設定なども自前で用意する羽目になる。
@Configuration
public class CorsConfig implements WebMvcConfigurer {

	/**
	 * CORSを許可するオリジンの一覧。
	 * application.properties の {@code app.cors.allowed-origins}（カンマ区切り）から注入される。
	 * ハードコードせず設定値にしているのは、開発と本番で許可すべきオリジンが異なり、
	 * プロファイルの仕組み（04-profiles.md 16章）で環境ごとに切り替えたいため。
	 */
	// @Value("${...}") は application.properties の値を1つだけ注入するアノテーション。
	// カンマ区切りの文字列から String[] への変換は、SpringのConversionServiceが自動で行う
	// （値が空文字なら要素0個の配列になる）。
	private final String[] allowedOrigins;

	// コンストラクタインジェクション。フィールドに直接 @Value を付ける方式もあるが、
	// このプロジェクトの他のクラス（Controller/Service）と同じくコンストラクタで受け取り、
	// final にして「生成後に差し替わらない」ことを型で保証する。
	public CorsConfig(@Value("${app.cors.allowed-origins}") String[] allowedOrigins) {
		this.allowedOrigins = allowedOrigins;
	}

	/**
	 * CORSの許可ルールを登録する。
	 *
	 * @param registry SpringがCORS設定を受け取るためのレジストリ
	 */
	@Override
	public void addCorsMappings(CorsRegistry registry) {
		registry.addMapping("/api/**")
				// 許可するオリジン。空配列（＝設定が空）の場合はどのオリジンも許可されない。
				.allowedOrigins(allowedOrigins)
				// 現在のAPIは参照系(GET)のみなのでGETだけを許可する。
				// 将来の書き込みAPI(POST等)を先回りして許可しないのは、
				// (1) allowedMethodsはブラウザ向けの宣言であってサーバー側の認可ではなく、
				//     先出しで許可しても安全性は1ミリも上がらない、
				// (2) この1行が「今このAPIに何ができるか」の正直な写しであってほしい、
				// (3) 書き込みAPI追加時に出るブラウザのCORSエラーは初回の手動テストで
				//     必ず出る「うるさい失敗」で、静かに見逃されることがない、から。
				.allowedMethods("GET")
				// Cookieや Authorization ヘッダーは送らないので false（Springの既定と同じだが、
				// 「意図的に送らない」ことを明示する）。なお allowCredentials(true) と
				// allowedOrigins("*") の併用はCORS仕様で禁止されており、Springは起動時に例外を投げる。
				.allowCredentials(false);
		// allowedHeaders / maxAge を書いていない理由:
		// SpringのCorsRegistrationは生成時にapplyPermitDefaultValues()を呼び、
		// allowedHeaders="*" / maxAge=1800秒 を既定値として持っている。
		// 現状のリクエストはカスタムヘッダーを一切送らないため、明示しても no-op になる。
		// 「書き忘れ」ではなく「既定で足りている」ことを、この注記で残しておく。
	}
}
