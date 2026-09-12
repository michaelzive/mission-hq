FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY . .
# the wrapper loses its executable bit when committed from Windows
RUN chmod +x mvnw && ./mvnw -q -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/target/*.jar app.jar
# SerialGC + C1-only: smallest footprint and fastest start for a scale-to-zero container
ENV JAVA_OPTS="-Xmx384m -XX:+UseSerialGC -XX:TieredStopAtLevel=1"
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
