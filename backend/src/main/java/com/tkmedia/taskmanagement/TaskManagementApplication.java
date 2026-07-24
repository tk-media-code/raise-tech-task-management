package com.tkmedia.taskmanagement;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * このアプリケーションの起動クラス。
 * {@code @SpringBootApplication} は {@code @SpringBootConfiguration}・{@code @EnableAutoConfiguration}・
 * {@code @ComponentScan} をまとめたアノテーションで、このクラスと同じパッケージ（com.tkmedia.taskmanagement）以下を
 * コンポーネントスキャンの対象にする（docs/spring-boot/01-architecture.md 4章参照）。
 */
@SpringBootApplication
public class TaskManagementApplication {

	public static void main(String[] args) {
		// SpringApplication.run() で、コンポーネントスキャン→自動構成の適用→DIコンテナ（ApplicationContext）の構築→
		// 組み込みサーバー（Tomcat、デフォルトはポート8080）の起動、という順に処理が進む。
		SpringApplication.run(TaskManagementApplication.class, args);
	}

}
