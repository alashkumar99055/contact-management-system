FROM maven:3.9.5-eclipse-temurin-17 AS build
WORKDIR /app

COPY pom.xml .
RUN mvn -B dependency:go-offline

COPY src ./src
RUN mvn -B package -DskipTests

FROM eclipse-temurin:17-jdk
WORKDIR /app
COPY --from=build /app/target/password-manager-backend-1.0.0.jar ./app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
