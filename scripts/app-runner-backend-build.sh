#!/bin/sh
set -e
cd backend
# ビルド環境で NODE_ENV=production だと dev 依存が入らず tsc / prisma が使えないことがある
# (--include=dev は npm によって未対応のため NPM_CONFIG_PRODUCTION を使う)
NPM_CONFIG_PRODUCTION=false npm ci
npx prisma generate
npm run build
