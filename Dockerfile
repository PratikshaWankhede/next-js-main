FROM node:20-alpine AS builder

WORKDIR /app

COPY . .

RUN npm install -g pnpm

ENV CI=true

RUN pnpm install
RUN NODE_OPTIONS="--max-old-space-size=2048" pnpm build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app ./

RUN npm install -g pnpm

ENV NODE_ENV=production

EXPOSE 3000

CMD ["pnpm", "start"]
