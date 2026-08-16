# The React app, built and then served by nginx. nginx is also the single
# public entry point: it serves the static bundle and proxies the API paths to
# the Spring Boot container, so the browser only ever talks to one origin and
# there is no CORS to configure.

FROM node:22-alpine AS build
WORKDIR /frontend
# Manifests first so `npm ci` stays cached until dependencies actually change.
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
# Same origin, so the client uses relative URLs.
ENV REACT_APP_API_BASE_URL=""
# CRA treats warnings as errors when CI is set, which would fail the build on
# the bracket library's source-map noise.
ENV CI=false
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /frontend/build /usr/share/nginx/html
EXPOSE 80
