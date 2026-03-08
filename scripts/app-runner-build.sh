#!/bin/sh
set -e
cd backend
npm ci
npx prisma generate
npm run build
