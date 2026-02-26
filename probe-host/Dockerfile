FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src

ENV HOST=0.0.0.0
ENV PORT=3001
ENV PING_TIMEOUT_SEC=1
ENV HTTP_TIMEOUT_MS=1500
ENV ENABLE_HTTP_BY_DEFAULT=false

EXPOSE 3001

CMD ["node", "src/server.js"]
