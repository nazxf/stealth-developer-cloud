FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_API_URL=
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:1.29-alpine AS runtime

COPY deploy/console/nginx.conf /etc/nginx/conf.d/default.conf
# TanStack Start's SPA build emits the browser shell and hashed assets under
# dist/client. The Go API remains a separate service in the compose stack.
COPY --from=build /app/dist/client /usr/share/nginx/html

EXPOSE 8080
