# Issue 286 ステートレス認証 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** JWT の署名・検証を `jose` ベースの共有パッケージ `@repo/auth` へ集約し、Next.js の proxy でも検証できるようにしたうえで、Prisma から `session` モデルを削除する。

**Architecture:** 新パッケージ `packages/auth` が秘密鍵の解決とトークンの署名・検証を持ち、`@repo/api`（tRPC の `protectedProcedure`）と `apps/web`（`proxy.ts`）の両方がこれ 1 つを呼ぶ。秘密鍵が無い場合はモジュール読み込み時に throw し、検証不能な状態を実行時まで持ち越さない。認可の権威は従来どおり `protectedProcedure` にあり、proxy が担うのは画面遷移の判定のみ。

**Tech Stack:** bun workspaces / TypeScript 7 / jose 6.2.10 / Hono 4 / tRPC 11 / Next.js 16 / Prisma 7 / Vitest 4

**Spec:** `docs/adr/0004-stateless-jwt-auth.md`

## Global Constraints

- `jose` は **6.2.10** で固定する（2026-08-21 公開）。リリースから 3 日以内のバージョンは使わない
- `vitest` は既存の `@repo/api` と同じ **4.1.11** を使う
- 署名アルゴリズムは **HS256**。`jsonwebtoken` のデフォルトと同一にすることで発行済みトークンの互換を保つ
- JWT のペイロードのクレーム名は **`userId`** のまま変えない（発行済みトークンとの互換のため）
- 変数名・関数名・型名を省略しない。`d` / `tmp` / `val` のような名前は使わない
- コメントは日本語で書き、既存ファイルのコメント密度に合わせる
- `.env` 系ファイルは `.gitignore` 対象。**秘密鍵の実値をコミットにも会話にも出さない**
- `session` テーブルの削除マイグレーションは**ローカル DB にのみ適用**し、本番（Neon）へは適用しない（ADR 0004 決定 6）

---

### Task 0: 作業ブランチを切り、ADR をコミットする

**Files:**
- Commit: `docs/adr/0004-stateless-jwt-auth.md`（作成済み・未コミット）

**Interfaces:**
- Consumes: なし
- Produces: 作業ブランチ `feature/286-stateless-jwt`

- [ ] **Step 1: 現在のブランチと作業ツリーの状態を確認する**

Run: `git status --short && git branch --show-current`
Expected: ブランチが `main`、未追跡ファイルとして `docs/adr/0004-stateless-jwt-auth.md` と `docs/superpowers/plans/2026-09-02-stateless-jwt-auth.md` が出る

- [ ] **Step 2: 作業ブランチを作成する**

```bash
git checkout -b feature/286-stateless-jwt
```

- [ ] **Step 3: ADR と本計画をコミットする**

```bash
git add docs/adr/0004-stateless-jwt-auth.md docs/superpowers/plans/2026-09-02-stateless-jwt-auth.md
git commit -m "$(cat <<'EOF'
docs: ADR 0004 としてステートレス認証の設計を記録する

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pzpc442muwnNiLfmFKgDvZ
EOF
)"
```

---

### Task 1: `packages/auth` を新設し jose ベースのトークン実装を作る

このタスクだけで完結する。`@repo/api` と `apps/web` はまだ触らない。

**Files:**
- Create: `packages/auth/package.json`
- Create: `packages/auth/tsconfig.json`
- Create: `packages/auth/vitest.config.ts`
- Create: `packages/auth/src/secret.ts`
- Create: `packages/auth/src/token.ts`
- Create: `packages/auth/src/index.ts`
- Test: `packages/auth/test/token.spec.ts`
- Modify: `package.json`（ルートのスクリプト配線）

**Interfaces:**
- Consumes: なし
- Produces:
  - `@repo/auth` の `signDoctorToken(doctorId: number, email: string): Promise<string>`
  - `@repo/auth` の `verifyDoctorToken(token: string): Promise<DoctorTokenResult>`
  - `@repo/auth` の `type DoctorTokenResult = { ok: true; doctorId: number } | { ok: false }`
  - `@repo/auth/src/secret.js` の `doctorTokenSecret: Uint8Array`（テストからのみ参照。`index.ts` からは export しない）

- [ ] **Step 1: パッケージの雛形を作る**

`packages/auth/package.json`:

```json
{
  "name": "@repo/auth",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./package.json": "./package.json"
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "jose": "6.2.10"
  },
  "devDependencies": {
    "vitest": "4.1.11"
  }
}
```

`packages/auth/tsconfig.json`（`packages/schema/tsconfig.json` と同形。`process.env` を読むため `types` に `node` を入れる点だけ異なる）:

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
    "rootDir": "src",
    "outDir": "dist",
    "types": [
      "node"
    ]
  },
  "include": [
    "src/**/*.ts"
  ]
}
```

`packages/auth/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        // secret.ts は JWT_SECRET_KEY が無ければ読み込み時点で throw する（ADR 0004 決定 3）。
        // テストを環境ファイルへ依存させないため、ここでテスト専用の値を明示する。
        // 署名と検証の双方がこの同じ値を使うだけなので、実際の秘密鍵である必要はない。
        env: {
            JWT_SECRET_KEY: "test-only-secret-key-not-used-in-any-environment",
        },
    },
});
```

- [ ] **Step 2: 依存をインストールする**

Run: `bun install`
Expected: `packages/auth` がワークスペースとして認識され、`jose@6.2.10` が追加される。`bun.lock` が更新される

- [ ] **Step 3: 失敗するテストを書く**

`packages/auth/test/token.spec.ts`:

```ts
import { describe, test, expect } from "vitest";
import { SignJWT } from "jose";
import { signDoctorToken, verifyDoctorToken } from "../src/token.js";
import { doctorTokenSecret } from "../src/secret.js";

const validDoctorId = 1234;
const validDoctorEmail = "doctor@example.com";

// 別の鍵で署名したトークンが弾かれることを確認するために使う。
const wrongSecret = new TextEncoder().encode("wrong-secret-key");

// setExpirationTime に "-1s" のような相対指定を渡すと解釈がライブラリ依存になるため、
// 過去の絶対時刻（UNIX 秒）を渡して期限切れを確実に作る。
const oneMinuteAgoInSeconds = Math.floor(Date.now() / 1000) - 60;

describe("verifyDoctorToken", () => {
    test("有効なトークンなら doctorId を返す", async () => {
        const token = await signDoctorToken(validDoctorId, validDoctorEmail);
        await expect(verifyDoctorToken(token)).resolves.toEqual({
            ok: true,
            doctorId: validDoctorId,
        });
    });

    test("別の鍵で署名されたトークンは ok: false を返す", async () => {
        const tamperedToken = await new SignJWT({ userId: validDoctorId })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime("1d")
            .sign(wrongSecret);
        await expect(verifyDoctorToken(tamperedToken)).resolves.toEqual({ ok: false });
    });

    test("期限切れのトークンは ok: false を返す", async () => {
        const expiredToken = await new SignJWT({ userId: validDoctorId })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime(oneMinuteAgoInSeconds)
            .sign(doctorTokenSecret);
        await expect(verifyDoctorToken(expiredToken)).resolves.toEqual({ ok: false });
    });

    test("JWT として解釈できない文字列は ok: false を返す", async () => {
        await expect(verifyDoctorToken("not-a-jwt")).resolves.toEqual({ ok: false });
    });

    // 移植前の実装は Number(payload.userId) を無検査で返しており、
    // userId が無いトークンでは doctorId が NaN のまま通過していた（ADR 0004 波及）。
    test("userId を持たないトークンは ok: false を返す", async () => {
        const tokenWithoutUserId = await new SignJWT({ email: validDoctorEmail })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime("1d")
            .sign(doctorTokenSecret);
        await expect(verifyDoctorToken(tokenWithoutUserId)).resolves.toEqual({ ok: false });
    });
});

describe("signDoctorToken", () => {
    test("発行したトークンは verifyDoctorToken を通る", async () => {
        const token = await signDoctorToken(validDoctorId, validDoctorEmail);
        await expect(verifyDoctorToken(token)).resolves.toEqual({
            ok: true,
            doctorId: validDoctorId,
        });
    });

    test("ペイロードのクレーム名は userId のまま保つ", async () => {
        // 発行済みトークンとの互換のためクレーム名を変えない（ADR 0004 決定 1）。
        // 署名部分を検証せずペイロードだけを覗いて確認する。
        const token = await signDoctorToken(validDoctorId, validDoctorEmail);
        const payloadSegment = token.split(".")[1] as string;
        const payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
        expect(payload.userId).toBe(validDoctorId);
        expect(payload.email).toBe(validDoctorEmail);
    });
});
```

- [ ] **Step 4: テストを実行して失敗することを確認する**

Run: `bun run --filter @repo/auth test`
Expected: FAIL。`../src/token.js` と `../src/secret.js` が解決できない旨のエラーが出る

- [ ] **Step 5: `secret.ts` を実装する**

`packages/auth/src/secret.ts`:

```ts
// JWT_SECRET_KEY が無い状態を実行時まで持ち越さない（ADR 0004 決定 3）。
// packages/api/src/app.ts の CLIENT_URL、@repo/db の DATABASE_URL と同じ扱いで、
// 設定漏れを読み込み時点で落とす。
//
// 検証できないまま素通しする案と、検証できないので全員を弾く案はどちらも
// 「壊れていることが分からない壊れ方」になるため採らなかった。
const rawSecret = process.env.JWT_SECRET_KEY;

if (!rawSecret) {
    throw new Error(
        "JWT_SECRET_KEY が設定されていません。医師トークンの署名と検証に使用します。"
    );
}

// jose は鍵を Uint8Array で受け取る。読み込み時に 1 度だけ変換する。
export const doctorTokenSecret: Uint8Array = new TextEncoder().encode(rawSecret);
```

- [ ] **Step 6: `token.ts` を実装する**

`packages/auth/src/token.ts`:

```ts
import { SignJWT, jwtVerify } from "jose";
import { doctorTokenSecret } from "./secret.js";

// 呼び出し側は tRPC の procedure（@repo/api）と Next.js の proxy（apps/web）の 2 つで、
// エラーの表現方法が異なる。ここではステータスコードもメッセージも持たず、
// 成否だけを返して表現は呼び出し側へ委ねる。
//
// 失敗の理由を持たないのは、秘密鍵の欠落が secret.ts の throw によって
// 到達不能になったため（ADR 0004 決定 3）。残る失敗は「検証を通らない」の 1 つだけ。
export type DoctorTokenResult = { ok: true; doctorId: number } | { ok: false };

// jsonwebtoken のデフォルトと同じ HS256 を維持する。これにより発行済みのトークンが
// そのまま検証を通り、ライブラリの入れ替えで強制ログアウトが起きない（ADR 0004 決定 1）。
const signingAlgorithm = "HS256";

const doctorTokenLifetime = "1d";

// ペイロードのクレーム名 userId は移植前から変えない。変えると発行済みの
// トークンが検証を通らなくなる。
export const signDoctorToken = async (doctorId: number, email: string): Promise<string> =>
    new SignJWT({ userId: doctorId, email })
        .setProtectedHeader({ alg: signingAlgorithm })
        .setIssuedAt()
        .setExpirationTime(doctorTokenLifetime)
        .sign(doctorTokenSecret);

export const verifyDoctorToken = async (token: string): Promise<DoctorTokenResult> => {
    try {
        // algorithms を明示しないと、ヘッダの alg をそのまま信用する余地が残る。
        const { payload } = await jwtVerify(token, doctorTokenSecret, {
            algorithms: [signingAlgorithm],
        });

        const doctorId = Number(payload.userId);
        // userId が無いトークンでは Number(undefined) が NaN になり、そのまま
        // doctorId として通過してしまう。移植前の実装が持っていた穴をここで塞ぐ。
        if (!Number.isInteger(doctorId)) {
            return { ok: false };
        }

        return { ok: true, doctorId };
    } catch {
        return { ok: false };
    }
};
```

- [ ] **Step 7: `index.ts` を実装する**

`packages/auth/src/index.ts`:

```ts
// secret.ts は export しない。秘密鍵そのものを外へ出す必要がなく、
// 読み込み時 throw の副作用だけが token.ts 経由で伝わればよい。
export { signDoctorToken, verifyDoctorToken } from "./token.js";
export type { DoctorTokenResult } from "./token.js";
```

- [ ] **Step 8: テストを実行して通ることを確認する**

Run: `bun run --filter @repo/auth test`
Expected: PASS。7 件すべて成功

- [ ] **Step 9: ルートの `package.json` にビルド順を配線する**

`package.json` の `scripts` を次の 5 行に置き換える。`@repo/auth` は他のワークスペースに依存しないため `build:schema` の直後へ置く。

```json
"build": "bun run build:schema && bun run build:auth && bun run build:db && bun run build:api && bun run build:web",
"build:auth": "bun run --filter @repo/auth build",
"dev": "bun run build:schema && bun run build:auth && bun run build:db && bun run --filter '*' --parallel dev",
"typecheck": "bun run build:schema && bun run build:auth && bun run build:db && bun run build:api && bun run --filter '*' typecheck",
"test": "bun run build:schema && bun run build:auth && bun run build:db && bun run --filter @repo/auth test && bun run --filter @repo/api test"
```

- [ ] **Step 10: ビルドと型チェックが通ることを確認する**

Run: `bun run typecheck`
Expected: エラーなく終了

- [ ] **Step 11: コミットする**

```bash
git add packages/auth package.json bun.lock
git commit -m "$(cat <<'EOF'
feat: jose ベースのトークン検証を @repo/auth として切り出す

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pzpc442muwnNiLfmFKgDvZ
EOF
)"
```

---

### Task 2: `@repo/api` を `@repo/auth` へ寄せ替え `jsonwebtoken` を外す

**Files:**
- Delete: `packages/api/src/jwt_secret_key.ts`
- Delete: `packages/api/src/auth/token.ts`（`src/auth/` ディレクトリごと空になる）
- Delete: `packages/api/test/auth/token.spec.ts`（Task 1 で `packages/auth/test/token.spec.ts` へ移設済み）
- Modify: `packages/api/src/trpc/context.ts`
- Modify: `packages/api/src/trpc/init.ts`
- Modify: `packages/api/src/router/auth.ts:45-51`
- Modify: `packages/api/src/doctor_cookie.ts:1-5`（コメントのみ）
- Modify: `packages/api/vitest.config.ts`
- Modify: `packages/api/package.json`
- Test: `packages/api/test/trpc/authorization.spec.ts`

**Interfaces:**
- Consumes: `@repo/auth` の `signDoctorToken` / `verifyDoctorToken` / `DoctorTokenResult`（Task 1）
- Produces:
  - `createTrpcContext(honoContext: HonoContext): Promise<TrpcContext>`（**非同期になる**）
  - `TrpcContext = { honoContext: HonoContext; doctorAuth: DoctorTokenResult | null }`
  - `protectedProcedure`（分岐が 3 つから 2 つへ）

- [ ] **Step 1: テスト側の期待を先に書き換える**

`packages/api/vitest.config.ts` の `env` に `JWT_SECRET_KEY` を追加する。既存の 2 つのキーはそのまま残す。

```ts
        env: {
            CLIENT_URL: "http://localhost:3000",
            // prismaMock を廃止したため @repo/db が実物として読み込まれる。
            // 未設定だと読み込み時点で throw するので、接続しないダミーを置く。
            // node-postgres の Pool も PrismaClient も生成時には接続せず、
            // 初回クエリで初めて接続する。残るテストは認可や CSRF で先に止まり
            // クエリまで到達しないため、この値で実際に接続することはない。
            DATABASE_URL: "postgresql://unused:unused@localhost:5432/unused",
            // @repo/auth も未設定だと読み込み時点で throw する（ADR 0004 決定 3）。
            // 署名と検証の双方がこの同じ値を使うだけなので、実際の秘密鍵である必要はない。
            JWT_SECRET_KEY: "test-only-secret-key-not-used-in-any-environment",
        },
```

`packages/api/test/trpc/authorization.spec.ts` の冒頭 7 行を差し替える。

```ts
import { describe, test, expect } from "vitest";
import { SignJWT } from "jose";
import { doctorCookieName } from "@repo/schema";
import { app } from "../../src/app.js";

// vitest.config.ts の env で設定した値と同じものを使う。
const doctorTokenSecret = new TextEncoder().encode(process.env.JWT_SECRET_KEY);
const wrongSecret = new TextEncoder().encode("wrong-secret-key");
const oneMinuteAgoInSeconds = Math.floor(Date.now() / 1000) - 60;
```

同ファイル末尾の「認可ミドルウェアの失敗分岐」を次に差し替える。

```ts
// requireDoctor.spec.ts が検証していた 403 の 2 分岐（署名不正・期限切れ）を
// tRPC 側へ引き継いでいる。トークン生成は jsonwebtoken から jose へ移した（ADR 0004 決定 1）。
describe("認可ミドルウェアの失敗分岐", () => {
    test("署名が不正なトークンは 403 を返す", async () => {
        const tamperedToken = await new SignJWT({ userId: 1234 })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime("1d")
            .sign(wrongSecret);
        const response = await app.request("/trpc/doctor.categories.list", {
            headers: { cookie: `${doctorCookieName}=${tamperedToken}` },
        });
        expect(response.status).toBe(403);
        expect(JSON.stringify(await response.json())).toContain(
            "ログインの有効期限が切れている可能性があります。"
        );
    });

    test("期限切れのトークンは 403 を返す", async () => {
        const expiredToken = await new SignJWT({ userId: 1234 })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime(oneMinuteAgoInSeconds)
            .sign(doctorTokenSecret);
        const response = await app.request("/trpc/doctor.categories.list", {
            headers: { cookie: `${doctorCookieName}=${expiredToken}` },
        });
        expect(response.status).toBe(403);
    });
});
```

- [ ] **Step 2: 書き換えたテストが現行実装のまま通ることを確認する**

このタスクは新しい振る舞いを足すのではなく実装を差し替える変更なので、赤→緑のサイクルにはならない。既存テストは回帰検知として使う。

Run: `bun run --filter @repo/api test`
Expected: PASS。この時点の実装はまだ `jsonwebtoken` だが、jose が HS256 で署名したトークンはその検証を通る

**この Step が通ること自体が ADR 0004 決定 1 の「発行済みトークンはそのまま検証を通り、強制ログアウトは発生しない」という主張の裏づけになる。ここが落ちた場合、互換性の前提が崩れているので実装へ進まず報告する。**

なお `jose` はこの時点で `@repo/api` の依存に宣言されていないが、`@repo/auth` の依存としてルートの `node_modules` へ巻き上げられているため import は解決する。Step 3 で明示的に宣言するのは、暗黙の巻き上げに頼らないためである。

- [ ] **Step 3: `package.json` の依存を入れ替える**

`packages/api/package.json` の `dependencies` から `"jsonwebtoken": "^9.0.2"` を削除し `"@repo/auth": "workspace:*"` を追加する。`devDependencies` から `"@types/jsonwebtoken": "^9.0.7"` を削除する。

テストが `jose` を直接 import するため、`devDependencies` に `"jose": "6.2.10"` を追加する。

Run: `bun install`
Expected: `jsonwebtoken` と `@types/jsonwebtoken` が外れ、`@repo/auth` がリンクされる

- [ ] **Step 4: `context.ts` を書き換える**

`packages/api/src/trpc/context.ts` の全体を置き換える。

```ts
import type { Context as HonoContext } from "hono";
import { getCookie } from "hono/cookie";
import { doctorCookieName } from "@repo/schema";
import { verifyDoctorToken, type DoctorTokenResult } from "@repo/auth";

// Hono の Context を持ち回るのは、login / logout が setCookie / deleteCookie を
// 呼ぶ必要があるため。tRPC 自体は Cookie を扱う手段を持たない。
//
// doctorAuth が null なのは「Cookie そのものが無い」場合。検証まで進んだ結果は
// DoctorTokenResult に入る。この 2 状態が protectedProcedure の 401 と 403 に対応する。
export type TrpcContext = {
    honoContext: HonoContext;
    doctorAuth: DoctorTokenResult | null;
};

// jose の検証が非同期のため createTrpcContext も非同期になる（ADR 0004 決定 1）。
// @hono/trpc-server の createContext は Promise を受け付けるため app.ts に変更は要らない。
export const createTrpcContext = async (honoContext: HonoContext): Promise<TrpcContext> => {
    const token = getCookie(honoContext, doctorCookieName);
    return {
        honoContext,
        doctorAuth: token ? await verifyDoctorToken(token) : null,
    };
};
```

- [ ] **Step 5: `init.ts` を書き換える**

`packages/api/src/trpc/init.ts` の全体を置き換える。`deleteCookie` / `doctorCookieName` / `doctorCookieAttributes` の import が不要になる点に注意する。

```ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context.js";

// superjson を入れる理由は ADR 0003 決定 6。transformer が無いと
// tRPC はサーバの戻り値の型をそのまま推論するため、型は Date を主張して
// 実行時は文字列という食い違いが残る。型安全が目的の変更で嘘を作らない。
const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

// Cookie 無し（401）と検証失敗（403）の 2 分岐。
// ADR 0003 の時点では「秘密鍵未設定」を加えた 3 分岐だったが、@repo/auth が
// 読み込み時に throw するようになり到達不能になったため畳んだ（ADR 0004 決定 3）。
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
    if (ctx.doctorAuth === null) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインしてください。" });
    }
    if (!ctx.doctorAuth.ok) {
        throw new TRPCError({
            code: "FORBIDDEN",
            message: "ログインの有効期限が切れている可能性があります。",
        });
    }
    // 通過後は doctorId が number として推論される
    return next({ ctx: { ...ctx, doctorId: ctx.doctorAuth.doctorId } });
});
```

- [ ] **Step 6: `router/auth.ts` のトークン発行部を書き換える**

import 行を差し替える。

```ts
import { signDoctorToken } from "@repo/auth";
```

`packages/api/src/router/auth.ts:45-51` の 7 行を次の 1 行に置き換える。秘密鍵が無ければ `@repo/auth` の読み込み時点で落ちるため、null チェックと「トークンの設定が無効です。」の分岐は到達不能になる。

```ts
            const token = await signDoctorToken(doctor.id, email);
```

- [ ] **Step 7: `doctor_cookie.ts` のコメントを実態に合わせる**

`packages/api/src/doctor_cookie.ts` の冒頭 5 行を置き換える。Step 5 で `trpc/init.ts` からの参照が消えたため、参照元の記述が事実と食い違う。

```ts
// 医師のログイン Cookie の属性を 1 箇所に集約する。
// 発行と削除の両方を行う router/auth.ts（login / logout）が参照する。
// 発行時と削除時で属性が食い違うと、ブラウザは別の Cookie とみなし削除が
// 効かなくなるため、同じ定義を共有することで防ぐ。
```

- [ ] **Step 8: 旧実装を削除する**

```bash
git rm packages/api/src/jwt_secret_key.ts packages/api/src/auth/token.ts packages/api/test/auth/token.spec.ts
```

- [ ] **Step 9: テストと型チェックを実行して通ることを確認する**

Run: `bun run typecheck && bun run test`
Expected: 型チェックがエラーなく終了し、`@repo/auth` の 7 件と `@repo/api` の全テストが PASS。`jsonwebtoken` への参照が残っていれば型チェックで落ちる

- [ ] **Step 10: `jsonwebtoken` への参照が消えたことを確認する**

Run: `grep -rn "jsonwebtoken\|jwt_secret_key" packages apps --include='*.ts' --include='*.json' | grep -v node_modules`
Expected: 出力なし

- [ ] **Step 11: コミットする**

```bash
git add packages/api package.json bun.lock
git commit -m "$(cat <<'EOF'
refactor: API のトークン検証を @repo/auth へ寄せ jsonwebtoken を外す

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pzpc442muwnNiLfmFKgDvZ
EOF
)"
```

---

### Task 3: `apps/web` の proxy で JWT を検証する

このタスクには自動テストが無い。`apps/web` にはテスト基盤が存在せず、本 Issue でその導入まで広げない（テスト基盤は #288 の担当）。Step 5 の手動確認が検証手段になる。

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/proxy.ts`
- Modify: `apps/web/.env`（`.gitignore` 対象。コミットされない）

**Interfaces:**
- Consumes: `@repo/auth` の `verifyDoctorToken`（Task 1）
- Produces: `proxy(req: NextRequest): Promise<NextResponse>`（**非同期になる**）

- [ ] **Step 1: 環境変数を設定する（実行者への依頼）**

`apps/web/.env` に `JWT_SECRET_KEY` を追加する。値は `packages/api/.env` の同名キーと同一でなければならない。異なる値だと API が発行したトークンを proxy が検証できず、ログイン直後に必ずログイン画面へ戻される。

あわせて、どこからも参照されていない次の 2 行を削除する（ADR 0004 波及）。

- `NEXT_DOCTOR_SESSION_SECURE` — express-session 時代の残骸
- `NEXT_JWT_SECRET_KEY` — 未使用。今回追加する `JWT_SECRET_KEY` とは別物

**この作業はファイルを直接編集する形で実行者が行う。秘密鍵の値をコマンドライン、コミット、会話ログのいずれにも出さないこと。**

未参照であることは次で再確認できる。

Run: `grep -rn "NEXT_DOCTOR_SESSION_SECURE\|NEXT_JWT_SECRET_KEY" apps packages --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.json' | grep -v node_modules`
Expected: 出力なし

- [ ] **Step 2: `apps/web/package.json` に依存を追加する**

`dependencies` に `"@repo/auth": "workspace:*"` を追加する。あわせて `build` スクリプトへ `@repo/auth` のビルドを挟む。

```json
"build": "bun run --filter @repo/schema build && bun run --filter @repo/auth build && bun run --filter @repo/db build && bun run --filter @repo/api build && next build",
```

Run: `bun install`
Expected: `apps/web` から `@repo/auth` が解決できるようになる

- [ ] **Step 3: `proxy.ts` を書き換える**

`apps/web/src/proxy.ts` の全体を置き換える。

```ts
import { NextRequest, NextResponse } from "next/server";
import { doctorCookieName } from "@repo/schema";
import { verifyDoctorToken } from "@repo/auth";

// Cookie の有無だけを見ていた頃は、期限切れの Cookie を持つ利用者がデッドロックしていた。
// /doctor/login を開こうとしても Cookie があるため patients-list へ飛ばされ、
// patients-list では tRPC が FORBIDDEN を返すため、ログインし直す画面へ到達できない。
// 署名と有効期限まで検証することでこれを解消する（ADR 0004 決定 4）。
//
// 認可の権威は引き続き packages/api の protectedProcedure にある。ここが担うのは
// 画面遷移の判定だけで、tRPC 側の検証を代替するものではない。
export async function proxy(req: NextRequest) {
    const url = req.nextUrl;

    if (!url.pathname.startsWith("/doctor")) {
        return NextResponse.next();
    }

    const token = req.cookies.get(doctorCookieName)?.value;
    const isAuthenticated = token ? (await verifyDoctorToken(token)).ok : false;

    // 検証に失敗した Cookie をここで削除はしない。本番の Cookie は API 側が
    // domain 付きで発行しており（packages/api/src/doctor_cookie.ts）、属性の異なる
    // 削除をブラウザは受け付けない。効かない処理を置かず、再ログインでの上書きに委ねる
    // （ADR 0004 決定 5）。
    if (!isAuthenticated && url.pathname !== "/doctor/login") {
        return NextResponse.redirect(new URL("/doctor/login", req.url));
    }
    if (isAuthenticated && url.pathname === "/doctor/login") {
        return NextResponse.redirect(new URL("/doctor/patients-list", req.url));
    }
    return NextResponse.next();
}
```

- [ ] **Step 4: 型チェックとビルドが通ることを確認する**

Run: `bun run typecheck && bun run build`
Expected: 両方ともエラーなく終了

`next build` の途中で `JWT_SECRET_KEY が設定されていません。` が出た場合、Next が proxy のモジュールをビルド時に評価している。その場合は Step 1 の設定漏れをまず疑い、設定済みなら本計画を中断して報告する（`@repo/auth` の秘密鍵解決を遅延させる設計変更が必要になり、ADR 0004 決定 3 の再検討にあたる）。

- [ ] **Step 5: 手動で動作を確認する**

前提: `docker compose up -d` でローカル DB が起動していること。

Run: `bun run dev`

1. `http://localhost:3000/doctor/patients-list` を開く → `/doctor/login` へリダイレクトされる
2. ログインする → `/doctor/patients-list` が表示される
3. `/doctor/login` を開く → `/doctor/patients-list` へリダイレクトされる
4. ログアウトする → `/doctor/login` が表示される
5. **デッドロックの回帰確認**: ブラウザの開発者ツールで `doctor-manager` Cookie の値を `not-a-jwt` に書き換え、`/doctor/patients-list` を開く → `/doctor/login` が表示され、ログインし直せる（変更前はここで `patients-list` へ戻され続けていた）

- [ ] **Step 6: コミットする**

`.env` は `.gitignore` 対象のため含まれない。

```bash
git add apps/web/package.json apps/web/src/proxy.ts bun.lock
git commit -m "$(cat <<'EOF'
fix: proxy で JWT を検証し期限切れ Cookie のデッドロックを解消する

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pzpc442muwnNiLfmFKgDvZ
EOF
)"
```

---

### Task 4: Prisma から `session` モデルを削除する

**Files:**
- Modify: `packages/db/prisma/schema.prisma:73-79`
- Modify: `packages/db/scripts/guarded-migrate.mjs:69-73`
- Create: `packages/db/prisma/migrations/<生成されるタイムスタンプ>_drop_session_table/migration.sql`

**Interfaces:**
- Consumes: なし
- Produces: なし（`prisma.session` を参照するコードは存在しない）

- [ ] **Step 1: `session` モデルを参照するコードが無いことを確認する**

Run: `grep -rn "prisma.session\|\.session\b" packages/api/src apps/web/src | grep -v node_modules`
Expected: 出力なし

- [ ] **Step 2: `guarded-migrate.mjs` が追加引数を prisma へ渡すようにする**

現状は引数配列がハードコードされており、`--name` を渡せない。そのため `prisma migrate dev` がマイグレーション名を対話で尋ねて停止する。`packages/db/scripts/guarded-migrate.mjs` の `spawnSync` 呼び出しを次に置き換える。

```js
// このスクリプトは packages/db を作業ディレクトリとして実行される。
// サブコマンド以降の引数（--name 等）はそのまま prisma へ渡す。渡せないと
// migrate dev がマイグレーション名を対話で尋ね、自動実行が止まる。
const forwardedArguments = process.argv.slice(3);

const result = spawnSync(
    "prisma",
    ["migrate", subcommand, "--config", "prisma.config.ts", ...forwardedArguments],
    {
        stdio: "inherit",
        shell: true,
    }
);
process.exit(result.status ?? 1);
```

- [ ] **Step 3: `schema.prisma` から `session` モデルを削除する**

`packages/db/prisma/schema.prisma:73-79` の次のブロックを削除する。前後の空行が二重にならないよう整える。

```prisma
model session {
  sid    String   @id @db.VarChar
  sess   Json     @db.Json
  expire DateTime @db.Timestamp(6)

  @@index([expire], map: "IDX_session_expire")
}
```

- [ ] **Step 4: ローカル DB が起動していることを確認する**

Run: `docker compose up -d && docker compose ps`
Expected: `patient-management-postgres` が `healthy` になっている

- [ ] **Step 5: マイグレーションを生成しローカルへ適用する**

`guarded-migrate.mjs` が接続先をローカルに限定しているため、`DIRECT_URL` が Neon を指していれば実行前に停止する。停止したら Neon へ適用してはならない（ADR 0004 決定 6）。

Run: `cd packages/db && bun run migrate:dev --name drop_session_table`
Expected: `prisma/migrations/<タイムスタンプ>_drop_session_table/migration.sql` が生成され、ローカル DB へ適用される。Prisma Client が再生成される

- [ ] **Step 6: 生成された SQL を確認する**

Run: `cat packages/db/prisma/migrations/*_drop_session_table/migration.sql`
Expected: `DROP TABLE "public"."session";` を含む（インデックスはテーブルと共に落ちる）。**`session` 以外のテーブルへの操作が含まれていたら適用を取り消して報告する**

- [ ] **Step 7: ローカル DB からテーブルが消えたことを確認する**

Run: `docker compose exec postgres psql -U dev -d patient_management -c '\dt'`
Expected: 一覧に `session` が無く、`patients` / `doctors` / `medical_records` / `categories` / `medical_categories` / `_prisma_migrations` が残っている

- [ ] **Step 8: 型チェックとテストが通ることを確認する**

Run: `bun run typecheck && bun run test`
Expected: 両方ともエラーなく終了

- [ ] **Step 9: コミットする**

```bash
git add packages/db
git commit -m "$(cat <<'EOF'
feat: Prisma から session モデルを削除しマイグレーションを追加する

本番（Neon）への適用は Render 撤収後に #293 で行う。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pzpc442muwnNiLfmFKgDvZ
EOF
)"
```

---

### Task 5: 完了確認と Issue の更新

**Files:**
- 変更なし（GitHub 上の Issue のみ）

**Interfaces:**
- Consumes: Task 1〜4 の成果
- Produces: なし

- [ ] **Step 1: 全体の検証をやり直す**

Run: `bun run typecheck && bun run test && bun run build`
Expected: 3 つともエラーなく終了

- [ ] **Step 2: 依存とコードから旧実装の痕跡が消えたことを確認する**

Run: `grep -rni "express-session\|connect-pg-simple\|jsonwebtoken" packages apps --include='*.ts' --include='*.tsx' --include='*.json' --include='*.prisma' | grep -v node_modules | grep -v '/dist/' | grep -v 'generated/client'`
Expected: 出力なし

Run: `grep -rn "session" packages/db/prisma/schema.prisma`
Expected: 出力なし

- [ ] **Step 3: #293 へ本番適用の項目を追加する（要・利用者の承認）**

**この操作は GitHub 上の Issue を書き換える外向きの操作である。実行前に利用者へ確認を取ること。**

#293 の「インフラ撤収」節へ次の 1 行を追加する。

```
- [ ] Neon へ `session` 削除マイグレーションを適用する（Render 停止後。ADR 0004 決定 6）
```

- [ ] **Step 4: PR を作成する（要・利用者の承認）**

**この操作も外向きである。実行前に利用者へ確認を取ること。**

PR の本文には次を含める。

- ADR 0004 へのリンク
- Issue #286 の 5 項目のうち 3 項目が着手時点で既に完了していたこと
- `session` テーブルの本番適用を #293 へ委ねたこと、およびその理由（`render-legacy` が `connect-pg-simple` を使用中）
- `apps/web` に `JWT_SECRET_KEY` の設定が必要になったこと（Vercel の環境変数へ追加が必要）
- 末尾に次の 2 行

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Pzpc442muwnNiLfmFKgDvZ
```

---

## 実装後に残る既知の状態

計画どおり完了しても次は解消しない。いずれも意図的な先送りである。

- **`schema.prisma` と本番 DB がズレる。** `session` テーブルは Neon 上に残り続ける。#293 で解消（ADR 0004 決定 6）
- **`packages/api` から Next.js を import できてしまう。** 依存の向きは規約でしか守られていない。別 Issue として起票する（ADR 0004「検討して採用しなかった案」）
- **パスワードが平文で保存されている。** ADR 0002 の残課題
- **`apps/web` にテストが無い。** Task 3 の検証は手動確認のみ。テスト基盤は #288 の担当
