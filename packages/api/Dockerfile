# syntax=docker/dockerfile:1.7
# Amazon Linux 2023 (Fargate ホストと同系統) ベースで Node.js 22 を利用
# ビルドコンテキストはリポジトリルート:
#   docker build -f packages/api/Dockerfile .

ARG AL_IMAGE=public.ecr.aws/amazonlinux/amazonlinux:2023
ARG BUN_VERSION=1.4.0

# ------------------------------------------------------------
# Builder
# ------------------------------------------------------------
FROM ${AL_IMAGE} AS builder
ARG BUN_VERSION

WORKDIR /app

RUN dnf install -y tar gzip xz unzip which ca-certificates openssl \
    && curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - \
    && dnf install -y nodejs \
    && dnf clean all \
    && rm -rf /var/cache/dnf

# bun は依存解決とビルドにのみ利用する（実行時ランタイムは Node のまま）
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"
ENV PATH="/root/.bun/bin:${PATH}"

# 依存解決に必要なマニフェストだけ先に置き、ソース変更でキャッシュが落ちないようにする
COPY package.json bun.lock bunfig.toml tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/api/package.json ./packages/api/
COPY packages/db/package.json ./packages/db/
COPY packages/schema/package.json ./packages/schema/
# ルートの postinstall が prisma generate を実行するため schema を先に配置する
COPY packages/db/prisma ./packages/db/prisma

RUN bun install --frozen-lockfile

COPY packages/schema ./packages/schema
COPY packages/api ./packages/api

RUN bun run build:schema && bun run build:api

# ------------------------------------------------------------
# Runtime
# ------------------------------------------------------------
FROM ${AL_IMAGE} AS runtime

ENV NODE_ENV=production \
    PORT=8080 \
    TZ=Asia/Tokyo

WORKDIR /app

RUN dnf install -y ca-certificates openssl shadow-utils \
    && curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - \
    && dnf install -y nodejs \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    && groupadd -r app && useradd -r -g app -d /app -s /sbin/nologin app

# workspace のシンボリックリンク構造ごと引き継ぐ（@repo/schema の解決に必要）
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

COPY --from=builder /app/packages/schema/package.json ./packages/schema/package.json
COPY --from=builder /app/packages/schema/dist ./packages/schema/dist

COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma

COPY --from=builder /app/packages/api/package.json ./packages/api/package.json
COPY --from=builder /app/packages/api/build ./packages/api/build
COPY --from=builder /app/packages/api/scripts ./packages/api/scripts

RUN chown -R app:app /app
USER app

WORKDIR /app/packages/api

EXPOSE 8080

# 起動順: マイグレーション → 初期データ取り込み（空DBかつSOURCE_DATABASE_URL設定時のみ） → サーバー起動
CMD ["sh", "-c", "../../node_modules/.bin/prisma migrate deploy --schema ../db/prisma/schema.prisma && node scripts/seed-from-source.js && node build/index.js"]
