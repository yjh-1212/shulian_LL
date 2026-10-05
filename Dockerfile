FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY prisma ./prisma
RUN npm ci
ARG VITE_DRIVER_URL
ENV VITE_DRIVER_URL=${VITE_DRIVER_URL}
COPY apps ./apps
COPY tools ./tools
RUN npm run db:generate && npm run build && npm run build:driver
RUN mkdir -p .local/ocr && node tools/fetch-ocr.mjs

FROM node:24-bookworm-slim AS api
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* && mkdir /data && chown node:node /data
COPY --from=build --chown=node:node /app /app
ENV NODE_ENV=production API_HOST=0.0.0.0 PORT=3001 DATABASE_URL=file:/data/grain.db
USER node
EXPOSE 3001
CMD ["sh","-c","touch /data/grain.db && npx prisma migrate deploy && node apps/api/dist/main.js"]

FROM nginx:stable-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html/pc
COPY --from=build /app/apps/web/dist-driver /usr/share/nginx/html/driver
EXPOSE 8080 8081
