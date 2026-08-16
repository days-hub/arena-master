# Arena Master as a single deployable image: the React build is baked into the
# Spring Boot jar and served from the same origin as the API. One container,
# one URL, no CORS, and same-site session cookies.

# ---- 1. Build the React app -------------------------------------------------
FROM node:22-alpine AS frontend
WORKDIR /frontend
# Copy manifests first so `npm ci` is cached until dependencies actually change.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# The API is same-origin in this image, so the client uses relative URLs.
ENV REACT_APP_API_BASE_URL=""
# CRA treats warnings as errors when CI is set, which would fail the build on
# the bracket library's source-map noise.
ENV CI=false
RUN npm run build

# ---- 2. Build the Spring Boot jar -------------------------------------------
FROM eclipse-temurin:25-jdk AS backend
WORKDIR /build
# Wrapper and pom first: dependency resolution is the slow layer and only needs
# redoing when the pom changes.
COPY springboot-server/.mvn .mvn
COPY springboot-server/mvnw springboot-server/pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -ntp dependency:go-offline
COPY springboot-server/src ./src
# Spring Boot serves classpath:/static, so the React build lands there.
COPY --from=frontend /frontend/build ./src/main/resources/static
RUN ./mvnw -B -ntp clean package -DskipTests

# ---- 3. Runtime -------------------------------------------------------------
FROM eclipse-temurin:25-jre
WORKDIR /app
# Run as a non-root user: nothing here needs privileges.
RUN useradd --system --create-home --shell /usr/sbin/nologin arena
COPY --from=backend /build/target/*.jar app.jar
USER arena

EXPOSE 8000
ENV SPRING_PROFILES_ACTIVE=prod
# Containers get a memory limit rather than a machine's worth of RAM; let the
# JVM size its heap from the cgroup instead of assuming the host.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75"

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
