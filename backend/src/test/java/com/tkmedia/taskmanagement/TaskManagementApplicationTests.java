package com.tkmedia.taskmanagement;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * アプリケーション全体が起動できることだけを確認するスモークテスト。
 *
 * <p>アサーションは書かない。{@code @SpringBootTest}はアプリのApplicationContextを実際に
 * 組み立てるため、Bean定義の誤り・循環参照・設定ファイルの記述ミスがあれば、この時点で
 * 例外が投げられてテストが落ちる。「何も起きないこと」自体がこのテストの検証内容にあたる。
 *
 * <p><strong>このテストだけはDBを必要とする。</strong>{@code @SpringBootTest}は
 * {@code spring-boot-starter-data-jpa}によるDataSourceの構築まで行うため、
 * DB接続情報（{@code DB_URL}等の環境変数）が無い環境では失敗する。そのため実行は
 * Docker環境内が前提で、{@code scripts/quality-check.sh}も
 * {@code docker exec}経由でこれを満たしている。
 *
 * <p>一方、{@code service}・{@code controller}パッケージ配下に追加したテストは、
 * Repositoryやサービスをモックに差し替えることでDBに依存しない作りにしている。
 * 業務ルールの検証はそちらが担当するため、このクラスに個別のテストを足していく必要はない。
 */
@SpringBootTest
class TaskManagementApplicationTests {

	@Test
	void contextLoads() {
	}

}
