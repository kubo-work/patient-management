# ADR 0001: Prisma 7 のドライバアダプタに `@prisma/adapter-pg` を採用する

- 日付: 2026-08-30
- ステータス: 採用
- 関連: Issue #283 / PR #301

## 背景

Prisma 5 系は 5.22.0（2024-11-05）で更新が止まっていた。7 系では Rust 製のクエリエンジンが廃止され、TypeScript + WASM の構成に変わり、**ドライバアダプタの指定が必須**になった。あわせて次の変更がある。

- `prisma-client-js` ジェネレータが廃止され、`prisma-client` ジェネレータになった。生成物は JavaScript ではなく **TypeScript ソース**として、`output` で指定した任意の場所（`node_modules` の外）に出力される
- `datasource` から `url` / `directUrl` が削除され、接続情報は `prisma.config.ts` が持つ
- `.env` の自動読み込みが廃止された

この構成変更は、API を Vercel（Node 以外のランタイムを含む）へ載せる前提でもある。

## 決定

### 1. アダプタは `@prisma/adapter-pg`（node-postgres）を使う

Neon にも AWS RDS にも同じコードで接続できる。`infra/` の Terraform 一式は、AWS へいつでも復帰できる状態を維持する方針のため、接続先を Neon に固定しない。

### 2. `PrismaClient` の生成を `packages/db` に集約し、`@repo/db` として配布する

生成物が `node_modules` の外に TypeScript ソースとして出るため、`packages/db` を tsc でビルドし `dist/` を配布する。`packages/api` は `@prisma/client` に直接依存せず、`prisma` / `Prisma` / `delFlag` をすべて `@repo/db` から取得する。

### 3. 接続情報の解決先を実行時と CLI で分ける

| 経路 | 参照する環境変数 | 解決する場所 |
|---|---|---|
| 実行時のクエリ | `DATABASE_URL`（pooled） | `packages/db/src/index.ts` |
| マイグレーション等の CLI | `DIRECT_URL`（直結） | `packages/db/prisma.config.ts` |

PgBouncer はアドバイザリロックと prepared statement を扱えないため、スキーマ操作は直結でなければならない。

### 4. `prisma.config.ts` では `env()` ヘルパーを使わず `process.env` を直接参照する

`env()` は設定ファイルの読み込み時点で解決を試みるため、`DIRECT_URL` が未設定だと、接続を必要としない `prisma generate` まで失敗する。CI と Docker のビルドは環境変数が無い状態で `generate` を実行するため、未設定でも読み込みが通る形にする。

### 5. 接続文字列に `pgbouncer=true` と `connection_limit` を付けない

`pgbouncer=true` は Rust エンジン向けの指定で、node-postgres には不要。Neon の pooled 接続に対し、パラメータの有無どちらでも `count` の連続実行と `$transaction` が通ることを実接続で確認した。`connection_limit` も Prisma 独自のパラメータで node-postgres は読まない。

## 検討して採用しなかった案

### `@prisma/adapter-neon`

Neon 専用のサーバーレスドライバ。WebSocket 経由で接続するためエッジ環境で有利だが、RDS に接続できない。`infra/` の AWS 復帰経路が使えなくなるため採用しない。

### `prisma-client-js` のままアダプタだけ導入する

7 系では非推奨。生成物の配置とビルド構成の変更を後日もう一度行うことになるため、この機会にまとめて移行する。

## 波及

- `packages/db` がビルド対象になった。ルートの `build` / `typecheck` / `dev` / `test` と `Dockerfile` は、`packages/api` より先に `build:db` を実行する必要がある
- 生成物（`packages/db/generated`）は追跡せず、`postinstall` の `prisma generate` で毎回生成する
- `DATABASE_URL` が未設定の場合、`@repo/db` の読み込み時点で例外を投げる。node-postgres は接続文字列を渡さないと `PGHOST` などの環境変数や localhost にフォールバックし、失敗も初回クエリまで表面化しないため
- 実行時の接続数の上限は接続文字列ではなく、`PrismaPg` に渡す node-postgres のプール設定で決まる
- `sslmode=require` は pg-connection-string が `rejectUnauthorized=false` にするため、サーバー証明書が検証されない。`verify-full` への変更は本番の接続文字列の変更を伴うため、本 ADR の範囲では扱わない
