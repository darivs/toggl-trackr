FROM node:20-alpine AS base

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ENV HOST=0.0.0.0
EXPOSE 51731 43001

CMD ["pnpm", "dev"]
