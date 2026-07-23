# --- build stage ---
FROM eclipse-temurin:25-jdk AS build
WORKDIR /workspace

# 先に依存解決に必要なファイルだけをCOPYし、ソース変更時のレイヤーキャッシュを効かせる
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN ./gradlew --no-daemon dependencies || true

COPY src ./src
RUN ./gradlew --no-daemon bootJar

# --- run stage ---
FROM eclipse-temurin:25-jre AS run
WORKDIR /app

COPY --from=build /workspace/build/libs/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
