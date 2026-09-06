# Vercel 統合（Issue 287 コード部分）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@repo/api` の Hono アプリを Next.js の route handler としてマウントし、`api` サブドメインを維持したまま Render を不要にするためのコードを揃える。

**Architecture:** Vercel プロジェクトは 1 つ。`www` と `api` の 2 ドメインを同じ Next アプリへ向け、`api` ホストからのリクエストを rewrite で `/api/*` へ流す。Hono アプリは `/trpc/*` と `/api/trpc/*` の双方にマウントし、rewrite 経由でパスの前置きが残るかどうかに依存しない形にする。フロントは `api` サブドメインを呼び続けるため CORS は維持し、Cookie の `SameSite` のみ `None` から `Lax` へ強化する。

**Tech Stack:** bun workspaces / TypeScript 7 / Hono 4 / tRPC 11 / Next.js 16 / Vitest 4 / Vercel

**Spec:** `docs/adr/0006-vercel-integration.md`

## Global Constraints

- **本番へのデプロイ・環境変数設定・DNS 変更は本計画の範囲外。** 本計画が produce するのは「コードが揃い、ローカルで両経路が動く」状態まで
- **`NEXT_PUBLIC_API_URL` と `CLIENT_URL` は削除しない。** ADR 0006 決定 2 によりフロントは `api` サブドメインを呼び続ける
- **`packages/api` は Next.js を一切 import しない**（Epic #279 / ADR 0006 決定 3）
- Hono アプリは `/trpc/*` と `/api/trpc/*` の**両方**に応答する（ADR 0006 決定 4）
- 変数名・関数名・型名を省略しない
- コメントは日本語で書き、既存ファイルのコメント密度に合わせる
- 既存の日本語エラーメッセージは変えない

## 実測できないことの明示

ADR 0006 決定 4 は「実装の最初のステップで実際の `request.url` を計測し、片方だけで足りると分かった時点でマウントを 1 つに絞る」と書いている。**この計測はローカルでは完結しない。**

ローカルには `api.example.com` へのホスト名マッチングが成立する経路が無く、`localhost:3000/api/trpc/*` を直接叩けば `request.url` は当然 `/api/trpc/...` になる。**rewrite を通したときに書き換え前後どちらのパスが見えるかは、Vercel のプレビュー環境でしか確認できない。**

したがって本計画では二重マウントを維持し、**絞り込みは Vercel 確認後の別作業**とする。Task 6 で #287 のチェックリストへ計測項目を追加する。

---

### Task 1: 作業ブランチを切り、ADR をコミットする

**Files:**
- Commit: `docs/adr/0006-vercel-integration.md`（作成済み・未コミット）
- Commit: `docs/superpowers/plans/2026-09-06-vercel-integration.md`（本ファイル）

**Interfaces:**
- Consumes: なし
- Produces: 作業ブランチ `feature/287-vercel-integration`

- [ ] **Step 1: 現在のブランチと作業ツリーを確認する**

Run: `git status --short && git branch --show-current`
Expected: ブランチが `main`、未追跡ファイルとして ADR と本計画が出る

- [ ] **Step 2: 作業ブランチを作成してコミットする**

```bash
git checkout -b feature/287-vercel-integration
git add docs/adr/0006-vercel-integration.md docs/superpowers/plans/2026-09-06-vercel-integration.md
git commit -m "$(cat <<'EOF'
docs: ADR 0006 として Vercel 統合の設計を記録する

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pzpc442muwnNiLfmFKgDvZ
EOF
)"
```

---

### Task 2: Hono アプリを 2 つのパスへマウントし、`@repo/api` の exports を付け替える

**Files:**
- Modify: `packages/api/src/app.ts`
- Modify: `packages/api/package.json`
- Test: `packages/api/test/mount.spec.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `@repo/api` の `app`（`Hono` インスタンス。`/trpc/*` と `/api/trpc/*` の両方に応答する）
  - `@repo/api` の `type AppRouter`（`app.ts` からの再 export）

- [ ] **Step 1: 失敗するテストを書く**

`packages/api/test/mount.spec.ts`:

```ts
import { describe, test, expect } from "vitest";
import { app } from "../src/app.js";

// ADR 0006 決定 4。単独起動時は /trpc/* で、Vercel の route handler 経由では
// /api/trpc/* でリクエストが届く。hono/vercel の handle はパスの前置きを
// 剥がさないため、どちらでも同じ結果になることをここで固定する。
//
// 認可が無いので 401 が返るのが正しい。404 が返る場合はマウントされていない。
describe("マウントされるパス", () => {
    test("/trpc/* は認可が無ければ 401 を返す", async () => {
        const response = await app.request("/trpc/doctor.categories.list");
        expect(response.status).toBe(401);
    });

    test("/api/trpc/* も認可が無ければ 401 を返す", async () => {
        const response = await app.request("/api/trpc/doctor.categories.list");
        expect(response.status).toBe(401);
    });

    test("どちらにもマウントされていないパスは 404 を返す", async () => {
        const response = await app.request("/nonexistent");
        expect(response.status).toBe(404);
    });
});
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `bun run --filter @repo/api test`
Expected: FAIL。`/api/trpc/*` のテストが 401 ではなく 404 になる

- [ ] **Step 3: `app.ts` を書き換える**

`packages/api/src/app.ts` の全体を置き換える。ミドルウェアの順序（cors → csrf → trpcServer）は変えない。

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "./trpc/appRouter.js";
import { createTrpcContext } from "./trpc/context.js";

// apps/web は `import type { AppRouter } from "@repo/api"` で型を参照する。
// exports の "." が app.js を指すようになったため、ここから再 export する
// （ADR 0006 決定 3）。
export type { AppRouter } from "./trpc/appRouter.js";

// CORS の許可オリジン。未設定のまま起動すると Access-Control-Allow-Origin が
// ワイルドカードになり、credentials: true と組み合わさってブラウザ側で必ず拒否される。
// 失敗が初回リクエストまで表面化しないため、@repo/db の DATABASE_URL と同様に
// 読み込み時点で落とす。
//
// Vercel 統合後も CORS は残る。フロントは api サブドメインを呼び続けるため
// オリジンが異なる（ADR 0006 決定 2）。
const accessClientUrl = process.env.CLIENT_URL;
if (!accessClientUrl) {
    throw new Error(
        "CLIENT_URL が設定されていません。CORS の許可オリジンをこの環境変数から解決します。"
    );
}

const apiRoutes = new Hono()
    .use(
        "*",
        cors({
            origin: accessClientUrl,
            credentials: true,
            allowHeaders: [
                "Content-Type",
                "Authorization",
                "Accept",
                "X-Requested-With",
                "Access-Control-Allow-Credentials",
            ],
        })
    )
    // Hono の context.req.json() は Content-Type を検査せず本文を JSON として解釈する。
    // Express の express.json() は application/json 以外を弾いていたため、
    // プリフライトが発生しない text/plain のクロスサイト POST は本文が空のまま
    // 検証で落ちていた。その障壁が移行で消えるので、Origin を検査する正式な防御を置く。
    .use("*", csrf({ origin: accessClientUrl }))
    // REST から tRPC への移行が完了し（ADR 0003 決定 4）、残るアプリケーションの
    // RPC はすべて tRPC が担う。token_check は参照が無いため移植せず削除した
    // （ADR 0003 決定 7）。
    .use(
        "/trpc/*",
        trpcServer({
            router: appRouter,
            createContext: (_opts, honoContext) => createTrpcContext(honoContext),
        })
    );

// listen はここでは行わない。Node で起動する経路は index.ts、
// Vercel へ載せる経路は apps/web の route handler がそれぞれ担う。
// この分離が「1 つのホストへ畳む」選択を不可逆にしないための境界になる。
//
// 同じルート群を 2 箇所へマウントするのは、hono/vercel の handle が
// パスの前置きを剥がさないためである（ADR 0006 決定 4）。単独起動時は
// /trpc/*、Vercel の route handler 経由では /api/trpc/* で届く。
// rewrite 経由でどちらのパスが見えるかは Vercel 上でしか計測できないため、
// 計測が済むまで両方を受ける。
export const app = new Hono().route("/", apiRoutes).route("/api", apiRoutes);
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `bun run --filter @repo/api test`
Expected: PASS。`mount.spec.ts` の 3 件を含め全件成功

- [ ] **Step 5: `package.json` の exports を付け替える**

`packages/api/package.json` の `main` / `types` / `exports` を置き換える。**`scripts` は変更しない**（`start` は引き続き `node build/index.js`）。

```json
  "main": "./build/app.js",
  "types": "./build/app.d.ts",
  "exports": {
    ".": {
      "types": "./build/app.d.ts",
      "default": "./build/app.js"
    },
    "./package.json": "./package.json"
  },
```

- [ ] **Step 6: 型チェックが通ることを確認する**

Run: `bun run typecheck`
Expected: 成功。`apps/web/src/lib/trpc.ts` の `import type { AppRouter } from "@repo/api"` が `app.ts` の再 export 経由で解決する。ここが落ちる場合は Step 3 の `export type` が抜けている

- [ ] **Step 7: 単独起動が従来どおり動くことを確認する**

`bun run dev:api` を別プロセスで起動しておく。

Run:
```bash
curl -s -o /dev/null -w "/trpc → %{http_code}\n" http://localhost:8080/trpc/doctor.categories.list
curl -s -o /dev/null -w "/api/trpc → %{http_code}\n" http://localhost:8080/api/trpc/doctor.categories.list
```
Expected: 両方とも `401`（認可が無いため）。`404` が返る場合はマウントが効いていない

- [ ] **Step 8: コミットする**

```bash
git add packages/api
git commit -m "$(cat <<'EOF'
feat: Hono アプリを /trpc と /api/trpc の両方へマウントする

hono/vercel の handle はパスの前置きを剥がさないため、Vercel の
route handler 経由では /api/trpc/* で届く。rewrite 経由でどちらのパスが
見えるかは Vercel 上でしか計測できないため、両方を受ける形にした。

あわせて exports の "." を build/index.js（serve を呼ぶ単独起動用）から
build/app.js へ付け替えた。従来は app を export しておらず、Issue #287 が
示していた import { app } from "@repo/api" は動かなかった。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pzpc442muwnNiLfmFKgDvZ
EOF
)"
```

---

### Task 3: route handler を追加し、ローカルで疎通を確認する

**Files:**
- Create: `apps/web/src/app/api/[[...route]]/route.ts`

**Interfaces:**
- Consumes: `@repo/api` の `app`（Task 2）
- Produces: `/api/*` を Hono へ委譲する route handler

- [ ] **Step 1: route handler を作る**

`apps/web/src/app/api/[[...route]]/route.ts`:

```ts
import { handle } from "hono/vercel";
import { app } from "@repo/api";

// packages/api と Next.js の唯一の接点（Epic #279）。ここに業務ロジックを
// 書かないこと。書いた瞬間に「Next.js に API を作った」形になり、
// packages/api を独立させている意味が失われる。
//
// これは apps/web から @repo/api への値 import である。ADR 0003 の不変条件は
// 「必ず import type」だったが、ADR 0006 決定 7 で「クライアント向けコードは
// 型のみ。route handler はサーバ専用なので値でよい」へ改めた。
export const GET = handle(app);
export const POST = handle(app);
```

- [ ] **Step 2: 型チェックとビルドが通ることを確認する**

Run: `bun run typecheck && bun run build`
Expected: 両方成功。`bun run build` が通ることは、Prisma がブラウザ向けバンドルへ入っていないことの確認も兼ねる（入ると失敗する）

- [ ] **Step 3: ローカルで route handler 経由の疎通を確認する**

`bun run dev` を別プロセスで起動しておく（web が 3000、API が 8080）。

Run:
```bash
curl -s -o /dev/null -w "route handler 経由 → %{http_code}\n" http://localhost:3000/api/trpc/doctor.categories.list
```
Expected: `401`。`404` なら route handler かマウントのどちらかが効いていない

**この経路が本番の rewrite 経由と同一である保証は無い。** ローカルには `api` サブドメインへのホスト名マッチングが成立する経路が無いため、ここで確認できるのは「route handler が Hono へ委譲できている」ことまでである。

- [ ] **Step 4: 画面が従来どおり動くことを確認する**

`bun run dev` を起動したままブラウザで確認する。フロントは `NEXT_PUBLIC_API_URL=http://localhost:8080` を見るため、**route handler は通らず 8080 の単独起動を叩く**（ADR 0006 決定 8）。

1. `http://localhost:3000/doctor/login` でログインする
2. 患者一覧・医師一覧が表示される
3. ログアウトできる

Expected: すべて従来どおり。ここが壊れる場合は Task 2 の `app.ts` の書き換えで既存経路を壊している

- [ ] **Step 5: コミットする**

```bash
git add apps/web/src/app/api
git commit -m "$(cat <<'EOF'
feat: Hono アプリを Next.js の route handler としてマウントする

packages/api と Next.js の唯一の接点。業務ロジックは置かない。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pzpc442muwnNiLfmFKgDvZ
EOF
)"
```

---

### Task 4: `next.config.mjs` に rewrite を足し、静的エクスポートを明示的に落とす

**Files:**
- Modify: `apps/web/next.config.mjs`

**Interfaces:**
- Consumes: なし
- Produces: 環境変数 `API_SUBDOMAIN_HOST`（設定されているときだけ rewrite を登録する）

- [ ] **Step 1: `next.config.mjs` を書き換える**

`apps/web/next.config.mjs` の全体を置き換える。

```js
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 静的エクスポートは Request に依存する Route Handlers と Proxy を
// サポートしない。#287 で route handler を追加したため、この構成では
// 正常にビルドできない（ADR 0006 決定 6）。
//
// 内部エラーで落ちると「意図した帰結」か「バグ」かを読み取れないため、
// ここで明示的に落とす。infra/（AWS）の扱いそのものは #293 で判断する。
if (process.env.DEPLOY_TARGET === 'aws') {
    throw new Error(
        [
            '静的エクスポート（DEPLOY_TARGET=aws）は #287 以降サポートしません。',
            'route handler（apps/web/src/app/api/[[...route]]/route.ts）と proxy.ts は',
            'output: "export" では動作しません。infra/ の扱いは #293 で判断します。',
        ].join('\n')
    );
}

// api サブドメインからのリクエストを route handler へ流すためのホスト名。
// 例: api.patient-management-kubo-works-projects.com
//
// ローカル開発では api サブドメインが存在せず、フロントは 8080 の単独起動を
// 直接叩くため未設定でよい（ADR 0006 決定 8）。Vercel では設定が必要で、
// 未設定だと api サブドメインが 404 になる。#287 のチェックリストに含めた。
const apiSubdomainHost = process.env.API_SUBDOMAIN_HOST;

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    outputFileTracingRoot: path.resolve(__dirname, '../../'),
    turbopack: {},
    async rewrites() {
        if (!apiSubdomainHost) {
            return [];
        }
        // api サブドメインへの /trpc/... を /api/trpc/... へ流し、
        // route handler に拾わせる（ADR 0006 決定 1）。
        return [
            {
                source: '/:path*',
                has: [{ type: 'host', value: apiSubdomainHost }],
                destination: '/api/:path*',
            },
        ];
    },
};

export default nextConfig;
```

**削除した `headers()` について**: `/doctor/:path*` へ `Access-Control-*` を付けていたが、CORS を返すのは `api` サブドメイン側の Hono である。Next 側にも同じ設定があると、片方だけ更新される事故の元になるため削除する（ADR 0006 波及）。

- [ ] **Step 2: 通常のビルドが通ることを確認する**

Run: `bun run build`
Expected: 成功

- [ ] **Step 3: AWS 向けビルドが明示的なメッセージで落ちることを確認する**

Run: `cd apps/web && DEPLOY_TARGET=aws bun run build 2>&1 | head -20`
Expected: 「静的エクスポート（DEPLOY_TARGET=aws）は #287 以降サポートしません。」を含むエラーで停止する。Next の内部エラーではないこと

- [ ] **Step 4: rewrite が未設定でも通常経路が動くことを確認する**

`bun run dev` を起動し、ブラウザで `http://localhost:3000/doctor/login` を開く。

Expected: ログイン画面が表示される。`API_SUBDOMAIN_HOST` 未設定でも rewrite が空配列になるだけで、通常の経路には影響しない

- [ ] **Step 5: コミットする**

```bash
git add apps/web/next.config.mjs
git commit -m "$(cat <<'EOF'
feat: api サブドメイン向けの rewrite を追加し、静的エクスポートを明示的に落とす

API_SUBDOMAIN_HOST が設定されているときだけ rewrite を登録する。
ローカルでは api サブドメインが存在しないため未設定でよい。

DEPLOY_TARGET=aws は route handler と proxy が output: "export" で
動作しないため、読み込み時点で理由付きの例外にした。infra/ の扱いは
#293 で判断する。

あわせて next.config の CORS ヘッダを削除した。CORS は api サブドメイン側の
Hono が返すため、Next 側の設定は重複であり片方だけ更新される事故の元になる。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pzpc442muwnNiLfmFKgDvZ
EOF
)"
```

---

### Task 5: Cookie の `SameSite` を `None` から `Lax` へ変える

**Files:**
- Modify: `packages/api/src/doctor_cookie.ts`
- Modify: `packages/api/src/app.ts`（コメント 1 行のみ）

**Interfaces:**
- Consumes: なし
- Produces: なし

- [ ] **Step 1: `doctor_cookie.ts` を書き換える**

`packages/api/src/doctor_cookie.ts` の全体を置き換える。

```ts
// 医師のログイン Cookie の属性を 1 箇所に集約する。
// 発行と削除の両方を行う router/auth.ts（login / logout）が参照する。
// 発行時と削除時で属性が食い違うと、ブラウザは別の Cookie とみなし削除が
// 効かなくなるため、同じ定義を共有することで防ぐ。

const isProduction = process.env.NODE_ENV === "production";

// Express の res.cookie はミリ秒を受け取るが、Hono の setCookie は秒を受け取る。
// 取り違えると有効期限が 1000 倍ずれ、しかもテストでは検出できないため、
// 単位を名前に含めて次に触る人が気づけるようにする。
export const DOCTOR_COOKIE_MAX_AGE_SECONDS = 60 * 60;

// SameSite はオリジンではなくサイト（eTLD+1）で判定される。フロントの www と
// API の api は同じ eTLD+1 に属するため same-site であり、Lax でも Cookie は
// 送信される（ADR 0006 決定 5）。
//
// 移行前は API が onrender.com にあり cross-site だったため None 以外に
// 選択肢が無かった。None はクロスサイト送信を許す最も弱い設定で、CSRF 耐性を
// ブラウザ側の既定防御に頼れなくなる。api サブドメインへ移った時点で不要になる。
//
// 三項演算子の結果は注釈が無いと string へ広がり、Hono の CookieOptions に
// 代入できない。as を増やさずに literal を保つため変数の型で受ける。
const doctorCookieSameSite: "Lax" | "Strict" = isProduction ? "Lax" : "Strict";

// path: Express は "/" を自動補完したが Hono は補完しない。省略すると Path が
//       /doctor になり、他のパスへ Cookie が送られなくなる。
// domain: www 側の proxy.ts が Cookie を読んで画面遷移を判定するため必要
//       （ADR 0004 決定 4）。api ホスト限定の host-only Cookie では読めない。
//       削除時にも同じ値を渡さなければ Cookie は消えない。
export const doctorCookieAttributes = {
    httpOnly: true,
    secure: isProduction,
    sameSite: doctorCookieSameSite,
    path: "/",
    ...(isProduction && { domain: process.env.SERVER_DOMAIN }),
};
```

- [ ] **Step 2: `app.ts` に古いコメントが残っていないことを確認する**

移行前の `app.ts` には csrf の直前に次の 1 行があった。決定 5 により事実でなくなるため残してはならない。

```
    // 本番の Cookie は sameSite=None のためクロスサイトでも送信される。
```

Task 2 Step 3 で `app.ts` を全体置換した際に既に消えているはずである。**残っていた場合は Task 2 の置き換えが不完全なので、その場で削除する。**

Run: `grep -n "sameSite=None" packages/api/src/app.ts`
Expected: 出力なし

- [ ] **Step 3: 型チェックとテストを実行する**

Run: `bun run typecheck && bun run test`
Expected: 両方成功

- [ ] **Step 4: ローカルでログインが従来どおり動くことを確認する**

ローカルは `NODE_ENV` が production ではないため `sameSite: "Strict"` のままで、この変更の影響を受けない。**ログインが壊れていないことだけを確認する。**

`bun run dev` を起動し、ブラウザで `http://localhost:3000/doctor/login` からログイン・一覧表示・ログアウトを行う。

Expected: 従来どおり動作する

- [ ] **Step 5: コミットする**

```bash
git add packages/api
git commit -m "$(cat <<'EOF'
feat: Cookie の SameSite を None から Lax へ強化する

www と api は eTLD+1 が同一のため same-site であり、Lax でも Cookie は
送信される。None はクロスサイト送信を許す最も弱い設定で、API が
onrender.com にあった時代には必要だったが、api サブドメインへ移った
時点で不要になっていた。

domain は www 側の proxy.ts が Cookie を読むため維持する。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pzpc442muwnNiLfmFKgDvZ
EOF
)"
```

---

### Task 6: 完了確認と Issue / PR の更新

**Files:**
- 変更なし（GitHub 上の Issue と PR のみ）

**Interfaces:**
- Consumes: Task 1〜5 の成果
- Produces: なし

- [ ] **Step 1: 全体の検証をやり直す**

Run: `bun run typecheck && bun run test && bun run build`
Expected: 3 つともエラーなく終了

- [ ] **Step 2: 両経路が動くことを最終確認する**

`bun run dev` を起動する。

Run:
```bash
curl -s -o /dev/null -w "単独起動 /trpc          → %{http_code}\n" http://localhost:8080/trpc/doctor.categories.list
curl -s -o /dev/null -w "単独起動 /api/trpc      → %{http_code}\n" http://localhost:8080/api/trpc/doctor.categories.list
curl -s -o /dev/null -w "route handler /api/trpc → %{http_code}\n" http://localhost:3000/api/trpc/doctor.categories.list
```
Expected: 3 つとも `401`

- [ ] **Step 3: #287 へ確認項目を追加する（要・利用者の承認）**

**GitHub 上の Issue を書き換える外向きの操作である。実行前に利用者へ確認を取ること。**

「やること」へ次を追加する。

```
- [ ] Vercel に `api` サブドメインを追加し、同じプロジェクトへ向ける（ADR 0006 決定 1）
- [ ] Vercel の環境変数へ `API_SUBDOMAIN_HOST` を設定する（未設定だと api サブドメインが 404 になる）
- [ ] `api` サブドメインの DNS 向き先を Render から Vercel へ変更する
- [ ] プレビュー環境で `request.url` のパスを計測し、二重マウント（ADR 0006 決定 4）を片方へ絞れるか判断する
```

- [ ] **Step 4: PR を作成する（要・利用者の承認）**

**外向きの操作である。実行前に利用者へ確認を取ること。**

**`Closes #287` は書かない。** 完了条件 3 つ（プレビュー環境で全機能が動作する / Render を停止してもアプリが動作する / 初回アクセスが 1 秒未満）はいずれも実環境での確認を要求しており、本 PR では満たせない。

PR の本文には次を含める。

- ADR 0006 へのリンク
- Issue 本文の `import { app } from "@repo/api"` が動かなかったこと、およびその理由
- 同一オリジン化ではなく `api` サブドメインを維持した判断（決定 1・2）と、Issue 本文からの逸脱
- Cookie の `SameSite` を `None` から `Lax` へ強化したこと
- 二重マウントが暫定であり、Vercel での計測後に絞ること
- `DEPLOY_TARGET=aws` が明示的に落ちるようになったこと
- **本番切り替えは #313 の決着後**であること
- 末尾に次の 2 行

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Pzpc442muwnNiLfmFKgDvZ
```

---

## 実装後に残る既知の状態

計画どおり完了しても次は解消しない。

- **#287 は閉じない。** 完了条件はすべて実環境での確認を要求する。Vercel のドメイン割り当て・環境変数設定・DNS 変更・デプロイは本計画の範囲外
- **本番データは平文のまま。** 一括ハッシュ化は #287 の切り替えと同時（ADR 0005 決定 2）。その前に #313（パスワード復旧経路）の決着が要る
- **二重マウントが残る。** rewrite 経由の `request.url` は Vercel でしか計測できない。絞り込みは Step 3 で #287 へ追加する項目
- **`infra/`（AWS）はビルド不能になる。** `DEPLOY_TARGET=aws` は明示的な例外で落ちる。扱いは #293 で判断する
- **`packages/api` から Next.js を import できてしまう状態は変わらない。** 規約のみで守られている（別 Issue として起票済み）
