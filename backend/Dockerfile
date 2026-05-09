# syntax=docker/dockerfile:1.7
# Amazon Linux 2023 (Fargate ホストと同系統) ベースで Node.js 22 を利用

ARG AL_IMAGE=public.ecr.aws/amazonlinux/amazonlinux:2023

# ------------------------------------------------------------
# Builder
# ------------------------------------------------------------
FROM ${AL_IMAGE} AS builder

WORKDIR /app

RUN dnf install -y tar gzip xz which ca-certificates openssl \
    && curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - \
    && dnf install -y nodejs \
    && dnf clean all \
    && rm -rf /var/cache/dnf

COPY backend/package.json backend/package-lock.json ./backend/
COPY common ./common

WORKDIR /app/backend
RUN NPM_CONFIG_PRODUCTION=false npm ci

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ------------------------------------------------------------
# Runtime
# ------------------------------------------------------------
FROM ${AL_IMAGE} AS runtime

ENV NODE_ENV=production \
    PORT=8080 \
    TZ=Asia/Tokyo

WORKDIR /app/backend

RUN dnf install -y ca-certificates openssl shadow-utils \
    && curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - \
    && dnf install -y nodejs \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    && groupadd -r app && useradd -r -g app -d /app -s /sbin/nologin app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/backend/build ./build
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/backend/node_modules/@prisma/client ./node_modules/@prisma/client

RUN chown -R app:app /app
USER app

EXPOSE 8080

CMD ["sh", "-c", "npx prisma migrate deploy && node build/backend/src/index.js"]
