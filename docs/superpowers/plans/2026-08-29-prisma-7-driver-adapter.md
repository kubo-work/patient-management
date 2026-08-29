# Prisma 7 ドライバアダプタ移行 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prisma を 5.22 から 7.10.0 へ上げ、Rust エンジン依存を捨ててドライバアダプタ構成へ移行する。あわせて `PrismaClient` の生成を `packages/db` に集約する。

**Architecture:** `packages/db` が Prisma スキーマ・生成物・アダプタ・接続設定をすべて抱え、初期化済みの `prisma` と型を `@repo/db` として export する。`packages/api` は `@repo/db` から import するだけになり、DB 接続の知識を持たなくなる。生成物は TypeScript ソースとして出力されるため `packages/db` の tsc ビルド対象に含める。

**Tech Stack:** Prisma 7.10.0 / @prisma/adapter-pg 7.10.0 / node-postgres / TypeScript 7.0.2 / bun workspaces

**Spec:** https://github.com/kubo-work/patient-management/issues/283#issuecomment-5461265800

## Global Constraints

- `prisma` / `@prisma/client` / `@prisma/adapter-pg` は **`7.10.0` に完全固定**する。`^` を付けない。npm の `latest` タグが `8.0.0-rc.12` を指しているため、範囲指定は RC を引き込む危険がある
- Node は `>=24`（ルート `package.json` の `engines`）。`prisma@7.10.0` の要求は `^20.19 || ^22.12 || >=24.0` で充足
- TypeScript は `7.0.2`。`@prisma/client@7.10.0` の要求は `>=5.4.0` で充足
- 変数名・関数名・型名を省略しない（`d`, `tmp`, `val` のような名前は禁止）
- **本番には反映されない。** Render は `render-legacy` ブランチ（monorepo 化前・Prisma 5）を参照しているため、`main` の変更は本番に載らない。検証はローカルで行う
- **テストは直さない。** Jest の失敗は monorepo 化以前からの既知問題で #288 の範囲。本計画では import 元と `jest.mock` の対象を追従させ、型チェックが通る状態を保つのみ

## 実測で確定済みの事実

計画作成時に Prisma 7.10.0 を実際に動かして確認した。以下は推測ではない。

| 事実 | 内容 |
|---|---|
| `datasource` の `url` | **不要**。`provider` のみで `prisma validate` が通る |
| 生成物の形式 | **TypeScript ソース 14 ファイル**。コンパイル済み JS ではない |
| 生成物の相対 import | `./enums.ts` のように **`.ts` 拡張子付き**。tsconfig に `allowImportingTsExtensions` と `rewriteRelativeImportExtensions` が必要 |
| TypeScript 7 でのコンパイル | 上記 2 設定で**成功**（終了コード 0）。emit 時に `.js` へ書き換わる |
| 主エントリ | `generated/client/client.ts`。`PrismaClient` / `Prisma` / `delFlag` / モデル型がすべてここから取得できる |
| `env()` ヘルパー | 設定ファイル読み込み時に即解決するため、**`DIRECT_URL` 未設定だと `prisma generate` まで失敗する** |
| `process.env` 直接参照 | `generate` は未設定でも成功し、`migrate` は設定時に正常動作。**こちらを使う** |
| `.env` の自動読み込み | **廃止された**。`node --env-file=` で明示的に渡す必要がある |
| `--config` フラグ | 別ディレクトリからの指定が可能。スキーマパスは設定ファイル基準で解決される |

## ファイル構成

| ファイル | 責務 |
|---|---|
| `packages/db/prisma/schema.prisma` | モデル定義と generator 設定。接続情報は持たない |
| `packages/db/prisma.config.ts` | CLI 用の接続設定。`DIRECT_URL`（直結）を参照する |
| `packages/db/src/index.ts` | アダプタを組み立てた `prisma` と型の再 export。**実行時の接続を担う唯一の場所** |
| `packages/db/tsconfig.json` | `src` と `generated` の両方をビルド対象にする |
| `packages/db/generated/client/` | 生成物。gitignore 対象 |
| `packages/api/src/**` | `@repo/db` から import するのみ。DB 接続の知識を持たない |

---

## Task 1: 依存の整理とバージョン更新

未使用依存を削除し、Prisma 一式を 7.10.0 に固定する。この時点ではまだ生成できない（Task 2 でスキーマを移行するため）。

**Files:**
- Modify: `packages/api/package.json`
- Modify: `packages/db/package.json`

**Interfaces:**
- Produces: `prisma` / `@prisma/client` / `@prisma/adapter-pg` の 7.10.0 が `node_modules` に入った状態

- [ ] **Step 1: `packages/api/package.json` から Prisma 関連と未使用依存を削除する**

`dependencies` から次の 1 行を削除する。

```json
    "@prisma/client": "^5.19.1",
```

`devDependencies` から次の 3 行を削除する。

```json
    "prisma": "^5.19.1",
    "prisma-mock": "^0.10.3",
    "zod-prisma-types": "^3.2.1",
```

`prisma-mock` と `zod-prisma-types` はどこからも import されておらず、`schema.prisma` に generator 定義もない未使用依存。`@prisma/client` と `prisma` は `packages/db` に集約するため `packages/api` からは外す。

- [ ] **Step 2: `packages/db/package.json` の依存を 7.10.0 に固定する**

`dependencies` と `devDependencies` を次の内容に置き換える。

```json
  "dependencies": {
    "@prisma/adapter-pg": "7.10.0",
    "@prisma/client": "7.10.0"
  },
  "devDependencies": {
    "prisma": "7.10.0"
  }
```

`^` を付けないこと。npm の `latest` タグが `8.0.0-rc.12` を指しているため、範囲指定は RC を引き込む。

- [ ] **Step 3: インストールしてバージョンを確認する**

```bash
bun install
```

Run:

```bash
./node_modules/.bin/prisma --version 2>&1 | head -3
```

Expected: `prisma : 7.10.0` を含む出力。`5.22.0` が出たら Step 2 の修正が反映されていない。

- [ ] **Step 4: 未使用依存が消えたことを確認する**

Run:

```bash
ls node_modules | grep -c "^prisma-mock$\|^zod-prisma-types$"
```

Expected: `0`

- [ ] **Step 5: コミット**

```bash
git add packages/api/package.json packages/db/package.json bun.lock
git commit -m "build: Prisma を 7.10.0 に固定し未使用依存を削除する"
```

---

## Task 2: スキーマと設定ファイルを Prisma 7 の形式へ移行する

`schema.prisma` から接続情報を外し、`prisma.config.ts` を追加して生成を通す。

**Files:**
- Modify: `packages/db/prisma/schema.prisma:1-13`
- Create: `packages/db/prisma.config.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Task 1 の `prisma@7.10.0`
- Produces: `packages/db/generated/client/client.ts`。ここから `PrismaClient` / `Prisma` / `delFlag` / モデル型（`patients` / `doctors` / `medical_records` / `categories` / `medical_categories` / `session`）が export される

- [ ] **Step 1: `schema.prisma` の先頭を差し替える**

現在の 1〜13 行目（`generator client` ブロックと、コメント付きの `datasource db` ブロック）を、次の内容で置き換える。`model` 定義以降は一切変更しない。

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/client"
}

// 接続文字列は prisma.config.ts（CLI 用）と packages/db/src/index.ts（実行時用）で指定する。
// Prisma 7 ではドライバアダプタが必須になり、datasource は provider のみを持つ。
datasource db {
  provider = "postgresql"
}
```

- [ ] **Step 2: `packages/db/prisma.config.ts` を作成する**

```typescript
import { defineConfig } from "prisma/config";

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: { path: "prisma/migrations" },
    // env() ヘルパーは設定ファイルの読み込み時に即座に解決を試みるため、
    // DIRECT_URL が未設定だと接続を必要としない prisma generate まで失敗する。
    // CI と Docker のビルドでは環境変数が無い状態で generate が走るので、
    // 未設定でも読み込みが通る process.env の直接参照を使う。
    datasource: { url: process.env.DIRECT_URL ?? "" },
});
```

`DIRECT_URL` は `-pooler` を含まない直結の接続文字列。PgBouncer はアドバイザリロックを扱えないため、マイグレーションは直結でなければならない。

- [ ] **Step 3: `.gitignore` に生成物を追加する**

`# build output` セクションの `out/` の下に 1 行追加する。

```
generated/
```

Prisma 7 の生成物は `node_modules` の外に出るため、指定しないとコミット対象になる。

- [ ] **Step 4: 環境変数なしで validate と generate が通ることを確認する**

CI とルートの `postinstall` は環境変数が無い状態で走るため、ここが通らないとビルドが壊れる。

Run:

```bash
env -u DIRECT_URL -u DATABASE_URL ./node_modules/.bin/prisma validate --config packages/db/prisma.config.ts
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`

Run:

```bash
env -u DIRECT_URL -u DATABASE_URL ./node_modules/.bin/prisma generate --config packages/db/prisma.config.ts
```

Expected: `✔ Generated Prisma Client (7.10.0) to ./packages/db/generated/client` を含む成功出力。
`PrismaConfigEnvError: Cannot resolve environment variable: DIRECT_URL` が出たら Step 2 で `env()` を使ってしまっている。

- [ ] **Step 5: 生成物の中身を確認する**

Run:

```bash
ls packages/db/generated/client
```

Expected: `browser.ts` `client.ts` `commonInputTypes.ts` `enums.ts` `internal` `models` `models.ts` が並ぶ。**すべて `.ts` でありコンパイル済み JS は無い**。

- [ ] **Step 6: 生成物が git の追跡対象外であることを確認する**

Run:

```bash
git status --short packages/db/generated
```

Expected: 出力なし（空）。何か表示されたら Step 3 の `.gitignore` が効いていない。

- [ ] **Step 7: CLI がマイグレーションを認識することを確認する**

ローカルの Postgres が起動している必要がある（`docker compose up -d`）。

Run:

```bash
node --env-file=packages/db/.env ./node_modules/.bin/prisma migrate status --config packages/db/prisma.config.ts
```

Expected: `10 migrations found in prisma/migrations` と `Database schema is up to date!`

- [ ] **Step 8: コミット**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma.config.ts .gitignore
git commit -m "refactor: Prisma のスキーマと設定を 7 系の形式へ移行する"
```

---

## Task 3: packages/db をビルド対象にし、初期化済みクライアントを export する

生成物とアダプタを `packages/db` に閉じ込め、`@repo/db` から `prisma` を提供する。

**Files:**
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/index.ts`
- Modify: `packages/db/package.json`

**Interfaces:**
- Consumes: Task 2 の `packages/db/generated/client/client.ts`
- Produces: `@repo/db` から次を export する
  - `prisma`: アダプタを渡して初期化済みの `PrismaClient` インスタンス
  - `PrismaClient` / `Prisma` / `delFlag` / `patients` / `doctors` / `medical_records` / `categories` / `medical_categories` / `session`（`client.ts` の再 export）

- [ ] **Step 1: `packages/db/tsconfig.json` を作成する**

`packages/schema/tsconfig.json` と同じ形を基本にしつつ、生成物を含めるために `rootDir` を `.` にし、`.ts` 拡張子付き import を扱う 2 つの設定を追加する。

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": [
      "ES2022"
    ],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "rootDir": ".",
    "outDir": "dist",
    "types": [
      "node"
    ],
    "allowImportingTsExtensions": true,
    "rewriteRelativeImportExtensions": true
  },
  "include": [
    "src/**/*.ts",
    "generated/**/*.ts"
  ]
}
```

`allowImportingTsExtensions` は生成物が `./enums.ts` のように `.ts` 付きで import しているため必要。`rewriteRelativeImportExtensions` は emit 時にそれを `.js` へ書き換えるために必要。両方揃わないと実行時に解決できない。

- [ ] **Step 2: `packages/db/src/index.ts` を作成する**

```typescript
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/client.ts";

// Prisma 7 では Rust クエリエンジンが廃止され、DB との通信はドライバアダプタが担う。
// PrismaPg は node-postgres の薄いラッパーで、標準的な Postgres の TCP 接続を使う。
// Neon（pooled）にも AWS RDS にも同じコードで接続できるため、
// infra/ の AWS 復帰経路を維持できる。
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });

export * from "../generated/client/client.ts";
```

`DATABASE_URL` は `-pooler` を含む pooled 接続。実行時のクエリはすべてこちらを通る。

- [ ] **Step 3: `packages/db/package.json` にエントリポイントとスクリプトを追加する**

`"type": "module",` の直後にエントリポイントを追加する。

```json
  "main": "./dist/src/index.js",
  "types": "./dist/src/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/src/index.d.ts",
      "default": "./dist/src/index.js"
    },
    "./package.json": "./package.json"
  },
  "files": [
    "dist"
  ],
```

`scripts` の先頭に `build` と `typecheck` を追加する。`generate` は設定ファイルを見るように変更する。

```json
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "generate": "prisma generate --config prisma.config.ts",
```

`migrate:dev` / `migrate:deploy` / `studio` は変更しない。

- [ ] **Step 4: ビルドが通ることを確認する**

Run:

```bash
bun run --filter @repo/db build
```

Expected: エラーなく終了。

- [ ] **Step 5: 生成物が JS へコンパイルされ、import が書き換わったことを確認する**

Run:

```bash
head -3 packages/db/dist/src/index.js
```

Expected: 3 行目付近に `from "../generated/client/client.js"` が現れる（`.ts` ではない）。`.ts` のままなら Step 1 の `rewriteRelativeImportExtensions` が効いていない。

- [ ] **Step 6: 実際に DB へ接続できることを確認する**

ローカルの Postgres が起動している必要がある。

Run:

```bash
DATABASE_URL="postgresql://dev:dev@localhost:5432/patient_management" node -e '
const { prisma } = await import("./packages/db/dist/src/index.js");
console.log("patients:", await prisma.patients.count());
console.log("doctors :", await prisma.doctors.count());
await prisma.$disconnect();
' --input-type=module
```

Expected: `patients: 4` と `doctors : 7`（ローカルの現在のデータ件数）。件数が違っても、**エラーなく数字が出れば成功**。

- [ ] **Step 7: コミット**

```bash
git add packages/db/tsconfig.json packages/db/src/index.ts packages/db/package.json
git commit -m "feat: packages/db でドライバアダプタ付きの Prisma クライアントを提供する"
```

---

## Task 4: packages/api の import を @repo/db へ切り替える

`packages/api` から `@prisma/client` への直接依存を消す。

**Files:**
- Delete: `packages/api/src/prisma.ts`
- Modify: `packages/api/src/doctor/doctors.ts:3`
- Modify: `packages/api/src/doctor/medical_records.ts:5`
- Modify: 各ファイルの `../prisma.js` import

**Interfaces:**
- Consumes: Task 3 の `@repo/db` が export する `prisma` / `Prisma` / `delFlag`

- [ ] **Step 1: `packages/api/src/prisma.ts` を削除する**

```bash
git rm packages/api/src/prisma.ts
```

このファイルの責務は `packages/db/src/index.ts` に移った。

- [ ] **Step 2: `prisma` の import 元を `@repo/db` に置き換える**

対象は次の 6 ファイル。いずれも同じ 1 行を書き換える。

| ファイル | 行 |
|---|---|
| `packages/api/src/doctor/login.ts` | 3 |
| `packages/api/src/doctor/medical_records.ts` | 6 |
| `packages/api/src/doctor/patients.ts` | 3 |
| `packages/api/src/doctor/login_doctor.ts` | 2 |
| `packages/api/src/doctor/doctors.ts` | 5 |
| `packages/api/src/doctor/categories.ts` | 2 |

変更前:

```typescript
import { prisma } from "../prisma.js";
```

変更後:

```typescript
import { prisma } from "@repo/db";
```

- [ ] **Step 3: 置き換え漏れが無いことを確認する**

Run:

```bash
grep -rn "prisma.js" packages/api/src
```

Expected: 出力なし（空）。

- [ ] **Step 4: `Prisma` 名前空間の import 元を置き換える**

`packages/api/src/doctor/doctors.ts:3` を書き換える。

変更前:

```typescript
import { Prisma } from "@prisma/client";
```

変更後:

```typescript
import { Prisma } from "@repo/db";
```

- [ ] **Step 5: `delFlag` の import 元を置き換える**

`packages/api/src/doctor/medical_records.ts:5` を書き換える。

変更前:

```typescript
import { delFlag } from "@prisma/client";
```

変更後:

```typescript
import { delFlag } from "@repo/db";
```

- [ ] **Step 6: `packages/api/package.json` に `@repo/db` への依存を追加する**

`dependencies` に次の行が無ければ追加する（`@repo/schema` の隣）。

```json
    "@repo/db": "workspace:*",
```

- [ ] **Step 7: `@prisma/client` への直接参照が残っていないことを確認する**

Run:

```bash
grep -rn "@prisma/client" packages/api/src
```

Expected: 出力なし（空）。

- [ ] **Step 8: ビルドが通ることを確認する**

Run:

```bash
bun install && bun run build:schema && bun run --filter @repo/db build && bun run build:api
```

Expected: すべて exit code 0。

- [ ] **Step 9: コミット**

```bash
git add packages/api
git commit -m "refactor: packages/api の Prisma import を @repo/db へ集約する"
```

---

## Task 5: テストの import を追従させる

テストの失敗そのものは直さない。型チェックが通る状態を保つための最小変更にとどめる。

**Files:**
- Modify: `packages/api/test/prismaMock.ts`
- Modify: `packages/api/test/doctor/doctors.spec.ts:7`

**Interfaces:**
- Consumes: Task 3 の `@repo/db`

- [ ] **Step 1: `packages/api/test/prismaMock.ts` を書き換える**

変更前:

```typescript
import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended"

import { prisma } from "../src/prisma.js"


beforeEach(() => {
    mockReset(prismaMock)
})

jest.mock('../src/prisma.js', () => ({
    __esModule: true,
    prisma: mockDeep<PrismaClient>(),
}))

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>
```

変更後:

```typescript
// PrismaClient は型としてしか使わない。@repo/db 自体をモックするため、
// 値として import すると実行時に undefined になる。必ず import type にする。
import type { PrismaClient } from "@repo/db";
import { prisma } from "@repo/db";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended"


beforeEach(() => {
    mockReset(prismaMock)
})

// クライアントの生成が packages/db に移ったため、モック対象も @repo/db になる。
jest.mock('@repo/db', () => ({
    __esModule: true,
    prisma: mockDeep<PrismaClient>(),
}))

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>
```

- [ ] **Step 2: `packages/api/test/doctor/doctors.spec.ts:7` を書き換える**

変更前:

```typescript
import { Prisma } from "@prisma/client";
```

変更後:

```typescript
import { Prisma } from "@repo/db";
```

- [ ] **Step 3: テスト側にも `@prisma/client` 参照が残っていないことを確認する**

Run:

```bash
grep -rn "@prisma/client\|src/prisma.js" packages/api/test
```

Expected: 出力なし（空）。

- [ ] **Step 4: 型チェックが通ることを確認する**

Run:

```bash
bun run build:schema && bun run --filter @repo/db build && bun run --filter @repo/api typecheck
```

Expected: exit code 0。**テストの実行は不要**（失敗は #288 の範囲）。

- [ ] **Step 5: コミット**

```bash
git add packages/api/test
git commit -m "refactor: テストの Prisma import を @repo/db へ追従させる"
```

---

## Task 6: ビルドとコンテナの設定を追従させる

`packages/db` がビルド対象になったこと、生成物が `node_modules` の外に出ることに、ルートと Docker を合わせる。

**Files:**
- Modify: `package.json`（ルート）
- Modify: `packages/api/Dockerfile`
- Modify: `infra/ecs.tf:129-133`

**Interfaces:**
- Consumes: Task 3 の `packages/db` の `build` / `typecheck` スクリプト

- [ ] **Step 1: ルートの `postinstall` を設定ファイル基準に変える**

変更前:

```json
    "postinstall": "prisma generate --schema packages/db/prisma/schema.prisma",
```

変更後:

```json
    "postinstall": "prisma generate --config packages/db/prisma.config.ts",
```

設定ファイルがスキーマの場所を持つため、`--schema` ではなく `--config` を渡す。

- [ ] **Step 2: ルートの `build` と `typecheck` に `packages/db` を挟む**

変更前:

```json
    "build": "bun run build:schema && bun run build:api && bun run build:web",
    "build:schema": "bun run --filter @repo/schema build",
    "build:api": "bun run --filter @repo/api build",
```

変更後:

```json
    "build": "bun run build:schema && bun run build:db && bun run build:api && bun run build:web",
    "build:schema": "bun run --filter @repo/schema build",
    "build:db": "bun run --filter @repo/db build",
    "build:api": "bun run --filter @repo/api build",
```

`typecheck` も同様に変更する。

変更前:

```json
    "typecheck": "bun run build:schema && bun run --filter '*' typecheck",
```

変更後:

```json
    "typecheck": "bun run build:schema && bun run build:db && bun run --filter '*' typecheck",
```

`packages/api` は `@repo/db` の型定義を参照するため、先に `packages/db` がビルドされている必要がある。

- [ ] **Step 3: ルートからのビルドと型チェックが通ることを確認する**

Run:

```bash
bun run typecheck
```

Expected: `@repo/schema` / `@repo/db` / `@repo/api` / `web` すべて `Exited with code 0`。

- [ ] **Step 4: `Dockerfile` の runtime ステージに `packages/db` の成果物を追加する**

`packages/api/Dockerfile:68-69` の 2 行を次で置き換える。

変更前:

```dockerfile
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
```

変更後:

```dockerfile
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/packages/db/prisma.config.ts ./packages/db/prisma.config.ts
COPY --from=builder /app/packages/db/dist ./packages/db/dist
```

`dist` には生成物のコンパイル結果も含まれるため、`generated/` を別途コピーする必要はない。`prisma.config.ts` は起動時の `prisma migrate deploy` が読む。

- [ ] **Step 5: `Dockerfile` の builder ステージで `packages/db` をビルドする**

`packages/api/Dockerfile:41` を次で置き換える。

変更前:

```dockerfile
RUN bun run build:schema && bun run build:api
```

変更後:

```dockerfile
RUN bun run build:schema && bun run build:db && bun run build:api
```

- [ ] **Step 6: `Dockerfile` の `CMD` を `--config` 指定に変える**

`packages/api/Dockerfile:83` を次で置き換える。

変更前:

```dockerfile
CMD ["sh", "-c", "../../node_modules/.bin/prisma migrate deploy --schema ../db/prisma/schema.prisma && node scripts/seed-from-source.js && node build/index.js"]
```

変更後:

```dockerfile
CMD ["sh", "-c", "../../node_modules/.bin/prisma migrate deploy --config ../db/prisma.config.ts && node scripts/seed-from-source.js && node build/index.js"]
```

作業ディレクトリは `/app/packages/api` なので、`../db/prisma.config.ts` は `/app/packages/db/prisma.config.ts` を指す。スキーマとマイグレーションの場所は設定ファイル基準で解決される。

- [ ] **Step 7: `infra/ecs.tf` の起動コマンドを同じ形に揃える**

`infra/ecs.tf:132` を次で置き換える。

変更前:

```hcl
      "../../node_modules/.bin/prisma migrate deploy --schema ../db/prisma/schema.prisma && node scripts/seed-from-source.js && node build/index.js"
```

変更後:

```hcl
      "../../node_modules/.bin/prisma migrate deploy --config ../db/prisma.config.ts && node scripts/seed-from-source.js && node build/index.js"
```

ECS のタスク定義には #282 で `DIRECT_URL` を追加済みなので、環境変数の追加作業は不要。

- [ ] **Step 8: Docker イメージがビルドできることを確認する**

Run:

```bash
docker build --platform linux/amd64 -t patient-management-api:prisma7-check -f packages/api/Dockerfile .
```

Expected: ビルド成功。失敗した場合、`packages/db/dist` が見つからないなら Step 5 の追加漏れ、`prisma.config.ts` が見つからないなら Step 4 の追加漏れ。

- [ ] **Step 9: 確認用イメージを削除する**

```bash
docker image rm patient-management-api:prisma7-check
```

- [ ] **Step 10: コミット**

```bash
git add package.json packages/api/Dockerfile infra/ecs.tf
git commit -m "build: packages/db のビルドと Prisma 7 の設定ファイルに追従させる"
```

---

## Task 7: 統合検証と接続文字列の見直し

アプリケーション経路で動作を確認し、`pgbouncer=true` の要否を判定する。

**Files:**
- Modify: `packages/db/.env.example`（判定結果によって）
- Modify: `packages/api/.env.example`（判定結果によって）

**Interfaces:**
- Consumes: Task 1 から Task 6 のすべて

- [ ] **Step 1: ローカル DB が起動していることを確認する**

Run:

```bash
docker compose ps --format '{{.Service}} {{.Status}}'
```

Expected: `postgres` が `Up` かつ `healthy`。起動していなければ `docker compose up -d` を実行する。

- [ ] **Step 2: マイグレーションが no-op で通ることを確認する**

Run:

```bash
node --env-file=packages/db/.env ./node_modules/.bin/prisma migrate deploy --config packages/db/prisma.config.ts
```

Expected: `No pending migrations to apply.`

- [ ] **Step 3: API を起動する**

```bash
cd packages/api && node --env-file=.env build/index.js
```

バックグラウンドで起動し、次のステップへ進む。

- [ ] **Step 4: ログインが通ることを確認する**

Run:

```bash
curl -s -m 10 -X POST http://localhost:8080/doctor/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test_doctor@example.com","password":"test"}' \
  -w "\nHTTP status: %{http_code}\n"
```

Expected: `{"message":"ログインに成功しました。"}` と `HTTP status: 200`

- [ ] **Step 5: 認証後のデータ取得を確認する**

Run:

```bash
COOKIE_JAR="$(mktemp)"
curl -s -m 10 -c "$COOKIE_JAR" -X POST http://localhost:8080/doctor/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test_doctor@example.com","password":"test"}' > /dev/null
curl -s -m 10 -b "$COOKIE_JAR" http://localhost:8080/doctor/patients -w "\npatients: %{http_code}\n" | tail -1
curl -s -m 10 -b "$COOKIE_JAR" http://localhost:8080/doctor/categories -w "\ncategories: %{http_code}\n" | tail -1
curl -s -m 10 -b "$COOKIE_JAR" http://localhost:8080/doctor/medical_records/1 -w "\nmedical_records: %{http_code}\n" | tail -1
rm -f "$COOKIE_JAR"
```

Expected: 3 つとも `200`。`categories` は `children` の入れ子を、`medical_records` は `categories` の紐付けを含む。これで自己参照と多対多の両方がアダプタ経由で動くことが確認できる。

- [ ] **Step 6: API を停止する**

```bash
pkill -f "node --env-file=.env build/index.js"
```

- [ ] **Step 7: `pgbouncer=true` の要否を Neon への実接続で判定する**

`packages/db/.env.neon` を作り、Neon の pooled 接続文字列を `DATABASE_URL` に設定する（`&pgbouncer=true` を**付けたもの**と**外したもの**の 2 パターンを順に試す）。

Run:

```bash
node --env-file=packages/db/.env.neon -e '
const { prisma } = await import("./packages/db/dist/src/index.js");
console.log("patients:", await prisma.patients.count());
await prisma.$disconnect();
' --input-type=module
```

Expected: どちらのパターンでも件数が返る。

- `pgbouncer=true` 無しでも動く場合 → **パラメータを外す**。これは Prisma の Rust エンジン向けの指定であり、`pg` は名前付き prepared statement を既定で使わないため不要
- 無しだとエラーになる場合 → **残す**

判定後、`packages/db/.env.neon` を削除する。

- [ ] **Step 8: 判定結果を `.env.example` に反映する**

`pgbouncer=true` を外す判定になった場合、`packages/db/.env.example` と `packages/api/.env.example` の該当コメントから `?pgbouncer=true&connection_limit=1` の記述を削除し、次の説明に置き換える。

```
# Neon    : Connection pooling を ON にした pooled 接続（ホスト名に -pooler を含む）。
#           Prisma 7 はドライバアダプタ（node-postgres）が接続を管理するため、
#           pgbouncer=true の指定は不要。
```

残す判定になった場合は既存の記述を維持する。

- [ ] **Step 9: 最終確認**

Run:

```bash
bun run typecheck
```

Expected: 全パッケージ `Exited with code 0`。

- [ ] **Step 10: コミット**

```bash
git add packages/db/.env.example packages/api/.env.example
git commit -m "docs: Prisma 7 での接続文字列の指定方法を .env.example に反映する"
```

---

## 完了後の確認事項

- [ ] Issue #283 の完了条件をすべて満たしているか照合する
- [ ] PR を作成し、`pgbouncer=true` の判定結果と、本番（Render）には反映されない旨を記載する
- [ ] `docs/superpowers/plans/` のこのファイルをコミットに含める
