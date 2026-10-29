# Etapa 1: Compilación con Maven y Java 21
FROM maven:3.9.9-eclipse-temurin-21 AS builder
WORKDIR /build

COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn clean package -DskipTests -e

# Etapa 2: Imagen ligera para ejecución
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

COPY --from=builder /build/target/farmaya-*.jar app.jar

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java -Dserver.port=${PORT:-8080} -jar app.jar"]
