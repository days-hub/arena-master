# The Spring Boot API. It serves no static content — nginx owns the React
# build and proxies the API paths here — so this image is just the jar.

FROM eclipse-temurin:25-jdk AS build
WORKDIR /build
# Wrapper and pom first: resolving dependencies is the slow layer and only
# needs redoing when the pom changes.
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -ntp dependency:go-offline
COPY src ./src
RUN ./mvnw -B -ntp clean package -DskipTests

FROM eclipse-temurin:25-jre
WORKDIR /app
# Nothing here needs privileges.
RUN useradd --system --create-home --shell /usr/sbin/nologin arena
COPY --from=build /build/target/*.jar app.jar
USER arena

EXPOSE 8000
ENV SPRING_PROFILES_ACTIVE=prod
# Containers get a memory limit rather than a machine's worth of RAM, and this
# one shares a small instance with nginx and Postgres.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=55"

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
