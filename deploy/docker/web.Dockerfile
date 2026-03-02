FROM node:20-alpine AS build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx/ip-watch-docker.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist/ip-watch-pwa/browser /usr/share/nginx/html
